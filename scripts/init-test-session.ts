import { db } from "../server/db";
import { telegramSessions } from "../shared/schema";
import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import { FloodWaitError } from "telegram/errors";
import { input } from "@inquirer/prompts";

// Use official test configuration as per documentation
const TEST_CONFIG = {
  apiId: 17349,
  apiHash: "344583e45741c457fe1862106095a5eb",
  testServers: true
};

async function handleFloodWait(error: Error) {
  if (error instanceof FloodWaitError) {
    const waitTime = Math.min(error.seconds * 1000, 5 * 60 * 1000); // Max 5min wait
    console.log(`Flood wait triggered, waiting for ${waitTime/1000}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Documented backoff strategy
    const retryAfter = Math.floor(waitTime * (1 + Math.random()));
    await new Promise(resolve => setTimeout(resolve, retryAfter));
  }
}

async function main() {
  console.log("Initializing test Telegram session using official test configuration...");

  const client = new TelegramClient(
    new StringSession(""),
    TEST_CONFIG.apiId,
    TEST_CONFIG.apiHash,
    {
      connectionRetries: 5,
      useWSS: true,
      deviceModel: "TelegramCRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      useTestDc: true,
      dcId: 2 // Test DC
    }
  );

  try {
    // Step 1: Send code using Telegram's recommended parameters
    await client.connect();
    const result = await client.sendCode({
      phoneNumber: process.env.TELEGRAM_PHONE_NUMBER!,
      settings: {
        _: "codeSettings",
        allowFlashCall: false,
        currentNumber: true,
        allowAppHash: true // Critical for server apps
      }
    });

    console.log("Authentication code sent to your Telegram app.");

    // Step 2: Sign in with exponential backoff
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const code = await input({ message: "Please enter the code you received: " });
        await client.invoke({
          _: 'auth.signIn',
          phoneNumber: process.env.TELEGRAM_PHONE_NUMBER!,
          phoneCodeHash: result.phoneCodeHash,
          phoneCode: code
        });
        break;
      } catch (e: any) {
        if (e.message === "SESSION_PASSWORD_NEEDED") {
          throw new Error("2FA is not supported in test mode");
        }
        await handleFloodWait(e);
        retries++;

        if (retries === maxRetries) {
          throw new Error("Max retries reached");
        }
      }
    }

    console.log("Successfully connected!");
    const sessionString = client.session.save() as unknown as string;
    console.log("Generated session string:", sessionString);

    // Store session in database with encryption
    const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("SESSION_ENCRYPTION_KEY not set");
    }

    // Insert session into database
    await db.insert(telegramSessions).values({
      userId: 1, // Test user ID
      sessionString,
      apiId: TEST_CONFIG.apiId.toString(),
      apiHash: TEST_CONFIG.apiHash,
      phoneNumber: process.env.TELEGRAM_PHONE_NUMBER!,
      lastAuthDate: new Date(),
      lastUsed: new Date(),
      isActive: true,
      retryCount: 0,
      metadata: {
        initializedAt: new Date().toISOString(),
        method: 'test-dc-init',
        useTestDc: true,
        dcId: 2
      }
    });

    console.log("Session stored in database successfully!");

    // Export for environment
    console.log("\nTo use this session, set the following environment variable:");
    console.log(`TELEGRAM_SESSION="${sessionString}"`);

    await client.disconnect();
  } catch (error) {
    console.error("Failed to initialize session:", error);
    process.exit(1);
  }
}

main().catch(console.error);