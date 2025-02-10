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
    if (!sessionString || typeof sessionString !== 'string') {
      logger.error('Session string is null or not a string');
      return false;
    }

    try {
      // Must be a valid base64 string
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (!base64Regex.test(sessionString)) {
        logger.error('Session string is not a valid base64 string');
        return false;
      }

      // Telegram session strings have a specific format and minimum length
      if (sessionString.length < 100) {
        logger.error('Session string is too short to be valid');
        return false;
      }

      // Try to decode the base64 string
      try {
        Buffer.from(sessionString, 'base64');
      } catch (e) {
        logger.error('Failed to decode session string as base64');
        return false;
      }

      // Additional Telegram-specific validation
      const decodedSession = Buffer.from(sessionString, 'base64').toString('utf8');
      if (!decodedSession.includes('user') || !decodedSession.includes('dc')) {
        logger.error('Session string missing required Telegram data');
        return false;
      }

      logger.info('Session string passed all validation checks');
      return true;
    } catch (error) {
      logger.error('Error during session string validation:', error);
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

      let sessionString = process.env.TELEGRAM_SESSION;
      let storedSession = null;
      let useTestDc = false;

      logger.info('Attempting to acquire session string...');

      if (!sessionString) {
        logger.info('No environment session found, checking database...');
        storedSession = await storage.getTelegramSession(userId);
        if (!storedSession) {
          logger.error('No session found in database');
          throw new Error('No session found for user');
        }
        try {
          sessionString = await this.decryptSession(storedSession.sessionString);
          useTestDc = storedSession.metadata?.useTestDc || false;
          logger.info('Successfully decrypted stored session');
        } catch (error) {
          logger.error('Failed to decrypt stored session:', error);
          throw new Error('Failed to decrypt stored session');
        }
      }

      // Validate session string
      if (!await this.validateSessionString(sessionString)) {
        const error = new Error('Invalid session string format');
        logger.error('Session validation failed:', error);
        throw error;
      }

      logger.info('Creating new connection with validated session string');
      const stringSession = new StringSession(sessionString);

      const client = new TelegramClient(
        stringSession,
        parseInt(storedSession?.apiId || process.env.TELEGRAM_API_ID!),
        storedSession?.apiHash || process.env.TELEGRAM_API_HASH!,
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
          timeout: 30000,
          useTestDc: useTestDc,
          testServers: useTestDc,
          dcId: useTestDc ? 2 : undefined // Use DC 2 for test mode
        }
      );

      try {
        logger.info('Attempting to connect with Telegram client');
        await client.connect();

        logger.info('Connected, testing connection with GetNearestDc');
        const nearestDc = await client.invoke(new Api.help.GetNearestDc());
        logger.info(`Connected successfully to DC ${nearestDc.thisDc}`);

        const health: ConnectionHealth = {
          latency: 0,
          errors: 0,
          lastCheck: new Date(),
          status: 'healthy',
          dcId: nearestDc.thisDc
        };

        if (!storedSession && process.env.TELEGRAM_SESSION) {
          logger.info('Storing injected session in database');
          const encrypted = await this.encryptSession(process.env.TELEGRAM_SESSION);
          await storage.createTelegramSession({
            userId,
            sessionString: encrypted,
            apiId: process.env.TELEGRAM_API_ID!,
            apiHash: process.env.TELEGRAM_API_HASH!,
            phoneNumber: process.env.TELEGRAM_PHONE_NUMBER!,
            isActive: true,
            retryCount: 0,
            metadata: {
              initializedAt: new Date().toISOString(),
              method: 'injection',
              useTestDc: useTestDc
            }
          });
        }

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
        logger.error('Error while connecting to Telegram:', error);
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
          await this.floodArmor.execute(async () => {
            const start = Date.now();
            await client.client.invoke(new Api.help.GetNearestDc());
            client.health.latency = Date.now() - start;
            client.health.lastCheck = new Date();
            client.health.status = 'healthy';

            const nearestDc = await client.client.invoke(new Api.help.GetNearestDc());
            if (client.health.dcId !== nearestDc.thisDc) {
              logger.info(`DC changed for user ${userId}: ${client.health.dcId} -> ${nearestDc.thisDc}`);
              client.health.dcId = nearestDc.thisDc;
            }
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