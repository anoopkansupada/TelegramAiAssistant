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
  if (!ctx.message || !('text' in ctx.message)) return;

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

// Track when bot is added to channels/groups
bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.myChatMember.chat;

  if (chat.type === "channel" || chat.type === "group" || chat.type === "supergroup") {
    try {
      const existingChannel = await storage.getTelegramChannelByTelegramId(chat.id.toString());

      if (!existingChannel) {
        await storage.createTelegramChannel({
          name: chat.title || "Unnamed Channel",
          telegramId: chat.id.toString(),
          type: chat.type,
          createdById: 1, // System user
        });
      }
    } catch (error) {
      console.error("Failed to track channel/group:", error);
    }
  }
});

// Generate invite links for channels
export async function generateChannelInviteLink(chatId: string, options?: {
  expireDate?: number;
  memberLimit?: number;
}) {
  try {
    const inviteLink = await bot.telegram.createChatInviteLink(chatId, {
      expire_date: options?.expireDate,
      member_limit: options?.memberLimit,
    });
    return inviteLink.invite_link;
  } catch (error) {
    console.error("Failed to generate invite link:", error);
    throw new Error("Failed to generate invite link");
  }
}

// Revoke an invite link
export async function revokeChannelInviteLink(chatId: string, inviteLink: string) {
  try {
    await bot.telegram.revokeChatInviteLink(chatId, inviteLink);
  } catch (error) {
    console.error("Failed to revoke invite link:", error);
    throw new Error("Failed to revoke invite link");
  }
}

// Send announcements to specific channels/groups or all
export async function sendAnnouncement(content: string, targetChannelIds?: string[]) {
  if (targetChannelIds && targetChannelIds.length > 0) {
    // Send to specific channels
    for (const channelId of targetChannelIds) {
      try {
        await bot.telegram.sendMessage(channelId, content);
      } catch (error) {
        console.error(`Failed to send announcement to channel ${channelId}:`, error);
      }
    }
  } else {
    // Send to all channels
    const channels = await storage.listTelegramChannels();
    for (const channel of channels) {
      try {
        await bot.telegram.sendMessage(channel.telegramId, content);
      } catch (error) {
        console.error(`Failed to send announcement to ${channel.name}:`, error);
      }
    }
  }
}

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));