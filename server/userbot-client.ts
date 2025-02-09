import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";

interface ClientInstance {
  client: TelegramClient | null;
  session: string | null;
  lastUsed: number;
  connected: boolean;
}

// Global client instance
const clientInstance: ClientInstance = {
  client: null,
  session: null,
  lastUsed: 0,
  connected: false
};

// Connection check interval (5 minutes)
const CONNECTION_CHECK_INTERVAL = 5 * 60 * 1000;

// Ping the client periodically to keep connection alive
setInterval(async () => {
  try {
    if (clientInstance.client && clientInstance.connected) {
      console.log("[UserBot] Checking connection status...");
      const connected = await clientInstance.client.checkConnection();
      console.log("[UserBot] Connection status:", connected);
      clientInstance.connected = connected;

      if (!connected) {
        console.log("[UserBot] Connection lost, will reconnect on next use");
      }
    }
  } catch (error) {
    console.error("[UserBot] Error checking connection:", error);
    clientInstance.connected = false;
  }
}, CONNECTION_CHECK_INTERVAL);

export async function getOrCreateClient(session: string): Promise<TelegramClient> {
  try {
    console.log("[UserBot] Client instance state:", {
      hasClient: !!clientInstance.client,
      currentSession: clientInstance.session?.slice(0, 10) + "...",
      newSession: session.slice(0, 10) + "...",
      lastUsed: new Date(clientInstance.lastUsed).toISOString(),
      connected: clientInstance.connected
    });

    // If we already have a client with the same session, reuse it
    if (clientInstance.client && clientInstance.session === session) {
      // Check if the client is still connected
      console.log("[UserBot] Checking existing client connection");
      const connected = await clientInstance.client.checkConnection();
      console.log("[UserBot] Existing client connection status:", connected);

      if (connected) {
        console.log("[UserBot] Reusing existing connected client");
        clientInstance.lastUsed = Date.now();
        clientInstance.connected = true;
        return clientInstance.client;
      }

      // If not connected, try to reconnect
      try {
        console.log("[UserBot] Attempting to reconnect existing client");
        await clientInstance.client.connect();
        console.log("[UserBot] Successfully reconnected existing client");
        clientInstance.lastUsed = Date.now();
        clientInstance.connected = true;
        return clientInstance.client;
      } catch (error) {
        console.error("[UserBot] Failed to reconnect existing client:", error);
        // If reconnection fails, proceed to create new client
      }
    }

    // Create new client
    console.log("[UserBot] Creating new client instance");
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

    console.log("[UserBot] Connecting new client");
    await client.connect();
    console.log("[UserBot] Successfully connected new client");

    // Test the connection by getting account info
    try {
      const me = await client.getMe();
      console.log("[UserBot] Successfully retrieved account info:", {
        id: me?.id,
        username: me?.username,
        firstName: me?.firstName,
      });
    } catch (error) {
      console.error("[UserBot] Failed to get account info:", error);
      throw error;
    }

    // Store the new client instance
    clientInstance.client = client;
    clientInstance.session = session;
    clientInstance.lastUsed = Date.now();
    clientInstance.connected = true;

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
      clientInstance.connected = false;
      clientInstance.lastUsed = 0;
      console.log("[UserBot] Client disconnected successfully");
    } catch (error) {
      console.error("[UserBot] Error disconnecting client:", error);
    }
  }
}