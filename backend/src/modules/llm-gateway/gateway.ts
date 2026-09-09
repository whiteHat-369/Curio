import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { ApiKeyMissingError } from "../../lib/errors.js";

export interface LlmCompletionInput {
  userId: string;
  provider: "openai" | "gemini" | "grok";
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stream?: boolean;
}

export interface LlmGatewayInterface {
  complete(input: LlmCompletionInput): Promise<AsyncIterable<string> | string>;
}

interface ResolvedKey {
  apiKey: string;
  effectiveProvider: "openai" | "gemini" | "grok";
}

function isValidKey(key: string | undefined): boolean {
  return typeof key === "string" && key.trim().length >= 15 && key.trim().toLowerCase() !== "configured";
}

// ── Resolve a user's API key with automatic fallback across providers ──
async function resolveApiKey(userId: string, provider: string): Promise<ResolvedKey> {
  const requestedScope = `model:${provider}`;

  // 1. Check user-configured key in database for requested provider
  if (userId) {
    const userKey = await prisma.apiKey.findFirst({
      where: { userId, scope: requestedScope },
    });
    if (userKey) {
      const decrypted = decrypt(userKey.ciphertext);
      if (isValidKey(decrypted)) {
        return {
          apiKey: decrypted.trim(),
          effectiveProvider: provider as "openai" | "gemini" | "grok",
        };
      }
    }
  }

  // 2. Check environment variable for requested provider
  const envKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : provider === "grok"
      ? process.env.GROK_API_KEY
      : undefined;

  if (isValidKey(envKey)) {
    return {
      apiKey: envKey!.trim(),
      effectiveProvider: provider as "openai" | "gemini" | "grok",
    };
  }

  // 3. Smart Fallback: Check if user has ANY other configured model in DB
  if (userId) {
    const userKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        scope: { in: ["model:gemini", "model:openai", "model:grok"] },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const keyRecord of userKeys) {
      const decrypted = decrypt(keyRecord.ciphertext);
      if (isValidKey(decrypted)) {
        const eff = keyRecord.scope.replace("model:", "") as "openai" | "gemini" | "grok";
        return {
          apiKey: decrypted.trim(),
          effectiveProvider: eff,
        };
      }
    }
  }

  // 4. Smart Fallback: Check if ANY environment key is defined
  if (isValidKey(process.env.GEMINI_API_KEY)) {
    return {
      apiKey: process.env.GEMINI_API_KEY!.trim(),
      effectiveProvider: "gemini",
    };
  }
  if (isValidKey(process.env.OPENAI_API_KEY)) {
    return {
      apiKey: process.env.OPENAI_API_KEY!.trim(),
      effectiveProvider: "openai",
    };
  }
  if (isValidKey(process.env.GROK_API_KEY)) {
    return {
      apiKey: process.env.GROK_API_KEY!.trim(),
      effectiveProvider: "grok",
    };
  }

  throw new ApiKeyMissingError(provider);
}

// ── Provider adapters ────────────────────────────────────────────

function truncateMessages(messages: LlmCompletionInput["messages"]): LlmCompletionInput["messages"] {
  return messages.map((m) => ({
    ...m,
    content: m.content.slice(0, 8000), // Max 8k chars per message to bound token costs
  }));
}

async function callOpenAI(
  apiKey: string,
  messages: LlmCompletionInput["messages"],
  stream: boolean,
): Promise<AsyncIterable<string> | string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, timeout: 30000 });
  const safeMessages = truncateMessages(messages);

  if (stream) {
    const chatStream = await client.chat.completions.create({
      model: "gpt-4o",
      messages: safeMessages,
      max_tokens: 1500,
      stream: true,
    });

    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of chatStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) yield content;
        }
      },
    };
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: safeMessages,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content ?? "";
}

async function callGemini(
  apiKey: string,
  messages: LlmCompletionInput["messages"],
  stream?: boolean,
): Promise<AsyncIterable<string> | string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  const safeMessages = truncateMessages(messages);

  // Extract system prompt if present
  const systemMessages = safeMessages.filter((m) => m.role === "system");
  const chatMessages = safeMessages.filter((m) => m.role !== "system");

  const systemInstruction =
    systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n\n")
      : undefined;

  // Build Gemini contents array with role: "user" | "model"
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const msg of chatMessages) {
    const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";
    const text = msg.content || " ";
    const prev = contents[contents.length - 1];

    if (prev && prev.role === role) {
      prev.parts.push({ text: "\n" + text });
    } else {
      contents.push({
        role,
        parts: [{ text }],
      });
    }
  }

  // Ensure content starts with user role if non-empty
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  } else if (contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Context:" }] });
  }

  const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        },
      });

      if (stream) {
        const streamResult = await model.generateContentStream({ contents });
        return {
          async *[Symbol.asyncIterator]() {
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              if (text) yield text;
            }
          },
        };
      }

      const result = await model.generateContent({ contents });
      return result.response.text();
    } catch (err: any) {
      lastError = err;
      // If error is 404 or model not found, try the next model
      if (err?.message?.includes("not found") || err?.status === 404) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Failed to generate content with Gemini");
}

async function callGrok(
  apiKey: string,
  messages: LlmCompletionInput["messages"],
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
    timeout: 30000,
  });

  const safeMessages = truncateMessages(messages);
  const response = await client.chat.completions.create({
    model: "grok-2",
    messages: safeMessages,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content ?? "";
}

// ── Mock provider for development ────────────────────────────────
function mockComplete(messages: LlmCompletionInput["messages"]): string {
  const lastMessage = messages[messages.length - 1]?.content ?? "";
  return `Mock response to: "${lastMessage.slice(0, 100)}". Configure a Gemini or OpenAI API key in Settings to use live AI.`;
}

// ── Main gateway ─────────────────────────────────────────────────

class LlmGateway implements LlmGatewayInterface {
  async complete(input: LlmCompletionInput): Promise<AsyncIterable<string> | string> {
    const { userId, provider, messages, stream } = input;

    try {
      const { apiKey, effectiveProvider } = await resolveApiKey(userId, provider);

      switch (effectiveProvider) {
        case "openai":
          return await callOpenAI(apiKey, messages, stream ?? false);
        case "gemini":
          return await callGemini(apiKey, messages, stream ?? false);
        case "grok":
          return await callGrok(apiKey, messages);
        default:
          return mockComplete(messages);
      }
    } catch (err: any) {
      if (err instanceof ApiKeyMissingError) {
        return mockComplete(messages);
      }
      // Return clear error message so user knows what failed with the AI provider
      console.error("[LLM Gateway Error]:", err?.message || err);
      return `⚠️ AI Provider Error (${provider}): ${err?.message || "Check your API key and quotas."}`;
    }
  }
}

export const llmGateway: LlmGatewayInterface = new LlmGateway();