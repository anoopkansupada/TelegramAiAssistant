import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./utils/logger";

const logger = new CustomLogger("[TelegramAuth]");

// Using the API credentials from environment variables
const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

async function start() {
    try {
        logger.info("Starting Telegram authentication process...");

        // Initialize with empty session for new authentication
        const stringSession = new StringSession("");
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
            useWSS: true,
        });

        logger.info("Starting phone number authentication");
        await client.start({
            phoneNumber: async () => {
                logger.info("Using phone number from TELEGRAM_PHONE_NUMBER env variable");
                return process.env.TELEGRAM_PHONE_NUMBER!;
            },
            password: async () => {
                logger.info("2FA password required - waiting for TELEGRAM_PASSWORD to be set");
                return process.env.TELEGRAM_PASSWORD || "";
            },
            phoneCode: async () => {
                logger.info("Verification code needed - please set the TELEGRAM_CODE secret with the code sent to your Telegram app");
                logger.info("Waiting for code to be set...");
                return process.env.TELEGRAM_CODE || "";
            },
            onError: (err) => {
                logger.error("Authentication error:", err);
                process.exit(1);
            }
        });

        logger.info("✅ Successfully logged into Telegram!");
        const sessionString = client.session.save() as unknown as string;
        logger.info("=== YOUR SESSION STRING (save this) ===");
        logger.info(sessionString);
        logger.info("=======================================");
        logger.info("Copy this session string and set it as the TELEGRAM_SESSION secret in Replit.");

        await client.disconnect();
        process.exit(0);
    } catch (error) {
        logger.error("❌ Error logging into Telegram:", error);
        if (error instanceof Error) {
            logger.error("Stack trace:", error.stack?.split('\n'));
        }
        process.exit(1);
    }
}

// Only start if running directly
if (require.main === module) {
    start();
}