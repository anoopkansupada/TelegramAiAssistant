import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";

interface ClientInstance {
  client: TelegramClient | null;
  session: string | null;
}

// Global client instance
const clientInstance: ClientInstance = {
  client: null,
  session: null
};

export async function getOrCreateClient(session: string): Promise<TelegramClient> {
  try {
    // If we already have a client with the same session, reuse it
    if (clientInstance.client && clientInstance.session === session) {
      // Check if the client is connected
      if (await clientInstance.client.isConnected()) {
        console.log("[UserBot] Reusing existing connected client");
        return clientInstance.client;
      }
      // If not connected, try to reconnect
      try {
        await clientInstance.client.connect();
        console.log("[UserBot] Reconnected existing client");
        return clientInstance.client;
      } catch (error) {
        console.log("[UserBot] Failed to reconnect existing client, creating new one");
        // If reconnection fails, proceed to create new client
      }
    }

    // Create new client
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
    const apiHash = process.env.TELEGRAM_API_HASH;

    if (!apiId || !apiHash) {
      throw new Error("Telegram API credentials are required");
    }

    const stringSession = new StringSession(session);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
      deviceModel: "Desktop",
      systemVersion: "Windows 10",
      appVersion: "1.0.0",
    });

    await client.connect();
    console.log("[UserBot] Created and connected new client");

    // Store the new client instance
    clientInstance.client = client;
    clientInstance.session = session;

    return client;
  } catch (error) {
    console.error("[UserBot] Error in getOrCreateClient:", error);
    throw error;
  }
}

export async function disconnectClient(): Promise<void> {
  if (clientInstance.client) {
    try {
      await clientInstance.client.disconnect();
      clientInstance.client = null;
      clientInstance.session = null;
      console.log("[UserBot] Client disconnected successfully");
    } catch (error) {
      console.error("[UserBot] Error disconnecting client:", error);
    }
  }
}
