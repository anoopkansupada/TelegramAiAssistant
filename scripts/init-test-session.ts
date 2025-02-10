import { db } from "../server/db";
import { telegramSessions } from "../shared/schema";
import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { input } from "@inquirer/prompts";

const apiId = process.env.TELEGRAM_API_ID!;
const apiHash = process.env.TELEGRAM_API_HASH!;
const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER!;

async function main() {
    console.log("Initializing test Telegram session...");

    const client = new TelegramClient(
        new StringSession(""),
        parseInt(apiId),
        apiHash,
        {
            connectionRetries: 5
        }
    );

    try {
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => await input({ message: "Please enter your 2FA password: ", mask: '*' }),
            phoneCode: async () => await input({ message: "Please enter the code you received: " }),
            onError: (err) => console.log(err),
        });

        console.log("Successfully connected!");
        const sessionString = client.session.save() as unknown as string;

        // Insert session into database
        await db.insert(telegramSessions).values({
            userId: 1, // Test user ID
            sessionString,
            apiId,
            apiHash,
            phoneNumber,
            lastAuthDate: new Date(),
            lastUsed: new Date(),
            isActive: true,
            retryCount: 0,
            metadata: {
                initializedAt: new Date().toISOString()
            }
        });

        console.log("Session stored in database successfully!");
        await client.disconnect();
    } catch (error) {
        console.error("Failed to initialize session:", error);
        process.exit(1);
    }
}

main().catch(console.error);
