import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { Logger, LogLevel } from "telegram/extensions/Logger";

interface ClientInstance {
  client: TelegramClient | null;
  session: string | null;
  lastUsed: number;
  connected: boolean;
}

// Global client instance
const clientInstance: ClientInstance = {
  client: null,
  session: null,
  lastUsed: 0,
  connected: false
};

// Connection check interval (30 seconds)
const CONNECTION_CHECK_INTERVAL = 30 * 1000;

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

// Custom logger implementation that extends Logger
class CustomLogger extends Logger {
  private prefix: string;
  private _logLevel: LogLevel = LogLevel.INFO;

  constructor(prefix: string = "[UserBot]") {
    super();
    this.prefix = prefix;
  }

  private formatLog(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${this.prefix} [${LogLevel[level]}] ${message}`;
  }

  log(level: LogLevel, message: string): void {
    const formattedMessage = this.formatLog(level, message);
    switch (level) {
      case LogLevel.DEBUG:
        console.debug('\x1b[90m' + formattedMessage + '\x1b[0m');
        break;
      case LogLevel.INFO:
        console.info('\x1b[32m' + formattedMessage + '\x1b[0m');
        break;
      case LogLevel.WARNING:
        console.warn('\x1b[33m' + formattedMessage + '\x1b[0m');
        break;
      case LogLevel.ERROR:
        console.error('\x1b[31m' + formattedMessage + '\x1b[0m');
        break;
      default:
        console.log(formattedMessage);
    }
  }

  setLevel(level: LogLevel): void {
    this._logLevel = level;
  }

  getLevel(): LogLevel {
    return this._logLevel;
  }

  debug(message: string): void {
    if (this._logLevel <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message);
    }
  }

  info(message: string): void {
    if (this._logLevel <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message);
    }
  }

  warn(message: string): void {
    if (this._logLevel <= LogLevel.WARNING) {
      this.log(LogLevel.WARNING, message);
    }
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  // Required by Logger interface
  get canSend(): boolean {
    return true;
  }

  get tzOffset(): number {
    return new Date().getTimezoneOffset() * 60;
  }

  getDateTime(): string {
    return new Date().toISOString();
  }
}

// Type-safe broadcast status function
declare global {
  var broadcastStatus: (status: StatusUpdate) => void;
}

export async function getOrCreateClient(session: string): Promise<TelegramClient> {
  const logger = new CustomLogger();

  try {
    logger.info("Starting client initialization...");
    logger.debug(`Client instance state: hasClient=${!!clientInstance.client}, connected=${clientInstance.connected}`);

    // If we already have a client with the same session, reuse it
    if (clientInstance.client && clientInstance.session === session) {
      logger.info("Found existing client, verifying connection...");
      try {
        const me = await clientInstance.client.getMe();
        if (me) {
          logger.info(`Existing client is connected for user: ${me.username}`);
          clientInstance.lastUsed = Date.now();
          clientInstance.connected = true;
          return clientInstance.client;
        }
      } catch (error) {
        logger.warn("Existing client check failed, attempting reconnection");
        try {
          await clientInstance.client.connect();
          const me = await clientInstance.client.getMe();
          if (me) {
            logger.info(`Successfully reconnected for user: ${me.username}`);
            clientInstance.lastUsed = Date.now();
            clientInstance.connected = true;
            return clientInstance.client;
          }
        } catch (reconnectError) {
          logger.error("Failed to reconnect existing client");
          // Proceed to create new client
        }
      }
    }

    // Create new client
    logger.info("Creating new client instance");
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "", 10);
    const apiHash = process.env.TELEGRAM_API_HASH;

    if (!apiId || !apiHash) {
      throw new Error("Telegram API credentials are required");
    }

    const stringSession = new StringSession(session);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
      deviceModel: "Desktop",
      systemVersion: "Windows 10",
      appVersion: "1.0.0",
      baseLogger: logger
    });

    logger.info("Connecting new client");
    await client.connect();

    // Test the connection
    const me = await client.getMe();
    if (!me) {
      throw new Error("Failed to get user info after connection");
    }

    logger.info(`Successfully connected for user: ${me.username}`);

    // Test dialog retrieval
    const dialogs = await client.getDialogs({ limit: 1 });
    logger.info(`Successfully retrieved ${dialogs.length} test dialog(s)`);

    // Store the new client instance
    clientInstance.client = client;
    clientInstance.session = session;
    clientInstance.lastUsed = Date.now();
    clientInstance.connected = true;

    return client;
  } catch (error) {
    logger.error(`Error in getOrCreateClient: ${error}`);
    throw error;
  }
}

// Check connection and broadcast status
async function checkAndBroadcastStatus() {
  const logger = new CustomLogger();
  try {
    if (clientInstance.client && clientInstance.connected) {
      logger.debug("Checking connection status...");
      try {
        const me = await clientInstance.client.getMe();
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
          clientInstance.connected = true;
        }
      } catch (error) {
        logger.warn("Connection check failed");
        clientInstance.connected = false;
        global.broadcastStatus?.({
          type: 'status',
          connected: false,
          lastChecked: new Date().toISOString()
        });
      }
    } else if (clientInstance.client) {
      logger.warn("Client exists but not connected");
      global.broadcastStatus?.({
        type: 'status',
        connected: false,
        lastChecked: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error(`Error in status check: ${error}`);
    global.broadcastStatus?.({
      type: 'status',
      connected: false,
      lastChecked: new Date().toISOString()
    });
  }
}

// Start periodic status checks
setInterval(checkAndBroadcastStatus, CONNECTION_CHECK_INTERVAL);

export async function disconnectClient(): Promise<void> {
  const logger = new CustomLogger();
  if (clientInstance.client) {
    try {
      await clientInstance.client.disconnect();
      clientInstance.client = null;
      clientInstance.session = null;
      clientInstance.connected = false;
      clientInstance.lastUsed = 0;
      logger.info("Client disconnected successfully");
    } catch (error) {
      logger.error(`Error disconnecting client: ${error}`);
    }
  }
}