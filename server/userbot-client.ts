import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { storage } from "./storage";
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class CustomLogger extends Logger {
  private prefix: string;

  constructor(prefix: string = "[UserBot]") {
    super();
    this.prefix = prefix;
  }

  _log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} ${this.prefix} [${LogLevel[level]}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
}

class SessionManager {
  private static ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || randomBytes(32);
  private static IV_LENGTH = 16;

  static async encryptSession(session: string): Promise<string> {
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(session, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const result = Buffer.concat([iv, authTag, encrypted]);
    return result.toString('base64');
  }

  static async decryptSession(encryptedSession: string): Promise<string> {
    const encrypted = Buffer.from(encryptedSession, 'base64');
    const iv = encrypted.slice(0, this.IV_LENGTH);
    const authTag = encrypted.slice(this.IV_LENGTH, this.IV_LENGTH + 16);
    const encryptedText = encrypted.slice(this.IV_LENGTH + 16);
    const decipher = createDecipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedText) + decipher.final('utf8');
  }
}

class TelegramClientManager {
  private static instance: TelegramClientManager;
  private readonly clients = new Map<string, {
    client: TelegramClient;
    lastUsed: Date;
    sessionId: number;
  }>();
  private readonly logger: CustomLogger;

  private constructor() {
    this.logger = new CustomLogger("[TelegramManager]");
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  private async validateSession(client: TelegramClient): Promise<boolean> {
    try {
      await client.getMe();
      return true;
    } catch (error) {
      this.logger.error(`Session validation failed: ${error}`);
      return false;
    }
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    const existingClient = this.clients.get(userId.toString());
    if (existingClient) {
      if (await this.validateSession(existingClient.client)) {
        existingClient.lastUsed = new Date();
        return existingClient.client;
      }
      await this.cleanupClient(userId.toString());
    }

    // Get session from database
    const dbSession = await storage.getTelegramSession(userId);
    if (!dbSession) {
      throw new Error("No active session found");
    }

    try {
      const decryptedSession = await SessionManager.decryptSession(dbSession.sessionString);
      const stringSession = new StringSession(decryptedSession);

      const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        throw new Error("Telegram API credentials are required");
      }

      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        autoReconnect: true,
        useWSS: true,
        deviceModel: "NodeJS",
        systemVersion: "1.0.0",
        appVersion: "1.0.0",
        baseLogger: this.logger,
        timeout: 30000,
        requestRetries: 5,
        floodSleepThreshold: 60,
        useIPV6: false,
      });

      await client.connect();
      await this.validateSession(client);

      this.clients.set(userId.toString(), {
        client,
        lastUsed: new Date(),
        sessionId: dbSession.id
      });

      // Update session last used timestamp
      await storage.updateTelegramSession(dbSession.id, {
        lastUsed: new Date()
      });

      return client;
    } catch (error) {
      this.logger.error(`Failed to initialize client: ${error}`);
      throw error;
    }
  }

  public async cleanupClient(userId: string): Promise<void> {
    const clientInfo = this.clients.get(userId);
    if (clientInfo) {
      try {
        if (clientInfo.client.connected) {
          await clientInfo.client.disconnect();
        }
        await clientInfo.client.destroy();
      } catch (error) {
        this.logger.error(`Error during cleanup: ${error}`);
      } finally {
        this.clients.delete(userId);
        await storage.deactivateTelegramSession(clientInfo.sessionId);
      }
    }
  }

  public async cleanupAllClients(): Promise<void> {
    const userIds = Array.from(this.clients.keys());
    for (const userId of userIds) {
      await this.cleanupClient(userId);
    }
  }

  public isConnected(userId: number): boolean {
    const client = this.clients.get(userId.toString());
    return client?.client.connected || false;
  }

  public getClientMap(): Map<string, { client: TelegramClient; lastUsed: Date; sessionId: number }> {
    return this.clients;
  }
}

export const clientManager = TelegramClientManager.getInstance();

// Start periodic connection checks
setInterval(async () => {
  const logger = new CustomLogger();
  try {
    const clientMap = clientManager.getClientMap();
    const entries = Array.from(clientMap.entries());

    for (const [userId, clientInfo] of entries) {
      if (Date.now() - clientInfo.lastUsed.getTime() > 30 * 60 * 1000) { // 30 minutes
        await clientManager.cleanupClient(userId);
        continue;
      }

      try {
        await clientInfo.client.getMe();
      } catch (error) {
        logger.error(`Connection check failed for user ${userId}: ${error}`);
        await clientManager.cleanupClient(userId);
      }
    }
  } catch (error) {
    logger.error(`Error in connection check: ${error}`);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export async function disconnectClient(userId: number): Promise<void> {
  const logger = new CustomLogger();
  try {
    await clientManager.cleanupClient(userId.toString());
    logger.info(`Client disconnected successfully for user ${userId}`);
  } catch (error) {
    logger.error(`Error disconnecting client for user ${userId}: ${error}`);
  }
}

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
  const logger = new CustomLogger();
  try {
    const clientMap = clientManager.getClientMap();
    const entries = Array.from(clientMap.entries());

    for (const [userId, clientInfo] of entries) {
      const connected = clientManager.isConnected(parseInt(userId));
      const user = connected ? await clientInfo.client.getMe() : undefined;

      logger.info(`Connection status for user ${userId}: ${connected}`);

      global.broadcastStatus?.({
        type: 'status',
        connected,
        user: user ? {
          id: user.id.toString(),
          username: user.username,
          firstName: user.firstName
        } : undefined,
        lastChecked: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error(`Error in status check: ${error instanceof Error ? error.message : String(error)}`);
    global.broadcastStatus?.({
      type: 'status',
      connected: false,
      lastChecked: new Date().toISOString()
    });
  }
}

// Start periodic status checks
setInterval(checkAndBroadcastStatus, 30 * 1000);