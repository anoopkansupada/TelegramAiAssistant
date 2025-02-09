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

// Connection check interval (30 seconds for more responsive status updates)
const CONNECTION_CHECK_INTERVAL = 30 * 1000;

interface StatusUpdate {
  type: 'status';
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}

// Type-safe broadcast status function
declare global {
  var broadcastStatus: (status: StatusUpdate) => void;
}

export async function getOrCreateClient(session: string): Promise<TelegramClient> {
  try {
    console.log("[UserBot] Starting client initialization...");
    console.log("[UserBot] Client instance state:", {
      hasClient: !!clientInstance.client,
      currentSession: clientInstance.session?.slice(0, 10) + "...",
      newSession: session.slice(0, 10) + "...",
      lastUsed: new Date(clientInstance.lastUsed).toISOString(),
      connected: clientInstance.connected
    });

    // If we already have a client with the same session, reuse it
    if (clientInstance.client && clientInstance.session === session) {
      console.log("[UserBot] Found existing client, verifying connection...");
      try {
        const me = await clientInstance.client.getMe();
        console.log("[UserBot] Existing client is connected, user:", {
          id: me?.id,
          username: me?.username,
          firstName: me?.firstName
        });
        clientInstance.lastUsed = Date.now();
        clientInstance.connected = true;
        return clientInstance.client;
      } catch (error) {
        console.log("[UserBot] Existing client check failed:", error);
        // If check fails, try to reconnect
        try {
          console.log("[UserBot] Attempting to reconnect existing client");
          await clientInstance.client.connect();
          const me = await clientInstance.client.getMe();
          console.log("[UserBot] Successfully reconnected existing client, user:", {
            id: me?.id,
            username: me?.username,
            firstName: me?.firstName
          });
          clientInstance.lastUsed = Date.now();
          clientInstance.connected = true;
          return clientInstance.client;
        } catch (error) {
          console.error("[UserBot] Failed to reconnect existing client:", error);
          // If reconnection fails, proceed to create new client
        }
      }
    }

    // Create new client
    console.log("[UserBot] Creating new client instance");
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
    const apiHash = process.env.TELEGRAM_API_HASH;

    if (!apiId || !apiHash) {
      throw new Error("Telegram API credentials are required");
    }

    console.log("[UserBot] Initializing with credentials:", {
      apiId: apiId,
      hasApiHash: !!apiHash,
      sessionLength: session.length
    });

    const stringSession = new StringSession(session);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
      deviceModel: "Desktop",
      systemVersion: "Windows 10",
      appVersion: "1.0.0",
      baseLogger: console
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

      // Add additional connection test by fetching dialogs
      console.log("[UserBot] Testing dialog retrieval...");
      const dialogs = await client.getDialogs({
        limit: 1
      });
      console.log("[UserBot] Successfully retrieved test dialog:", {
        dialogCount: dialogs.length,
        firstDialog: dialogs[0] ? {
          name: dialogs[0].name,
          type: dialogs[0].entity?.className
        } : 'No dialogs found'
      });

    } catch (error) {
      console.error("[UserBot] Failed to get account info or test dialogs:", error);
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

// Check connection and broadcast status
async function checkAndBroadcastStatus() {
  try {
    if (clientInstance.client && clientInstance.connected) {
      console.log("[UserBot] Checking connection status...");
      try {
        const me = await clientInstance.client.getMe();
        console.log("[UserBot] Connection active, user:", {
          id: me?.id,
          username: me?.username
        });

        if (global.broadcastStatus) {
          global.broadcastStatus({
            type: 'status',
            connected: true,
            user: {
              id: me?.id?.toString() || '',
              username: me?.username || '',
              firstName: me?.firstName
            },
            lastChecked: new Date().toISOString()
          });
        }
        clientInstance.connected = true;
      } catch (error) {
        console.log("[UserBot] Connection check failed:", error);
        clientInstance.connected = false;
        if (global.broadcastStatus) {
          global.broadcastStatus({
            type: 'status',
            connected: false,
            lastChecked: new Date().toISOString()
          });
        }
      }
    } else if (clientInstance.client) {
      console.log("[UserBot] Client exists but not connected");
      if (global.broadcastStatus) {
        global.broadcastStatus({
          type: 'status',
          connected: false,
          lastChecked: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("[UserBot] Error in status check:", error);
    if (global.broadcastStatus) {
      global.broadcastStatus({
        type: 'status',
        connected: false,
        lastChecked: new Date().toISOString()
      });
    }
  }
}

// Start periodic status checks
setInterval(checkAndBroadcastStatus, CONNECTION_CHECK_INTERVAL);

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