import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { CustomLogger } from "./utils/logger";

const logger = new CustomLogger("[TelegramAuth]");

// Using the API credentials from your screenshot
const apiId = 20186468;
const apiHash = "5462496a1c6075aa3e29754a1e3ee494";

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
});

async function start() {
    try {
        logger.info("Starting Telegram authentication process...");
        await client.connect();

        logger.info("Starting phone number authentication");
        await client.start({
            phoneNumber: async () => process.env.TELEGRAM_PHONE_NUMBER!,
            password: async () => "",  // If you have 2FA, we'll need to add this
            phoneCode: async () => {
                // We'll need the verification code
                logger.info("Please set the TELEGRAM_CODE secret with the code sent to your Telegram app");
                return process.env.TELEGRAM_CODE || "";
            },
            onError: (err) => {
                logger.error("Authentication error:", err);
                process.exit(1);
            }
        });

        logger.info("✅ Successfully logged into Telegram!");
        const sessionString = client.session.save();
        logger.info("\n=== YOUR SESSION STRING (save this) ===");
        logger.info(sessionString);
        logger.info("=======================================\n");
        logger.info("Copy this session string and set it as the TELEGRAM_SESSION secret in Replit.");

        await client.disconnect();
        process.exit(0);
    } catch (error) {
        logger.error("❌ Error logging into Telegram:", error);
        process.exit(1);
    }
}

start();