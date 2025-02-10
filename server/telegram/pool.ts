class FloodArmor {
  private lastRequest = 0;
  private requestQueue: Array<() => Promise<void>> = [];

  async execute<T>(request: () => Promise<T>): Promise<T> {
    const delay = Date.now() - this.lastRequest;
    if (delay < 2000) { // 2s between requests
      await new Promise(resolve =>
        setTimeout(resolve, 2000 - delay)
      );
    }

    try {
      const result = await request();
      this.lastRequest = Date.now();
      return result;
    } catch (e: any) {
      if (e.message?.includes('FLOOD_WAIT_')) {
        const waitTime = parseInt(e.message.split('_').pop() || '0');
        console.error(`🚨 Flood wait triggered: ${waitTime}s`);
        throw e;
      }
      throw e;
    }
  }
}

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
  private floodArmor: FloodArmor;

  private constructor() {
    this.clients = new Map();
    this.encryptionKey = Buffer.from(process.env.SESSION_ENCRYPTION_KEY!, 'hex');
    this.floodArmor = new FloodArmor();
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

  private async validateSessionString(sessionString: string): Promise<boolean> {
    try {
      logger.info('Starting session string validation');

      if (!sessionString || typeof sessionString !== 'string') {
        logger.error('Session string is null or not a string');
        return false;
      }

      try {
        // Try creating a StringSession - this will validate format
        const stringSession = new StringSession(sessionString);
        const serialized = await stringSession.save();

        if (!serialized) {
          logger.error('Failed to serialize session - invalid format');
          return false;
        }

        // Now check if it's a valid base64 string
        const decodedStr = Buffer.from(serialized, 'base64').toString('utf8');
        const parts = decodedStr.split(':');

        // Valid test session format per Telegram docs
        if (process.env.NODE_ENV === 'development') {
          // Test DC must be 2
          const dcId = parseInt(parts[0]);
          if (dcId !== 2) {
            logger.error(`Invalid test DC ID: ${dcId}, must be 2`);
            return false;
          }
        } else {
          // Production DC must be 1-5
          const dcId = parseInt(parts[0]);
          if (dcId < 1 || dcId > 5) {
            logger.error(`Invalid production DC ID: ${dcId}, must be 1-5`);
            return false;
          }
        }

        logger.info('Session string validated successfully');
        return true;
      } catch (error) {
        logger.error('Failed to validate session string:', error);
        return false;
      }
    } catch (error) {
      logger.error('Validation error:', error);
      return false;
    }
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    return await this.floodArmor.execute(async () => {
      const existing = this.clients.get(userId);
      if (existing && this.isHealthy(existing.health)) {
        existing.lastUsed = new Date();
        return existing.client;
      }

      await this.cleanup(userId);
      return await this.createNewConnection(userId);
    });
  }

  private isHealthy(health: ConnectionHealth): boolean {
    if (health.lastFloodWait && health.lastFloodWait > this.MAX_FLOOD_WAIT) {
      return false;
    }
    return health.status === 'healthy' && health.errors < this.maxErrors;
  }

  private async createNewConnection(userId: number): Promise<TelegramClient> {
    return await this.floodArmor.execute(async () => {
      if (this.clients.size >= this.maxPoolSize) {
        await this.cleanupOldConnections();
      }

      logger.info('Creating new Telegram client connection');
      const useTestDc = process.env.NODE_ENV === 'development';

      // Get session from storage or environment
      let sessionString = process.env.TELEGRAM_SESSION;
      let storedSession = null;

      if (!sessionString) {
        logger.info('No environment session, checking database');
        storedSession = await storage.getTelegramSession(userId);

        if (!storedSession) {
          logger.error('No session found in database');
          throw new Error('No session found for user');
        }

        try {
          sessionString = await this.decryptSession(storedSession.sessionString);
          logger.info('Successfully decrypted stored session');
        } catch (error) {
          logger.error('Failed to decrypt stored session:', error);
          throw error;
        }
      }

      // Validate session string
      if (!await this.validateSessionString(sessionString)) {
        logger.error('Session string validation failed');
        throw new Error('Invalid session string format');
      }

      logger.info('Creating new client with validated session');
      const stringSession = new StringSession(sessionString);

      // Use test configuration in development
      const apiId = useTestDc ? 17349 : parseInt(storedSession?.apiId || process.env.TELEGRAM_API_ID!);
      const apiHash = useTestDc ? "344583e45741c457fe1862106095a5eb" : (storedSession?.apiHash || process.env.TELEGRAM_API_HASH!);

      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: true,
        deviceModel: "TelegramCRM",
        systemVersion: "1.0.0",
        appVersion: "1.0.0",
        useTestDc: useTestDc,
        testServers: useTestDc
      });

      try {
        logger.info('Connecting to Telegram');
        await client.connect();

        // Verify connection by getting DC info
        const nearestDc = await client.invoke(new Api.help.GetNearestDc());
        logger.info(`Connected to DC ${nearestDc.thisDc}`);

        // Initialize health monitoring
        const health: ConnectionHealth = {
          latency: 0,
          errors: 0,
          lastCheck: new Date(),
          status: 'healthy',
          dcId: nearestDc.thisDc
        };

        this.clients.set(userId, {
          client,
          session: sessionString,
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
    });
  }

  private async rotateSession(userId: number) {
    logger.info(`Rotating session for user ${userId}`);
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
        logger.error('Error disconnecting client:', error);
      }
      this.clients.delete(userId);
    }
  }

  private startHealthCheck() {
    setInterval(async () => {
      for (const [userId, client] of Array.from(this.clients.entries())) {
        try {
          await this.floodArmor.execute(async () => {
            const start = Date.now();
            const nearestDc = await client.client.invoke(new Api.help.GetNearestDc());

            client.health.latency = Date.now() - start;
            client.health.lastCheck = new Date();
            client.health.status = 'healthy';
            client.health.dcId = nearestDc.thisDc;

            logger.debug(`Health check passed for user ${userId} (DC: ${nearestDc.thisDc}, latency: ${client.health.latency}ms)`);
          });
        } catch (error: any) {
          if (error.message?.includes('FLOOD_WAIT_')) {
            const waitTime = parseInt(error.message.split('_').pop() || '0');
            client.health.lastFloodWait = waitTime;
            client.health.status = waitTime > this.MAX_FLOOD_WAIT ? 'error' : 'degraded';
            logger.warn(`Flood wait during health check for user ${userId}: ${waitTime}s`);
          } else {
            client.health.errors++;
            client.health.status = client.health.errors >= this.maxErrors ? 'error' : 'degraded';
            logger.error(`Health check failed for user ${userId}:`, error);
          }

          if (client.health.status === 'error') {
            logger.warn(`Cleaning up unhealthy client for user ${userId}`);
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