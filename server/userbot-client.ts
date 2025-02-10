import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "./utils/logger";
import { storage } from "./storage";
import * as crypto from 'crypto';

const logger = new CustomLogger("[UserBot]");

interface ConnectionMetrics {
  latency: number;
  errors: number;
  lastUsed: Date;
}

class TelegramPool {
  private static instance: TelegramPool;
  private clients: Map<number, {
    client: TelegramClient;
    metrics: ConnectionMetrics;
  }>;
  private maxPoolSize: number = 10;
  private connectionTimeout: number = 30000; // 30 seconds

  private constructor() {
    this.clients = new Map();
  }

  public static getInstance(): TelegramPool {
    if (!TelegramPool.instance) {
      TelegramPool.instance = new TelegramPool();
    }
    return TelegramPool.instance;
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
        connectionRetries: 5,
        useWSS: true,
        maxConcurrentDownloads: 10,
        deviceModel: "Replit CRM",
        systemVersion: "1.0.0",
        appVersion: "1.0.0",
        retryDelay: 1000
      }
    );

    try {
      await client.connect();
      const me = await client.getMe();
      if (!me) {
        throw new Error("Failed to get user info after connection");
      }

      // Update session last used timestamp
      await storage.updateTelegramSession(session.id, {
        lastUsed: new Date(),
        isActive: true,
        retryCount: 0
      });

      return client;
    } catch (error) {
      await client.disconnect();
      throw error;
    }
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    const existingClient = this.clients.get(userId);
    if (existingClient) {
      try {
        // Verify client is still connected
        await existingClient.client.getMe();
        existingClient.metrics.lastUsed = new Date();
        return existingClient.client;
      } catch (error) {
        // Remove invalid client
        await this.cleanup(userId);
      }
    }

    // Check pool size
    if (this.clients.size >= this.maxPoolSize) {
      // Remove least recently used client
      const oldestClient = Array.from(this.clients.entries())
        .sort((a, b) => a[1].metrics.lastUsed.getTime() - b[1].metrics.lastUsed.getTime())[0];
      if (oldestClient) {
        await this.cleanup(oldestClient[0]);
      }
    }

    // Create new client
    const client = await this.createClient(userId);
    this.clients.set(userId, {
      client,
      metrics: {
        latency: 0,
        errors: 0,
        lastUsed: new Date()
      }
    });

    return client;
  }

  public async cleanup(userId: number): Promise<void> {
    const clientData = this.clients.get(userId);
    if (clientData) {
      try {
        await clientData.client.disconnect();
      } catch (error) {
        logger.error('Error disconnecting client:', error);
      }
      this.clients.delete(userId);
    }
  }

  public async getPoolStatus() {
    return {
      activeConnections: this.clients.size,
      totalErrors: Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.metrics.errors, 0),
      averageLatency: Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.metrics.latency, 0) / Math.max(this.clients.size, 1)
    };
  }
}

class TelegramClientManager {
  private static instance: TelegramClientManager;
  private pool: TelegramPool;

  private constructor() {
    this.pool = TelegramPool.getInstance();
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    try {
      return await this.pool.getClient(userId);
    } catch (error) {
      logger.error('Failed to get client from pool', error);
      throw error;
    }
  }

  public async cleanupClient(userId: string): Promise<void> {
    try {
      await this.pool.cleanup(parseInt(userId));
    } catch (error) {
      logger.error('Failed to cleanup client', error);
    }
  }

  public async cleanupAllClients(): Promise<void> {
    const status = await this.pool.getPoolStatus();
    logger.info('Cleaning up all clients', { activeConnections: status.activeConnections });

    const clients = Array.from({ length: status.activeConnections }, (_, i) => i);
    await Promise.all(clients.map(userId => this.cleanupClient(userId.toString())));
  }

  public async isConnected(userId: number): Promise<boolean> {
    try {
      await this.pool.getClient(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async getPoolStatus() {
    return await this.pool.getPoolStatus();
  }
}

export const clientManager = TelegramClientManager.getInstance();

// Handle process termination
process.once("SIGINT", () => clientManager.cleanupAllClients());
process.once("SIGTERM", () => clientManager.cleanupAllClients());

// Status broadcast interface
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

declare global {
  var broadcastStatus: ((status: StatusUpdate) => void) | undefined;
}

// Check connection and broadcast status
async function checkAndBroadcastStatus() {
  try {
    const status = await clientManager.getPoolStatus();

    logger.info('Broadcasting connection status', {
      activeConnections: status.activeConnections,
      totalErrors: status.totalErrors,
      averageLatency: status.averageLatency
    });

    global.broadcastStatus?.({
      type: 'status',
      connected: status.activeConnections > 0,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in status check', error);
    global.broadcastStatus?.({
      type: 'status',
      connected: false,
      lastChecked: new Date().toISOString()
    });
  }
}

// Start periodic status checks
setInterval(checkAndBroadcastStatus, 30 * 1000);

// Export disconnect function
export async function disconnectClient(userId: number): Promise<void> {
  try {
    await clientManager.cleanupClient(userId.toString());
    logger.info('Client disconnected successfully', { userId });
  } catch (error) {
    logger.error('Error disconnecting client', error);
    throw error;
  }
}