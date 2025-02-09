import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { Logger, LogLevel } from "telegram/extensions/Logger";

// Client management singleton
class TelegramClientManager {
  private static instance: TelegramClientManager;
  private client: TelegramClient | null = null;
  private session: string | null = null;
  private connected: boolean = false;
  private logger: CustomLogger;

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
  }

  public async getClient(session?: string): Promise<TelegramClient> {
    try {
      // If we have a client and the session matches, reuse it
      if (this.client && this.session === session) {
        try {
          const me = await this.client.getMe();
          if (me) {
            this.logger.info("Reusing existing client");
            return this.client;
          }
        } catch (error) {
          this.logger.warn("Existing client check failed, cleaning up");
          await this.cleanup();
        }
      }

      // If we get here, we need a new client
      await this.cleanup();

      const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        throw new Error("Telegram API credentials are required");
      }

      const stringSession = new StringSession(session || "");
      this.logger.info("Creating new client");

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false,
        deviceModel: "Desktop",
        systemVersion: "Windows 10",
        appVersion: "1.0.0",
        baseLogger: this.logger,
      });

      await this.client.connect();
      this.session = session || null;
      this.connected = true;

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

// Custom logger implementation
class CustomLogger implements Logger {
  private prefix: string;
  private _logLevel: LogLevel = LogLevel.INFO;

  constructor(prefix: string = "[UserBot]") {
    this.prefix = prefix;
  }

  private formatLog(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${this.prefix} [${LogLevel[level]}] ${message}`;
  }

  get logLevel(): LogLevel {
    return this._logLevel;
  }

  set logLevel(level: LogLevel) {
    this._logLevel = level;
  }

  log(level: LogLevel, message: string): void {
    if (level >= this._logLevel) {
      const formattedMessage = this.formatLog(level, message);
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

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  setLevel(level: LogLevel): void {
    this._logLevel = level;
  }

  getLevel(): LogLevel {
    return this._logLevel;
  }

  canSend(level: LogLevel): boolean {
    return level >= this._logLevel;
  }

  getDateTime(): string {
    return new Date().toISOString();
  }

  format(level: LogLevel, message: string): string {
    return this.formatLog(level, message);
  }

  readonly tzOffset: number = new Date().getTimezoneOffset() * 60;
  readonly basePath: string = "./logs";
  readonly levels = {
    NONE: LogLevel.NONE,
    ERROR: LogLevel.ERROR,
    INFO: LogLevel.INFO,
    DEBUG: LogLevel.DEBUG
  };
  readonly colors = true;
  readonly isBrowser = false;
  readonly messageFormat = "[%level] %message";
}

export const clientManager = TelegramClientManager.getInstance();

// Check connection and broadcast status
async function checkAndBroadcastStatus() {
  const logger = new CustomLogger();
  try {
    if (clientManager.isConnected()) {
      logger.debug("Checking connection status...");
      try {
        const me = await clientManager.getClient().getMe();
        if (me) {
          logger.info(`Connection active for user: ${me.username}`);
          global.broadcastStatus?.({
            type: 'status',
            connected: true,
            user: {
              id: me.id?.toString() || '',
              username: me.username || '',
              firstName: me.firstName
            },
            lastChecked: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn("Connection check failed");
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

export async function disconnectClient(): Promise<void> {
  const logger = new CustomLogger();
  try {
    await clientManager.cleanup();
    logger.info("Client disconnected successfully");
  } catch (error) {
    logger.error(`Error disconnecting client: ${error instanceof Error ? error.message : String(error)}`);
  }
}