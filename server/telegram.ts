import { Telegraf } from "telegraf";
import { storage } from "./storage";
import sentiment from "sentiment";

const sentimentAnalyzer = new sentiment();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Store messages with sentiment analysis
bot.on("message", async (ctx) => {
  if (!ctx.message.text) return;

  const telegramId = ctx.message.from.id.toString();
  let contact = await storage.getContactByTelegramId(telegramId);

  if (!contact) {
    contact = await storage.createContact({
      name: ctx.message.from.first_name,
      telegramId,
      createdById: 1, // System user
    });
  }

  const sentimentResult = sentimentAnalyzer.analyze(ctx.message.text);
  let sentiment = "neutral";
  if (sentimentResult.score > 0) sentiment = "positive";
  if (sentimentResult.score < 0) sentiment = "negative";

  await storage.createMessage({
    contactId: contact.id,
    content: ctx.message.text,
    sentiment,
  });
});

// Send announcements
export async function sendAnnouncement(content: string) {
  const contacts = await storage.listContacts();
  
  for (const contact of contacts) {
    try {
      await bot.telegram.sendMessage(contact.telegramId, content);
    } catch (error) {
      console.error(`Failed to send announcement to ${contact.name}:`, error);
    }
  }
}

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
