import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "../utils/logger";

const logger = new CustomLogger("[ConnectivityTest]");

export async function connectivityTest(apiId: number, apiHash: string): Promise<void> {
    const client = new TelegramClient(
        new StringSession(""),
        apiId,
        apiHash,
        {
            connectionRetries: 5,
            useWSS: true,
            deviceModel: "TelegramCRM/1.0",
            systemVersion: "Linux",
            appVersion: "1.0.0"
        }
    );

    try {
        logger.info("🟢 Starting basic connectivity test");
        await client.connect();
        logger.info("🟢 Basic connection established");

        const result = await client.sendMessage("me", {
            message: "Connectivity test"
        });
        logger.info("🟢 Full protocol validation passed");
    } catch (error) {
        logger.error(`🔴 Failure type: ${error?.constructor?.name}`);
        logger.error(`Error details: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
            logger.error("Stack trace:", error.stack);
        }
        throw error;
    } finally {
        try {
            await client.disconnect();
        } catch (error) {
            logger.warn("Error during disconnect:", error);
        }
    }
}