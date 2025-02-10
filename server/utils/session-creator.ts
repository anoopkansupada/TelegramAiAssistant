import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./logger";

const logger = new CustomLogger("[SessionCreator]");

interface SessionConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  verificationCode: string;
  deviceModel?: string;
  systemVersion?: string;
  appVersion?: string;
  useWSS?: boolean;
}

export async function createSessionString({
  apiId,
  apiHash,
  phoneNumber,
  verificationCode,
  deviceModel = "TelegramCRM",
  systemVersion = "1.0.0",
  appVersion = "1.0.0",
  useWSS = true
}: SessionConfig): Promise<string> {
  logger.info("Starting session creation process");

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS,
    deviceModel,
    systemVersion,
    appVersion,
    langCode: "en",
    systemLangCode: "en"
  });

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => "", // 2FA will be implemented separately
      phoneCode: async () => verificationCode,
      onError: (err) => {
        logger.error("Error during session creation:", err);
        throw err;
      },
    });

    const sessionString = client.session.save() as unknown as string;

    // Verify the created session
    if (!await validateSession(client)) {
      throw new Error("Session validation failed");
    }

    await client.disconnect();
    logger.info("Session created and validated successfully");

    return sessionString;
  } catch (error) {
    logger.error("Failed to create session:", error);
    await client.disconnect();
    throw error;
  }
}

async function validateSession(client: TelegramClient): Promise<boolean> {
  try {
    const me = await client.getMe();
    return !!me;
  } catch (error) {
    logger.error("Session validation failed:", error);
    return false;
  }
}

export function validateSessionString(session: string): boolean {
  if (!session || typeof session !== 'string') {
    return false;
  }

  // Session string validation rules
  const rules = [
    // Minimum length check
    () => session.length >= 100,

    // Base64 segments check
    () => {
      const parts = session.split('.');
      return parts.length >= 2 && 
        parts.every(part => /^[a-zA-Z0-9+/]+={0,2}$/.test(part));
    },

    // DC ID check
    () => {
      const parts = session.split('.');
      const dcId = parseInt(parts[0], 10);
      return !isNaN(dcId) && dcId > 0 && dcId <= 5;
    }
  ];

  try {
    return rules.every(rule => rule());
  } catch (error) {
    logger.error("Error validating session string:", error);
    return false;
  }
}