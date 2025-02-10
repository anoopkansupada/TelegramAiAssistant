import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./logger";

const logger = new CustomLogger("[SessionCreator]");

export async function createSessionString(
  phoneNumber: string,
  apiId: number,
  apiHash: string,
  code: string
): Promise<string> {
  try {
    logger.info("Starting session creation process");

    // Create new string session
    const stringSession = new StringSession("");

    // Initialize client with secure defaults
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
      deviceModel: "Replit CRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      langCode: "en",
      systemLangCode: "en"
    });

    // Start client with provided credentials
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => "", // 2FA not supported in initial implementation
      phoneCode: async () => code,
      onError: (err) => {
        logger.error("Error during session creation:", err);
        throw err;
      },
    });

    // Save session string
    const sessionString = client.session.save() as unknown as string;

    // Verify session is valid using validation function
    if (!validateSessionString(sessionString)) {
      throw new Error("Generated session string is invalid");
    }

    await client.disconnect();
    logger.info("Session created successfully");

    return sessionString;
  } catch (error) {
    logger.error("Failed to create session:", error);
    throw error;
  }
}

export function validateSessionString(session: string): boolean {
  try {
    if (!session || typeof session !== 'string') {
      return false;
    }

    // Check minimum length (typical session strings are quite long)
    if (session.length < 100) {
      return false;
    }

    // Verify it contains the required parts of a session string
    // Session strings typically have multiple base64 segments separated by periods
    const parts = session.split('.');
    if (parts.length < 2) {
      return false;
    }

    // Verify each part is valid base64
    const base64regex = /^[a-zA-Z0-9+/]+={0,2}$/;
    return parts.every(part => base64regex.test(part));

  } catch (error) {
    logger.error("Error validating session string:", error);
    return false;
  }
}