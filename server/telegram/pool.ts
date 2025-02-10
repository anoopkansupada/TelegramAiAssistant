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
  lastFloodWait?: number;
  dcId?: number;
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
  private clients: Map<number, PooledClient> = new Map();
  private readonly maxPoolSize: number = 20;
  private readonly healthCheckInterval: number = 60000; // 1 minute
  private readonly maxErrors: number = 3;
  private readonly encryptionKey: Buffer;
  private readonly MAX_FLOOD_WAIT = 3600; // 1 hour threshold for extreme flood wait

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
    if (health.lastFloodWait && health.lastFloodWait > this.MAX_FLOOD_WAIT) {
      return false;
    }
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

    const decryptedSession = await this.decryptSession(storedSession.sessionString);
    const stringSession = new StringSession(decryptedSession);

    const client = new TelegramClient(
      stringSession,
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 5,
        useWSS: true,
        maxConcurrentDownloads: 10,
        deviceModel: "TelegramCRM/1.0",
        systemVersion: "Linux",
        appVersion: "1.0.0",
        floodSleepThreshold: 60,
        autoReconnect: true,
        requestRetries: 5,
        retryDelay: 2000,
        useIPV6: false,
        timeout: 30000
      }
    );

    try {
      await client.connect();
      // Test connection by getting nearest DC
      const nearestDc = await client.invoke(new Api.help.GetNearestDc());

      const health: ConnectionHealth = {
        latency: 0,
        errors: 0,
        lastCheck: new Date(),
        status: 'healthy',
        dcId: nearestDc.thisDc
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
    } catch (error: any) {
      if (error.message?.includes('FLOOD_WAIT_')) {
        const waitTime = parseInt(error.message.split('_').pop() || '0');
        logger.warn(`Flood wait during connection: ${waitTime}s`);

        if (waitTime > this.MAX_FLOOD_WAIT) {
          await this.rotateSession(userId);
          throw new Error(`Extreme flood wait encountered (${waitTime}s). Session rotated, please retry.`);
        }
      }
      throw error;
    }
  }

  private async rotateSession(userId: number) {
    logger.info(`Rotating session for user ${userId} due to extreme flood wait`);
    await this.cleanup(userId);
    await storage.deactivateTelegramSession(userId);
  }

  private async cleanupOldConnections() {
    const now = new Date();
    const hour = 60 * 60 * 1000;

    for (const [userId, client] of Array.from(this.clients.entries())) {
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
      for (const [userId, client] of Array.from(this.clients.entries())) {
        try {
          const start = Date.now();
          // Instead of ping, use GetNearestDc as a health check
          await client.client.invoke(new Api.help.GetNearestDc());
          client.health.latency = Date.now() - start;
          client.health.lastCheck = new Date();
          client.health.status = 'healthy';

          // Check DC and update if needed
          const nearestDc = await client.client.invoke(new Api.help.GetNearestDc());
          if (client.health.dcId !== nearestDc.thisDc) {
            logger.info(`DC changed for user ${userId}: ${client.health.dcId} -> ${nearestDc.thisDc}`);
            client.health.dcId = nearestDc.thisDc;
          }
        } catch (error: any) {
          if (error.message?.includes('FLOOD_WAIT_')) {
            const waitTime = parseInt(error.message.split('_').pop() || '0');
            client.health.lastFloodWait = waitTime;
            client.health.status = waitTime > this.MAX_FLOOD_WAIT ? 'error' : 'degraded';
            logger.warn(`Flood wait during health check for user ${userId}: ${waitTime}s`);
          } else {
            client.health.errors++;
            client.health.status = client.health.errors >= this.maxErrors ? 'error' : 'degraded';
            logger.error(`Health check failed for user ${userId}`, error);
          }

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

    const clients = Array.from(this.clients.values());
    if (clients.length > 0) {
      let totalLatency = 0;
      for (const client of clients) {
        status.totalErrors += client.health.errors;
        totalLatency += client.health.latency;
      }
      status.averageLatency = totalLatency / clients.length;
    }

    return status;
  }
}