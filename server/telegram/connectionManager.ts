import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "../utils/logger";

const logger = new CustomLogger("[TelegramClient]");

export class TelegramConnectionManager {
  private static instance: TelegramConnectionManager;
  private client: TelegramClient | null = null;
  private session: string | null = null;

  private constructor() {}

  static getInstance(): TelegramConnectionManager {
    if (!this.instance) {
      this.instance = new TelegramConnectionManager();
    }
    return this.instance;
  }

  async connect(sessionString?: string): Promise<TelegramClient> {
    try {
      if (this.client?.connected) {
        return this.client;
      }

      // Official test configuration for development
      const useTestDc = process.env.NODE_ENV === 'development';
      const apiId = useTestDc ? 17349 : parseInt(process.env.TELEGRAM_API_ID || "0");
      const apiHash = useTestDc ? "344583e45741c457fe1862106095a5eb" : process.env.TELEGRAM_API_HASH || "";

      // Initialize session
      const stringSession = new StringSession(sessionString || "");

      // Create client with recommended settings
      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: true,
        deviceModel: "TelegramCRM",
        systemVersion: "1.0.0",
        appVersion: "1.0.0",
        testServers: useTestDc
      });

      await this.client.connect();
      this.session = sessionString || "";

      return this.client;
    } catch (error) {
      logger.error("Failed to connect:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client?.connected) {
      await this.client.disconnect();
      this.client = null;
      this.session = null;
    }
  }

  async getSession(): Promise<string | null> {
    return this.session;
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }
}