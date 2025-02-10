import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./utils/logger";
import { storage } from "./storage";
import { EventEmitter } from "events";

const logger = new CustomLogger("[UserBot]");

// Connection state events
const Events = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
  RATE_LIMITED: 'rate_limited'
} as const;

interface ClientConfig {
  connectionRetries: number;
  retryDelay: number;
  maxConcurrentDownloads: number;
  deviceModel: string;
  systemVersion: string;
  appVersion: string;
  useWSS: boolean;
  timeout?: number;
  floodSleepThreshold?: number;
}

class TelegramClientManager extends EventEmitter {
  private static instance: TelegramClientManager;
  private clients: Map<number, TelegramClient>;
  private connecting: Set<number>;
  private rateLimitedUsers: Map<number, number>; // userId -> retry after timestamp
  private config: ClientConfig;

  private constructor() {
    super();
    this.clients = new Map();
    this.connecting = new Set();
    this.rateLimitedUsers = new Map();
    this.config = {
      connectionRetries: 5,
      retryDelay: 1000,
      maxConcurrentDownloads: 10,
      deviceModel: "TelegramCRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      useWSS: true,
      timeout: 30000,
      floodSleepThreshold: 60 // seconds to wait before retry on flood wait
    };
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  private async createClient(userId: number): Promise<TelegramClient> {
    const session = await storage.getTelegramSession(userId);
    if (!session) {
      throw new Error("No session found for user");
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    if (!apiId || !apiHash) {
      throw new Error("Missing Telegram API credentials");
    }

    const client = new TelegramClient(
      new StringSession(session.sessionString),
      apiId,
      apiHash,
      {
        ...this.config,
        connectionRetries: 1, // We handle retries ourselves
        autoReconnect: false // We handle reconnection
      }
    );

    return client;
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    // Check rate limits first
    const rateLimitUntil = this.rateLimitedUsers.get(userId);
    if (rateLimitUntil && rateLimitUntil > Date.now()) {
      const waitSeconds = Math.ceil((rateLimitUntil - Date.now()) / 1000);
      throw new Error(`Rate limited. Please wait ${waitSeconds} seconds`);
    }

    // Return existing connected client
    const existingClient = this.clients.get(userId);
    if (existingClient) {
      try {
        await existingClient.getMe();
        return existingClient;
      } catch (error) {
        await this.disconnectClient(userId);
      }
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connecting.has(userId)) {
      throw new Error("Connection already in progress");
    }

    this.connecting.add(userId);

    try {
      const client = await this.createClient(userId);
      await this.connectWithRetry(client, userId);

      this.clients.set(userId, client);
      this.emit(Events.CONNECTED, userId);

      return client;
    } finally {
      this.connecting.delete(userId);
    }
  }

  private async connectWithRetry(client: TelegramClient, userId: number, attempt = 1): Promise<void> {
    try {
      await client.connect();
      const me = await client.getMe();

      if (!me) {
        throw new Error("Failed to get user info after connection");
      }

      // Update session last used timestamp
      const session = await storage.getTelegramSession(userId);
      if (session) {
        await storage.updateTelegramSession(session.id, {
          lastUsed: new Date(),
          isActive: true,
          retryCount: 0
        });
      }

      // Clear rate limit if connection successful
      this.rateLimitedUsers.delete(userId);

    } catch (error: any) {
      logger.error(`Connection attempt ${attempt} failed`, { error: error.message, userId });

      // Handle rate limiting
      if (error.code === 420) { // FLOOD_WAIT
        const waitSeconds = error.seconds || this.config.floodSleepThreshold;
        const retryAfter = Date.now() + (waitSeconds * 1000);

        this.rateLimitedUsers.set(userId, retryAfter);
        this.emit(Events.RATE_LIMITED, { userId, waitSeconds });

        throw error;
      }

      if (attempt < this.config.connectionRetries) {
        this.emit(Events.RECONNECTING, { userId, attempt });
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt - 1)));
        return this.connectWithRetry(client, userId, attempt + 1);
      }

      throw error;
    }
  }

  public async disconnectClient(userId: number): Promise<void> {
    const client = this.clients.get(userId);
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        logger.error('Error disconnecting client:', error);
      } finally {
        this.clients.delete(userId);
        this.emit(Events.DISCONNECTED, userId);
      }
    }
  }

  public async cleanupAllClients(): Promise<void> {
    const disconnections = Array.from(this.clients.keys()).map(userId =>
      this.disconnectClient(userId)
    );
    await Promise.all(disconnections);
  }

  public isConnected(userId: number): boolean {
    return this.clients.has(userId);
  }

  public isRateLimited(userId: number): boolean {
    const rateLimitUntil = this.rateLimitedUsers.get(userId);
    return rateLimitUntil !== undefined && rateLimitUntil > Date.now();
  }

  public getRateLimitExpiry(userId: number): number | null {
    const rateLimitUntil = this.rateLimitedUsers.get(userId);
    return rateLimitUntil || null;
  }

  public getConnectionStats() {
    return {
      activeConnections: this.clients.size,
      pendingConnections: this.connecting.size,
      rateLimitedUsers: this.rateLimitedUsers.size
    };
  }

  // Status broadcast
  private broadcastStatus() {
    const stats = this.getConnectionStats();
    global.broadcastStatus?.({
      type: 'status',
      connected: stats.activeConnections > 0,
      lastChecked: new Date().toISOString(),
      metrics: {
        activeConnections: stats.activeConnections,
        pendingConnections: stats.pendingConnections,
        rateLimitedUsers: stats.rateLimitedUsers
      }
    });
  }

  // Set up status broadcasting
  public startStatusBroadcast(interval = 30000) {
    setInterval(() => this.broadcastStatus(), interval);
  }
}

export const clientManager = TelegramClientManager.getInstance();

// Handle process termination
process.once("SIGINT", () => clientManager.cleanupAllClients());
process.once("SIGTERM", () => clientManager.cleanupAllClients());

// Start status broadcasting
clientManager.startStatusBroadcast();

// Export for use in other modules
export { clientManager as default };