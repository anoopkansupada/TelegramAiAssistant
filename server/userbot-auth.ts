import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";

let client: TelegramClient | null = null;

export async function initializeUserbot() {
  try {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
    const apiHash = process.env.TELEGRAM_API_HASH;

    console.log("[Userbot] Initializing with API ID:", apiId);

    if (!apiId || !apiHash) {
      console.error("[Userbot] Missing API credentials:", { apiId: !!apiId, apiHash: !!apiHash });
      throw new Error("Telegram API credentials are required");
    }

    const stringSession = new StringSession("");
    console.log("[Userbot] Creating new TelegramClient instance");

    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
      deviceModel: "Desktop",
      systemVersion: "Windows 10",
      appVersion: "1.0.0",
    });

    console.log("[Userbot] Client instance created successfully");
    return client;
  } catch (error) {
    console.error("[Userbot] Failed to initialize client:", error);
    throw error;
  }
}

export async function requestVerificationCode(phoneNumber: string) {
  try {
    console.log("[Userbot] Starting verification code request for phone:", phoneNumber);

    if (!client) {
      console.log("[Userbot] Client not initialized, creating new instance");
      client = await initializeUserbot();
    }

    console.log("[Userbot] Attempting to connect client");
    await client.connect();
    console.log("[Userbot] Client connected successfully");

    // Format phone number to ensure it starts with '+'
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone number:", formattedPhone);

    console.log("[Userbot] Sending verification code");
    const { phoneCodeHash } = await client.sendCode({
      apiId: parseInt(process.env.TELEGRAM_API_ID!, 10),
      apiHash: process.env.TELEGRAM_API_HASH!,
      phoneNumber: formattedPhone,
      settings: {
        _: "codeSettings",
      }
    });

    console.log("[Userbot] Verification code sent successfully, hash received:", phoneCodeHash);
    return phoneCodeHash;
  } catch (error) {
    console.error("[Userbot] Error in requestVerificationCode:", error);
    console.error("[Userbot] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function verifyCode(phoneNumber: string, code: string, phoneCodeHash: string) {
  try {
    console.log("[Userbot] Starting code verification process");
    console.log("[Userbot] Parameters:", { 
      phoneNumber,
      codeLength: code?.length,
      hashLength: phoneCodeHash?.length 
    });

    if (!client) {
      console.error("[Userbot] Client not initialized for verification");
      throw new Error("Client not initialized");
    }

    console.log("[Userbot] Connecting client for verification");
    await client.connect();
    console.log("[Userbot] Client connected for verification");

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone for verification:", formattedPhone);

    console.log("[Userbot] Attempting to sign in");
    const signInResult = await client.signIn({
      phoneNumber: formattedPhone,
      phoneCodeHash,
      phoneCode: code,
    });

    console.log("[Userbot] Sign in result type:", signInResult?.constructor?.name);

    if (signInResult instanceof Api.auth.AuthorizationSignUpRequired) {
      console.error("[Userbot] User not registered on Telegram");
      throw new Error("User is not registered on Telegram");
    }

    console.log("[Userbot] Saving session");
    const session = client.session.save() as string;
    console.log("[Userbot] Session saved successfully, length:", session?.length);

    return session;
  } catch (error) {
    console.error("[Userbot] Error in verifyCode:", error);
    console.error("[Userbot] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}