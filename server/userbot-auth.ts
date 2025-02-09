import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "./storage";

let client: TelegramClient | null = null;

export async function initializeUserbot() {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error("Telegram API credentials are required");
  }

  const stringSession = new StringSession("");
  client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      throw new Error("Phone number should be provided through the login flow");
    },
    password: async () => {
      throw new Error("2FA password should be provided through the login flow");
    },
    phoneCode: async () => {
      throw new Error("Phone code should be provided through the login flow");
    },
    onError: (err) => console.error(err),
  });
}

export async function requestVerificationCode(phoneNumber: string) {
  if (!client) {
    await initializeUserbot();
  }

  try {
    await client!.connect();
    await client!.sendCode({
      apiId: process.env.TELEGRAM_API_ID!,
      apiHash: process.env.TELEGRAM_API_HASH!,
      phoneNumber,
    });
    return true;
  } catch (error) {
    console.error("Error sending verification code:", error);
    throw error;
  }
}

export async function verifyCode(phoneNumber: string, code: string) {
  if (!client) {
    throw new Error("Client not initialized");
  }

  try {
    await client.connect();
    const result = await client.invoke({
      _: "auth.signIn",
      phoneNumber,
      phoneCodeHash: await client.getPhoneCodeHash(phoneNumber),
      phoneCode: code,
    });

    if (result._ === "auth.authorizationSignUpRequired") {
      throw new Error("User is not registered on Telegram");
    }

    const session = client.session.save() as string;
    return session;
  } catch (error) {
    console.error("Error verifying code:", error);
    throw error;
  }
}