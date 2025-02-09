import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { computeCheck } from "telegram/Password";
import { clientManager } from "./userbot-client";

export async function requestVerificationCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
  try {
    console.log("[Userbot] Starting verification code request for phone:", phoneNumber);

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone number:", formattedPhone);

    // Get a fresh client instance
    const client = await clientManager.getClient();

    try {
      // Request verification code with explicit settings
      const result = await client.invoke(new Api.auth.SendCode({
        phoneNumber: formattedPhone,
        apiId: parseInt(process.env.TELEGRAM_API_ID || "", 10),
        apiHash: process.env.TELEGRAM_API_HASH || "",
        settings: new Api.CodeSettings({
          allowFlashcall: false,
          currentNumber: true,
          allowAppHash: true,
          allowMissedCall: false,
          logoutTokens: []
        })
      }));

      // Extract phoneCodeHash from the SentCode response
      const phoneCodeHash = (result as any).phoneCodeHash;
      if (!phoneCodeHash) {
        throw new Error("Failed to get phone code hash from Telegram");
      }

      console.log("[Userbot] Verification code sent successfully");
      return { phoneCodeHash };
    } catch (error: any) {
      console.log("[Userbot] Initial sendCode error:", error.message);

      if (error.errorMessage?.includes('AUTH_RESTART')) {
        console.log("[Userbot] AUTH_RESTART detected, waiting before retry");

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Clean up and retry with a fresh client
        await clientManager.cleanup();
        const newClient = await clientManager.getClient();

        const retryResult = await newClient.invoke(new Api.auth.SendCode({
          phoneNumber: formattedPhone,
          apiId: parseInt(process.env.TELEGRAM_API_ID || "", 10),
          apiHash: process.env.TELEGRAM_API_HASH || "",
          settings: new Api.CodeSettings({
            allowFlashcall: false,
            currentNumber: true,
            allowAppHash: true,
            allowMissedCall: false,
            logoutTokens: []
          })
        }));

        const retryPhoneCodeHash = (retryResult as any).phoneCodeHash;
        if (!retryPhoneCodeHash) {
          throw new Error("Failed to get phone code hash from Telegram after retry");
        }

        return { phoneCodeHash: retryPhoneCodeHash };
      }

      throw error;
    }
  } catch (error: any) {
    console.error("[Userbot] Error in requestVerificationCode:", error);
    throw new Error(error.message || "Failed to request verification code");
  }
}

export async function verifyCode(phoneNumber: string, code: string, phoneCodeHash: string): Promise<string> {
  try {
    console.log("[Userbot] Starting code verification process");

    if (!phoneNumber || !code || !phoneCodeHash) {
      throw new Error("Missing required parameters for verification");
    }

    const client = await clientManager.getClient();
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    try {
      const signInResult = await client.invoke(new Api.auth.SignIn({
        phoneNumber: formattedPhone,
        phoneCode: code,
        phoneCodeHash: phoneCodeHash
      }));

      if (!signInResult) {
        throw new Error("Sign in failed - no response from Telegram");
      }

      console.log("[Userbot] Sign in successful");
      const sessionString = client.session.save() as unknown as string;

      if (!sessionString) {
        throw new Error("Failed to save session");
      }

      return sessionString;
    } catch (error: any) {
      console.error("[Userbot] Sign in error:", error);

      // Map Telegram error codes to our custom errors
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        throw new Error('2FA_REQUIRED');
      }

      if (error.errorMessage?.includes('PHONE_CODE_INVALID')) {
        throw new Error('PHONE_CODE_INVALID');
      }

      if (error.errorMessage?.includes('PHONE_CODE_EXPIRED')) {
        throw new Error('PHONE_CODE_EXPIRED');
      }

      throw new Error(error.message || "Failed to verify code");
    }
  } catch (error: any) {
    console.error("[Userbot] Error in verifyCode:", error);
    throw error;
  }
}

export async function verify2FA(password: string): Promise<string> {
  try {
    if (!password) {
      throw new Error("2FA password is required");
    }

    const client = await clientManager.getClient();

    try {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());

      // Use the official Telegram password computation
      const { A, M1 } = await computeCheck(passwordInfo, password);

      await client.invoke(new Api.auth.CheckPassword({
        password: {
          className: "InputCheckPasswordSRP",
          srpId: passwordInfo.srpId?.toString(),
          A: Buffer.from(A),
          M1: Buffer.from(M1)
        }
      }));

      const sessionString = client.session.save() as unknown as string;
      if (!sessionString) {
        throw new Error("Failed to save session after 2FA");
      }

      return sessionString;
    } catch (error: any) {
      if (error.errorMessage?.includes('PASSWORD_HASH_INVALID')) {
        throw new Error("Invalid 2FA password");
      }
      throw error;
    }
  } catch (error: any) {
    console.error("[Userbot] Error in verify2FA:", error);
    throw error;
  }
}