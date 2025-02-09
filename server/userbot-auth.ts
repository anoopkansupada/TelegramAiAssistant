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
  } catch (error: any) {
    console.error("[Userbot] Failed to initialize client:", error);
    throw error;
  }
}

export async function requestVerificationCode(phoneNumber: string) {
  try {
    console.log("[Userbot] Starting verification code request for phone:", phoneNumber);

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    if (!client) {
      console.log("[Userbot] Client not initialized, creating new instance");
      client = await initializeUserbot();
    }

    console.log("[Userbot] Attempting to connect client");
    await client.connect();
    console.log("[Userbot] Client connected successfully");

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone number:", formattedPhone);

    console.log("[Userbot] Sending verification code");
    const result = await client.sendCode({
      phoneNumber: formattedPhone,
      apiId: parseInt(process.env.TELEGRAM_API_ID!, 10),
      apiHash: process.env.TELEGRAM_API_HASH!,
    });

    console.log("[Userbot] Verification code sent successfully, hash received:", result.phoneCodeHash);
    return result.phoneCodeHash;
  } catch (error: any) {
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

    if (!phoneNumber || !code || !phoneCodeHash) {
      throw new Error("Missing required parameters for verification");
    }

    console.log("[Userbot] Connecting client for verification");
    await client.connect();
    console.log("[Userbot] Client connected for verification");

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone for verification:", formattedPhone);

    console.log("[Userbot] Attempting to sign in");
    try {
      await client.signIn({
        phoneNumber: formattedPhone,
        phoneCode: code,
        phoneCodeHash: phoneCodeHash,
      });

      console.log("[Userbot] Saving session");
      const sessionString = client.session.save() as unknown as string;
      console.log("[Userbot] Session saved successfully, length:", sessionString?.length);

      return sessionString;
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        console.log("[Userbot] 2FA password required");
        throw new Error('2FA_REQUIRED');
      }
      console.error("[Userbot] Sign in error:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("[Userbot] Error in verifyCode:", error);
    console.error("[Userbot] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function verify2FA(password: string) {
  try {
    console.log("[Userbot] Starting 2FA verification");

    if (!client) {
      throw new Error("Client not initialized");
    }

    if (!password) {
      throw new Error("2FA password is required");
    }

    console.log("[Userbot] Checking 2FA password");
    await client.checkPassword(password);

    console.log("[Userbot] 2FA verification successful");
    const sessionString = client.session.save() as unknown as string;
    console.log("[Userbot] Session saved successfully, length:", sessionString?.length);

    return sessionString;
  } catch (error: any) {
    console.error("[Userbot] Error in verify2FA:", error);
    console.error("[Userbot] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}