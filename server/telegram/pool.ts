import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { storage } from "../storage";
import * as crypto from 'crypto';

const logger = new CustomLogger("[TelegramPool]");

interface ConnectionHealth {
  latency: number;
  errors: number;
  lastCheck: Date;
  status: 'healthy' | 'degraded' | 'error';
}

interface PooledClient {
  client: TelegramClient;
  session: string;
  userId: number;
  lastUsed: Date;
  health: ConnectionHealth;
  connectTime: Date;
}

export class TelegramPool {
  private static instance: TelegramPool;
  private clients: Map<number, PooledClient>;
  private readonly maxPoolSize: number = 20;
  private readonly healthCheckInterval: number = 60000; // 1 minute
  private readonly maxErrors: number = 3;
  private readonly encryptionKey: Buffer;

  private constructor() {
    this.clients = new Map();
    this.encryptionKey = Buffer.from(process.env.SESSION_ENCRYPTION_KEY!, 'hex');
    this.startHealthCheck();
  }

  public static getInstance(): TelegramPool {
    if (!TelegramPool.instance) {
      TelegramPool.instance = new TelegramPool();
    }
    return TelegramPool.instance;
  }

  private async encryptSession(session: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(session, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private async decryptSession(encryptedSession: string): Promise<string> {
    const data = Buffer.from(encryptedSession, 'base64');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    const existing = this.clients.get(userId);
    if (existing && this.isHealthy(existing.health)) {
      existing.lastUsed = new Date();
      return existing.client;
    }

    await this.cleanup(userId);
    return await this.createNewConnection(userId);
  }

  private isHealthy(health: ConnectionHealth): boolean {
    return health.status === 'healthy' && health.errors < this.maxErrors;
  }

  private async createNewConnection(userId: number): Promise<TelegramClient> {
    if (this.clients.size >= this.maxPoolSize) {
      await this.cleanupOldConnections();
    }

    const storedSession = await storage.getTelegramSession(userId);
    if (!storedSession) {
      throw new Error('No session found for user');
    }

    const decryptedSession = await this.decryptSession(storedSession.session);
    const stringSession = new StringSession(decryptedSession);

    const client = new TelegramClient(
      stringSession,
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 5,
        useWSS: true,
        maxConcurrentDownloads: 10,
      }
    );

    await client.connect();
    const health: ConnectionHealth = {
      latency: 0,
      errors: 0,
      lastCheck: new Date(),
      status: 'healthy'
    };

    this.clients.set(userId, {
      client,
      session: decryptedSession,
      userId,
      lastUsed: new Date(),
      health,
      connectTime: new Date()
    });

    return client;
  }

  private async cleanupOldConnections() {
    const now = new Date();
    const hour = 60 * 60 * 1000;
    
    for (const [userId, client] of this.clients.entries()) {
      if (now.getTime() - client.lastUsed.getTime() > hour) {
        await this.cleanup(userId);
      }
    }
  }

  private async cleanup(userId: number) {
    const client = this.clients.get(userId);
    if (client) {
      try {
        await client.client.disconnect();
      } catch (error) {
        logger.error('Error disconnecting client', error);
      }
      this.clients.delete(userId);
    }
  }

  private startHealthCheck() {
    setInterval(async () => {
      for (const [userId, client] of this.clients.entries()) {
        try {
          const start = Date.now();
          await client.client.ping();
          client.health.latency = Date.now() - start;
          client.health.lastCheck = new Date();
          client.health.status = 'healthy';
        } catch (error) {
          client.health.errors++;
          client.health.status = client.health.errors >= this.maxErrors ? 'error' : 'degraded';
          logger.error(`Health check failed for user ${userId}`, error);

          if (client.health.status === 'error') {
            await this.cleanup(userId);
          }
        }
      }
    }, this.healthCheckInterval);
  }

  public async getPoolStatus(): Promise<{
    activeConnections: number;
    totalErrors: number;
    averageLatency: number;
  }> {
    const status = {
      activeConnections: this.clients.size,
      totalErrors: 0,
      averageLatency: 0
    };

    if (this.clients.size > 0) {
      let totalLatency = 0;
      for (const client of this.clients.values()) {
        status.totalErrors += client.health.errors;
        totalLatency += client.health.latency;
      }
      status.averageLatency = totalLatency / this.clients.size;
    }

    return status;
  }
}
