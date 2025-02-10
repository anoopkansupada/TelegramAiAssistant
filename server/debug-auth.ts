import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./utils/logger";
import { loadSession, saveSession, validateSession, requestVerificationCode, verifyCode } from "./telegram/auth";
import fs from "fs";
import { fileURLToPath } from 'url';

const logger = new CustomLogger("[TelegramAuth]");
const SESSION_FILE_PATH = "./telegram.session.json";

export async function authenticate() {
    try {
        logger.info("Starting Telegram authentication process...");

        // Check for existing session first
        const sessionString = await loadSession();
        if (sessionString) {
            logger.info("Found existing session, verifying...");
            const isValid = await validateSession(sessionString);

            if (isValid) {
                logger.info("✅ Existing session verified successfully!");
                logger.info("=== YOUR SESSION STRING (save this) ===");
                logger.info(sessionString);
                logger.info("=======================================");
                return sessionString;
            }

            logger.error("❌ Existing session is invalid, removing...");
            fs.unlinkSync(SESSION_FILE_PATH);
        }

        // Start fresh authentication
        logger.info("Starting new authentication process...");

        // Request verification code
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        if (!phoneNumber) {
            throw new Error("TELEGRAM_PHONE_NUMBER environment variable is not set");
        }

        logger.info("Requesting verification code...");
        await requestVerificationCode(phoneNumber);

        logger.info("✨ Verification code has been sent to your Telegram app");
        logger.info("❗ Please set the code in TELEGRAM_CODE environment variable when you receive it");
        logger.info("✅ You can now provide the verification code");

        return null; // Indicate that we need the verification code
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

        logger.info("Completing authentication with provided code...");
        const session = await verifyCode(phoneNumber, code);

        logger.info("✅ Authentication completed successfully!");
        logger.info("=== YOUR SESSION STRING (save this) ===");
        logger.info(session);
        logger.info("=======================================");
        logger.info("✅ Copy this session string and set it as the TELEGRAM_SESSION secret in Replit");

        return session;
    } catch (error) {
        logger.error("❌ Error completing authentication:", error);
        if (error instanceof Error) {
            logger.error("Stack trace:", error.stack);
        }
        throw error;
    }
}

// Only run if this file is being run directly
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
    authenticate()
        .then(session => {
            if (!session) {
                logger.info("Waiting for verification code to be provided...");

                // If we have a code in env, complete the authentication
                if (process.env.TELEGRAM_CODE) {
                    return completeAuthentication(process.env.TELEGRAM_CODE);
                }
            }
            process.exit(0);
        })
        .catch(error => {
            logger.error("Failed to complete authentication:", error);
            process.exit(1);
        });
}

export { authenticate as start };