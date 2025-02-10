import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { storage } from "./storage";
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Enhanced logger with more detailed logging levels
class CustomLogger extends Logger {
  private prefix: string;
  private logLevel: LogLevel = LogLevel.INFO;

  constructor(prefix: string = "[UserBot]", level: LogLevel = LogLevel.INFO) {
    super();
    this.prefix = prefix;
    this.logLevel = level;
  }

  _log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const metadata = args.length ? JSON.stringify(args) : '';
    const formattedMessage = `${timestamp} ${this.prefix} [${LogLevel[level]}] ${message} ${metadata}`.trim();

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARNING:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        // Log additional error context if available
        if (args[0] instanceof Error) {
          console.error(`${timestamp} ${this.prefix} [${LogLevel[level]}] Error Stack:`, args[0].stack);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string, ...args: any[]): void {
    this._log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this._log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this._log(LogLevel.WARNING, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this._log(LogLevel.ERROR, message, ...args);
  }
}

// Rest of the code remains unchanged until TelegramClientManager class

class TelegramClientManager {
  private static instance: TelegramClientManager;
  private readonly clients = new Map<string, {
    client: TelegramClient;
    lastUsed: Date;
    sessionId: number;
    errorCount: number;
    lastError?: Error;
  }>();
  private readonly logger: CustomLogger;

  private constructor() {
    this.logger = new CustomLogger("[TelegramManager]", LogLevel.DEBUG);
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  private async validateSession(client: TelegramClient): Promise<boolean> {
    try {
      const result = await client.getMe();
      this.logger.debug('Session validation successful', { userId: result.id });
      return true;
    } catch (error) {
      this.logger.error('Session validation failed', error);
      if (error instanceof Error) {
        this.logger.error('Validation error details', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  public async getClient(userId: number): Promise<TelegramClient> {
    const userIdStr = userId.toString();
    const existingClient = this.clients.get(userIdStr);

    if (existingClient) {
      this.logger.debug('Found existing client', { userId, lastUsed: existingClient.lastUsed });

      if (await this.validateSession(existingClient.client)) {
        existingClient.lastUsed = new Date();
        existingClient.errorCount = 0; // Reset error count on successful validation
        return existingClient.client;
      }

      this.logger.warn('Existing client failed validation, cleaning up', { userId });
      await this.cleanupClient(userIdStr);
    }

    // Get session from database
    const dbSession = await storage.getTelegramSession(userId);
    if (!dbSession) {
      this.logger.error('No active session found', { userId });
      throw new Error("No active session found");
    }

    try {
      const decryptedSession = await SessionManager.decryptSession(dbSession.sessionString);
      const stringSession = new StringSession(decryptedSession);

      const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        this.logger.error('Missing API credentials');
        throw new Error("Telegram API credentials are required");
      }

      this.logger.info('Initializing new client', { userId, apiId });

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
      const validationResult = await this.validateSession(client);

      if (!validationResult) {
        throw new Error("Failed to validate new client session");
      }

      this.clients.set(userIdStr, {
        client,
        lastUsed: new Date(),
        sessionId: dbSession.id,
        errorCount: 0
      });

      // Update session last used timestamp
      await storage.updateTelegramSession(dbSession.id, {
        lastUsed: new Date()
      });

      this.logger.info('Successfully initialized new client', { userId });
      return client;
    } catch (error) {
      this.logger.error('Failed to initialize client', error);
      if (error instanceof Error) {
        this.logger.error('Initialization error details', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
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

  public getClientMap(): Map<string, { client: TelegramClient; lastUsed: Date; sessionId: number; errorCount: number; lastError?: Error; }> {
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