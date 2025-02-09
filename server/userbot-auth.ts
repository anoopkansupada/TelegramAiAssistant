import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "./storage";

let client: TelegramClient | null = null;

export async function initializeUserbot() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error("Telegram API credentials are required");
  }

  const stringSession = new StringSession("");
  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  return client;
}

export async function requestVerificationCode(phoneNumber: string) {
  try {
    if (!client) {
      client = await initializeUserbot();
    }

    await client.connect();

    // Format phone number to ensure it starts with '+'
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    const result = await client.sendCode({
      apiId: parseInt(process.env.TELEGRAM_API_ID!, 10),
      apiHash: process.env.TELEGRAM_API_HASH!,
      phoneNumber: formattedPhone,
    });

    return result.phoneCodeHash;
  } catch (error) {
    console.error("Error sending verification code:", error);
    throw error;
  }
}

export async function verifyCode(phoneNumber: string, code: string, phoneCodeHash: string) {
  if (!client) {
    throw new Error("Client not initialized");
  }

  try {
    await client.connect();

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    const result = await client.invoke({
      _: "auth.signIn",
      phoneNumber: formattedPhone,
      phoneCodeHash,
      phoneCode: code,
    });

    if (result._ === "auth.authorizationSignUpRequired") {
      throw new Error("User is not registered on Telegram");
    }

    const session = await client.session.save();
    return session as string;
  } catch (error) {
    console.error("Error verifying code:", error);
    throw error;
  }
}