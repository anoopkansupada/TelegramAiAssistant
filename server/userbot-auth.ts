import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { computeCheck } from "telegram/Password";

let client: TelegramClient | null = null;

async function cleanupExistingClient() {
  if (client) {
    try {
      console.log("[Userbot] Cleaning up existing client");
      if (client.connected) {
        await client.disconnect();
      }
      await client.destroy();
      client = null;
    } catch (error) {
      console.error("[Userbot] Error during cleanup:", error);
    }
  }
}

export async function initializeUserbot() {
  try {
    await cleanupExistingClient();

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
      baseLogger: {
        debug: (...args) => console.debug('[TG Debug]', ...args),
        info: (...args) => console.info('[TG Info]', ...args),
        warn: (...args) => console.warn('[TG Warn]', ...args),
        error: (...args) => console.error('[TG Error]', ...args),
      }
    });

    console.log("[Userbot] Client instance created successfully");
    return client;
  } catch (error: any) {
    console.error("[Userbot] Failed to initialize client:", error);
    throw error;
  }
}

export async function requestVerificationCode(phoneNumber: string): Promise<string> {
  try {
    console.log("[Userbot] Starting verification code request for phone:", phoneNumber);

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    // Always cleanup and reinitialize for fresh start
    await cleanupExistingClient();
    client = await initializeUserbot();

    console.log("[Userbot] Attempting to connect client");
    await client.connect();
    console.log("[Userbot] Client connected successfully");

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone number:", formattedPhone);

    console.log("[Userbot] Sending verification code");
    try {
      const result = await client.invoke(new Api.auth.SendCode({
        phoneNumber: formattedPhone,
        apiId: parseInt(process.env.TELEGRAM_API_ID!, 10),
        apiHash: process.env.TELEGRAM_API_HASH!,
        settings: new Api.CodeSettings({
          allowFlashcall: false,
          currentNumber: true,
          allowAppHash: true,
          allowMissedCall: false,
          logoutTokens: []
        })
      }));

      console.log("[Userbot] Verification code sent successfully");
      return result.phoneCodeHash;
    } catch (error: any) {
      console.log("[Userbot] Initial sendCode error:", error.message);

      if (error.errorMessage?.includes('AUTH_RESTART')) {
        console.log("[Userbot] AUTH_RESTART detected, retrying after cleanup");
        await cleanupExistingClient();
        client = await initializeUserbot();
        await client.connect();

        const retryResult = await client.invoke(new Api.auth.SendCode({
          phoneNumber: formattedPhone,
          apiId: parseInt(process.env.TELEGRAM_API_ID!, 10),
          apiHash: process.env.TELEGRAM_API_HASH!,
          settings: new Api.CodeSettings({
            allowFlashcall: false,
            currentNumber: true,
            allowAppHash: true,
            allowMissedCall: false,
            logoutTokens: []
          })
        }));

        return retryResult.phoneCodeHash;
      }
      throw error;
    }
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

export async function verifyCode(phoneNumber: string, code: string, phoneCodeHash: string): Promise<string> {
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

    if (!client.connected) {
      console.log("[Userbot] Connecting client for verification");
      await client.connect();
      console.log("[Userbot] Client connected for verification");
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone for verification:", formattedPhone);

    console.log("[Userbot] Attempting to sign in");
    try {
      const signInResult = await client.invoke(new Api.auth.SignIn({
        phoneNumber: formattedPhone,
        phoneCode: code,
        phoneCodeHash: phoneCodeHash
      }));

      console.log("[Userbot] Sign in successful");
      const sessionString = client.session.save() as unknown as string;
      console.log("[Userbot] Session saved successfully, length:", sessionString?.length);

      return sessionString;
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        console.log("[Userbot] 2FA password required");
        throw new Error('2FA_REQUIRED');
      }
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

export async function verify2FA(password: string): Promise<string> {
  try {
    console.log("[Userbot] Starting 2FA verification");

    if (!client) {
      throw new Error("Client not initialized");
    }

    if (!password) {
      throw new Error("2FA password is required");
    }

    try {
      // Get the current account's password info
      const passwordInfo = await client.invoke(new Api.account.GetPassword());

      // Calculate the password check using the SRP protocol
      const { A, M1 } = await computeCheck(passwordInfo, password);

      // Verify the password
      await client.invoke(new Api.auth.CheckPassword({
        password: {
          className: "InputCheckPasswordSRP",
          srpId: passwordInfo.srpId,
          A: A.toString('hex'),
          M1: M1.toString('hex')
        }
      }));

      console.log("[Userbot] 2FA verification successful");
      const sessionString = client.session.save() as unknown as string;
      console.log("[Userbot] Session saved successfully, length:", sessionString?.length);

      return sessionString;
    } catch (error: any) {
      console.error("[Userbot] 2FA verification failed:", error);
      throw new Error("Invalid 2FA password");
    }
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