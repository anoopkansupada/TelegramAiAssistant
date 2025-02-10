import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as dotenv from 'dotenv';
import { input } from '@inquirer/prompts';

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

async function main() {
    console.log("Starting Telegram authentication...");

    const client = new TelegramClient(
        new StringSession(""),
        apiId,
        apiHash,
        {
            connectionRetries: 5,
            useWSS: true,
        }
    );

    await client.start({
        phoneNumber: async () => await input({ message: "Please enter your phone number: " }),
        password: async () => await input({ message: "Please enter your 2FA password: ", mask: '*' }),
        phoneCode: async () => await input({ message: "Please enter the code you received: " }),
        onError: (err) => console.log(err),
    });

    console.log("Successfully connected!");
    const session = client.session.save() as unknown as string;
    console.log("Your session string:", session);

    await client.disconnect();
}

main().catch(console.error);