import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { CustomLogger } from "./utils/logger";

dotenv.config();

const logger = new CustomLogger("[TelegramAuth]");

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
});

async function start() {
    try {
        await client.connect();

        if (!await client.isUserAuthorized()) {
            logger.info("Starting phone number authentication");
            await client.start({
                phoneNumber: async () => process.env.TELEGRAM_PHONE_NUMBER!,
                password: async () => {
                    return new Promise((resolve) => {
                        process.stdin.once('data', (data) => {
                            resolve(data.toString().trim());
                        });
                        console.log("Please enter your 2FA password (if required):");
                    });
                },
                phoneCode: async () => {
                    return new Promise((resolve) => {
                        process.stdin.once('data', (data) => {
                            resolve(data.toString().trim());
                        });
                        console.log("Please enter the code sent to your Telegram app:");
                    });
                },
                onError: (err) => {
                    logger.error("Authentication error:", err);
                    process.exit(1);
                }
            });
        }

        logger.info("✅ Successfully logged into Telegram!");
        const session = client.session.save() as string;
        logger.info("Session string:", session);

        await client.disconnect();
        process.exit(0);
    } catch (error) {
        logger.error("❌ Error logging into Telegram:", error);
        process.exit(1);
    }
}

start();