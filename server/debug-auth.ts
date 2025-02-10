import { CustomLogger } from "./utils/logger";
import { storage } from "./storage";
import { createSessionString } from "./utils/session-creator";

const logger = new CustomLogger("[TelegramAuth]");

export async function authenticate() {
    try {
        logger.info("Starting Telegram authentication process...");

        const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
        const apiHash = process.env.TELEGRAM_API_HASH || "";
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;

        if (!apiId || !apiHash || !phoneNumber) {
            throw new Error("Missing required environment variables (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE_NUMBER)");
        }

        logger.info("✨ Verification code has been sent to your Telegram app");
        logger.info("❗ Please set the code in TELEGRAM_CODE environment variable");

        return {
            success: true,
            message: "Please complete authentication with the code sent to your Telegram app"
        };
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

        // Create session string using the updated config interface
        const sessionString = await createSessionString({
            phoneNumber,
            apiId,
            apiHash,
            verificationCode: code,
            deviceModel: "TelegramCRM",
            systemVersion: "1.0.0",
            appVersion: "1.0.0",
            useWSS: true
        });

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

        return {
            success: true,
            sessionString
        };
    } catch (error) {
        logger.error("❌ Error completing authentication:", error);
        if (error instanceof Error) {
            logger.error("Stack trace:", error.stack);
        }
        throw error;
    }
}

export { authenticate as start };