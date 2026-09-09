import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runGeminiTest() {
  console.log("==================================================");
  console.log("       Curio — Google Gemini AI Integration Test   ");
  console.log("==================================================");

  const key = process.env.GEMINI_API_KEY?.trim();

  if (!key) {
    console.log("❌ GEMINI_API_KEY is not set in backend/.env");
    console.log("👉 Add GEMINI_API_KEY=AIzaSy... to backend/.env or configure it via the Settings UI.");
    return;
  }

  const maskedKey = key.slice(0, 6) + "..." + key.slice(-4);
  console.log(`🔑 Found GEMINI_API_KEY: ${maskedKey}`);

  const genAI = new GoogleGenerativeAI(key);

  const modelsToTest = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let success = false;

  for (const modelName of modelsToTest) {
    console.log(`\n⏳ Testing model "${modelName}"...`);
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: "You are Curio AI, an academic research assistant.",
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      });

      const startTime = Date.now();
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: "Explain why attention mechanisms improve long-range context in Transformers in 2 sentences." }],
          },
        ],
      });

      const elapsed = Date.now() - startTime;
      const responseText = result.response.text();

      console.log(`✅ Model "${modelName}" responded successfully in ${elapsed}ms:`);
      console.log("--------------------------------------------------");
      console.log(responseText.trim());
      console.log("--------------------------------------------------");
      success = true;
      break;
    } catch (err: any) {
      console.log(`⚠️ Model "${modelName}" failed: ${err.message || err}`);
    }
  }

  if (success) {
    console.log("\n🎉 GEMINI AI INTEGRATION IS FULLY FUNCTIONAL IN CURIO!");
  } else {
    console.log("\n❌ All Gemini models failed. Please verify your API key and quotas in Google AI Studio.");
  }
}

runGeminiTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
