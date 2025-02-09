import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { computeCheck } from "telegram/Password";
import { clientManager } from "./userbot-client";

export async function requestVerificationCode(phoneNumber: string): Promise<string> {
  try {
    console.log("[Userbot] Starting verification code request for phone:", phoneNumber);

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    // Get a fresh client instance
    const client = await clientManager.getClient();

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log("[Userbot] Formatted phone number:", formattedPhone);

    try {
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

      console.log("[Userbot] Verification code sent successfully");
      return result.phoneCodeHash;
    } catch (error: any) {
      console.log("[Userbot] Initial sendCode error:", error.message);

      if (error.errorMessage?.includes('AUTH_RESTART')) {
        console.log("[Userbot] AUTH_RESTART detected, retrying with fresh client");
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

    const client = await clientManager.getClient();
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