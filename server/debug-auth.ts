import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./utils/logger";
import { storage } from "./storage";

const logger = new CustomLogger("[TelegramAuth]");

export async function authenticate() {
    try {
        logger.info("Starting Telegram authentication process...");

        // Check for existing session in database
        const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
        const apiHash = process.env.TELEGRAM_API_HASH || "";
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;

        if (!apiId || !apiHash || !phoneNumber) {
            throw new Error("Missing required environment variables (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE_NUMBER)");
        }

        // Create new session
        const client = new TelegramClient(
            new StringSession(""),
            apiId,
            apiHash,
            {
                connectionRetries: 5,
                useWSS: true,
            }
        );

        // Start the client
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => "",
            phoneCode: async () => {
                logger.info("✨ Verification code has been sent to your Telegram app");
                logger.info("❗ Please set the code in TELEGRAM_CODE environment variable");
                return "";
            },
            onError: (err) => logger.error("Client start error:", err),
        });

        // Get the session string
        const sessionString = client.session.save() as unknown as string;

        // Save to database
        await storage.createTelegramSession({
            userId: 1, // Default admin user
            sessionString,
            apiId: apiId.toString(),
            apiHash,
            phoneNumber,
            lastAuthDate: new Date(),
            lastUsed: new Date(),
            isActive: true,
            retryCount: 0,
            metadata: {}
        });

        logger.info("✅ Authentication completed successfully!");
        logger.info("=== YOUR SESSION STRING (save this) ===");
        logger.info(sessionString);
        logger.info("=======================================");

        await client.disconnect();
        return sessionString;
    } catch (error) {
        logger.error("❌ Error in Telegram authentication:", error);
        if (error instanceof Error) {
            logger.error("Stack trace:", error.stack);
        }
        throw error;
    }
}

export async function completeAuthentication(code: string) {
    try {
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        if (!phoneNumber) {
            throw new Error("TELEGRAM_PHONE_NUMBER environment variable is not set");
        }

        const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
        const apiHash = process.env.TELEGRAM_API_HASH || "";

        if (!apiId || !apiHash) {
            throw new Error("Missing Telegram API credentials");
        }

        // Create a new client
        const client = new TelegramClient(
            new StringSession(""),
            apiId,
            apiHash,
            {
                connectionRetries: 5,
                useWSS: true,
            }
        );

        // Start authentication with the provided code
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => "",
            phoneCode: async () => code,
            onError: (err) => logger.error("Client start error:", err),
        });

        // Get the session string
        const sessionString = client.session.save() as unknown as string;

        // Save to database
        await storage.createTelegramSession({
            userId: 1, // Default admin user
            sessionString,
            apiId: apiId.toString(),
            apiHash,
            phoneNumber,
            lastAuthDate: new Date(),
            lastUsed: new Date(),
            isActive: true,
            retryCount: 0,
            metadata: {}
        });

        logger.info("✅ Authentication completed successfully!");
        logger.info("=== YOUR SESSION STRING (save this) ===");
        logger.info(sessionString);
        logger.info("=======================================");

        await client.disconnect();
        return sessionString;
    } catch (error) {
        logger.error("❌ Error completing authentication:", error);
        if (error instanceof Error) {
            logger.error("Stack trace:", error.stack);
        }
        throw error;
    }
}

export { authenticate as start };