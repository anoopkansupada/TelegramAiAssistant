import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { Logger, LogLevel } from "telegram/extensions/Logger";

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

// Client management singleton with improved session handling
class TelegramClientManager {
  private static instance: TelegramClientManager;
  private client: TelegramClient | null = null;
  private session: string | null = null;
  private connected: boolean = false;
  private logger: CustomLogger;
  private cleanupInProgress: boolean = false;
  private lastConnectionAttempt: number = 0;
  private readonly CONNECTION_RETRY_DELAY = 2000; // 2 seconds

  private constructor() {
    this.logger = new CustomLogger("[TelegramManager]");
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  public async cleanup(): Promise<void> {
    if (this.cleanupInProgress) {
      this.logger.info("Cleanup already in progress, waiting...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    this.cleanupInProgress = true;
    try {
      this.logger.info("Starting client cleanup");
      if (this.client) {
        try {
          if (this.client.connected) {
            this.logger.info("Disconnecting existing client");
            await this.client.disconnect();
          }
          this.logger.info("Destroying existing client");
          await this.client.destroy();
        } catch (error) {
          this.logger.error(`Error during cleanup: ${error}`);
        } finally {
          this.client = null;
          this.session = null;
          this.connected = false;
        }
      }
      this.logger.info("Cleanup completed");
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private async waitForRetryDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastConnectionAttempt;
    if (timeSinceLastAttempt < this.CONNECTION_RETRY_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, this.CONNECTION_RETRY_DELAY - timeSinceLastAttempt)
      );
    }
    this.lastConnectionAttempt = Date.now();
  }

  public async getClient(session?: string): Promise<TelegramClient> {
    try {
      // If we have a client and the session matches, reuse it
      if (this.client && this.session === session && this.connected) {
        try {
          await this.client.getMe();
          this.logger.info("Reusing existing client");
          return this.client;
        } catch (error) {
          this.logger.warn("Existing client check failed, cleaning up");
          await this.cleanup();
        }
      }

      await this.waitForRetryDelay();

      const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        throw new Error("Telegram API credentials are required");
      }

      this.logger.info("Creating new client");
      const stringSession = new StringSession(session || "");

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        autoReconnect: true,
        useWSS: false,
        deviceModel: "NodeJS",
        systemVersion: "1.0.0",
        appVersion: "1.0.0",
        baseLogger: this.logger,
        timeout: 30000,
        requestRetries: 3,
        floodSleepThreshold: 60,
        useIPV6: false,
      });

      // Connect with retry logic
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          this.logger.info(`Connection attempt ${retries + 1}/${maxRetries}`);
          await this.client.connect();
          this.connected = true;
          this.session = session || null;
          this.logger.info("Connection successful");
          break;
        } catch (error) {
          retries++;
          this.logger.error(`Connection attempt ${retries} failed: ${error}`);
          if (retries === maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }

      return this.client;
    } catch (error) {
      this.logger.error(`Error in getClient: ${error}`);
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.connected && this.client !== null;
  }
}

export const clientManager = TelegramClientManager.getInstance();

// Start periodic connection checks
setInterval(async () => {
  const logger = new CustomLogger();
  try {
    if (clientManager.isConnected()) {
      const client = await clientManager.getClient();
      await client.getMe();
    }
  } catch (error) {
    logger.error(`Connection check failed: ${error}`);
    await clientManager.cleanup();
  }
}, 60 * 1000); // Check every minute

export async function disconnectClient(): Promise<void> {
  const logger = new CustomLogger();
  try {
    await clientManager.cleanup();
    logger.info("Client disconnected successfully");
  } catch (error) {
    logger.error(`Error disconnecting client: ${error}`);
  }
}

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
    if (clientManager.isConnected()) {
      logger.debug("Checking connection status...");
      try {
        const client = await clientManager.getClient();
        const me = await client.getMe();
        logger.info(`Connection active for user: ${me?.username}`);
        global.broadcastStatus?.({
          type: 'status',
          connected: true,
          user: {
            id: me?.id?.toString() || '',
            username: me?.username || '',
            firstName: me?.firstName || ''
          },
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        logger.warn("Connection check failed");
        await clientManager.cleanup();
        global.broadcastStatus?.({
          type: 'status',
          connected: false,
          lastChecked: new Date().toISOString()
        });
      }
    } else {
      logger.warn("Client not connected");
      global.broadcastStatus?.({
        type: 'status',
        connected: false,
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