import dotenv from "dotenv";
dotenv.config();
import fs from "node:fs";
import { prisma } from "./lib/prisma.js";
import { decrypt } from "./lib/crypto.js";

async function main() {
  const logs: string[] = ["=== CHECKING DB STATE ==="];
  try {
    const users = await prisma.user.findMany();
    logs.push(`Users count: ${users.length}`);
    for (const u of users) {
      logs.push(`User: ${u.id} (${u.email})`);
    }

    const keys = await prisma.apiKey.findMany();
    logs.push(`API Keys count: ${keys.length}`);
    for (const k of keys) {
      let decrypted = "FAILED";
      try {
        decrypted = decrypt(k.ciphertext);
        decrypted = decrypted.slice(0, 6) + "..." + decrypted.slice(-4);
      } catch (e: any) {
        decrypted = "DECRYPT ERROR: " + e.message;
      }
      logs.push(`Key: userId=${k.userId}, scope=${k.scope}, decrypted=${decrypted}`);
    }

    const convs = await prisma.conversation.findMany({ take: 5 });
    logs.push(`Conversations count: ${convs.length}`);
    for (const c of convs) {
      logs.push(`Conv: ${c.id}, title="${c.title}", wsId=${c.workspaceId}`);
    }

    const msgs = await prisma.chatMessage.findMany({ take: 5, orderBy: { createdAt: "desc" } });
    logs.push(`Recent messages: ${msgs.length}`);
    for (const m of msgs) {
      logs.push(`Msg: [${m.role}] conv=${m.conversationId}: ${m.content.slice(0, 80)}`);
    }
  } catch (err: any) {
    logs.push(`DB Error: ${err.message || err}`);
  } finally {
    await prisma.$disconnect();
    fs.writeFileSync("output.txt", logs.join("\n"), "utf-8");
  }
}

main();
