import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";

interface ConnectionPoolItem {
  client: TelegramClient;
  dcId: number;
  lastUsed: Date;
  isConnected: boolean;
}

export class TelegramConnectionManager {
  private static instance: TelegramConnectionManager;
  private connectionPool: Map<number, ConnectionPoolItem[]> = new Map();
  private readonly maxPoolSize = 5;
  private readonly maxRetries = 3;
  private readonly logger = new CustomLogger('ConnectionManager');

  private constructor() {}

  static getInstance(): TelegramConnectionManager {
    if (!this.instance) {
      this.instance = new TelegramConnectionManager();
    }
    return this.instance;
  }

  async getConnection(apiId: number, apiHash: string, session?: string): Promise<TelegramClient> {
    try {
      const stringSession = session ? new StringSession(session) : new StringSession('');
      const client = new TelegramClient(
        stringSession,
        apiId,
        apiHash,
        {
          connectionRetries: this.maxRetries,
          useWSS: true,
          deviceModel: "TelegramCRM/1.0",
          systemVersion: "Linux",
          appVersion: "1.0.0"
        }
      );

      // Wrap connection with flood protection
      await this.connectWithFloodProtection(client);
      return client;
    } catch (error) {
      this.logger.error('Error creating Telegram client:', error);
      throw error;
    }
  }

  private async connectWithFloodProtection(client: TelegramClient): Promise<void> {
    let retries = 0;
    const maxRetries = this.maxRetries;

    while (retries < maxRetries) {
      try {
        if (!client.connected) {
          await client.connect();
        }
        return;
      } catch (error: any) {
        if (error.message?.includes('FLOOD_WAIT_')) {
          const waitTime = parseInt(error.message.split('_').pop() || '0');

          // For extreme flood waits (>1 hour), use fallback strategy
          if (waitTime > 3600) {
            this.logger.error(`Extreme flood wait detected: ${waitTime}s`);
            await this.handleExtremeFloodWait(client);
            continue;
          }

          this.logger.error(`Flood wait triggered: ${waitTime}s (Retry ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, Math.min(waitTime * 1000, 300000))); // Max 5 minute wait
          retries++;
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max connection retries exceeded');
  }

  private async handleExtremeFloodWait(client: TelegramClient): Promise<void> {
    // Implement DC rotation logic
    try {
      await client.disconnect();
      await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minute cooldown
      await client.connect();
    } catch (error) {
      this.logger.error('Error during extreme flood wait handling:', error);
      throw error;
    }
  }

  async validateSession(client: TelegramClient): Promise<boolean> {
    try {
      // Try to get self user as session validation
      await client.getMe();
      return true;
    } catch (error: any) {
      if (error.message?.includes('FLOOD_WAIT_')) {
        this.logger.error(`Flood wait during session validation: ${error.message}`);
        return false;
      }
      return false;
    }
  }
}