import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./utils/logger";
import { storage } from "./storage";
import { EventEmitter } from "events";
import { Api } from "telegram/tl";

const logger = new CustomLogger("[UserBot]");

// Enhanced connection states for better state machine
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RATE_LIMITED: 'rate_limited',
  AUTH_KEY_UNREGISTERED: 'auth_key_unregistered',
  MIGRATING: 'migrating'
} as const;

const Events = {
  STATE_CHANGED: 'state_changed',
  SESSION_INVALID: 'session_invalid',
  DC_MIGRATION: 'dc_migration',
  FLOOD_WAIT: 'flood_wait',
  ERROR: 'error'
} as const;

interface ClientConfig {
  connectionRetries: number;
  retryDelay: number;
  maxConcurrentDownloads: number;
  deviceModel: string;
  systemVersion: string;
  appVersion: string;
  useWSS: boolean;
  timeout?: number;
  floodSleepThreshold?: number;
  maxSessionAge?: number;
  priorityLevels?: number;
}

interface QueueItem {
  userId: number;
  priority: number;
  resolve: Function;
  reject: Function;
  timestamp: number;
  dcId?: number;
  layer?: number;
}

class TelegramClientManager extends EventEmitter {
  private static instance: TelegramClientManager;
  private clients: Map<number, { client: TelegramClient; state: string; layer: number }>;
  private dcClients: Map<number, { clients: Set<TelegramClient>; latency: number }>;
  private connectionQueue: QueueItem[];
  private processingQueue: boolean;
  private rateLimits: Map<number, { until: number; dcId: number }>;
  private config: ClientConfig;
  private dcLatencyProbes: Map<number, NodeJS.Timeout>;

  private constructor() {
    super();
    this.clients = new Map();
    this.dcClients = new Map();
    this.connectionQueue = [];
    this.processingQueue = false;
    this.rateLimits = new Map();
    this.dcLatencyProbes = new Map();
    this.config = {
      connectionRetries: 3,
      retryDelay: 2000,
      maxConcurrentDownloads: 5,
      deviceModel: "TelegramCRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      useWSS: true,
      timeout: 30000,
      floodSleepThreshold: 60,
      maxSessionAge: 12 * 60 * 60 * 1000,
      priorityLevels: 3
    };

    // Start DC latency probing
    this.initializeDcProbing();

    // Handle DC migration events with layer awareness
    this.on(Events.DC_MIGRATION, async ({ userId, newDcId, layer }) => {
      await this.handleDcMigration(userId, newDcId, layer);
    });
  }

  public static getInstance(): TelegramClientManager {
    if (!TelegramClientManager.instance) {
      TelegramClientManager.instance = new TelegramClientManager();
    }
    return TelegramClientManager.instance;
  }

  private async handleDcMigration(userId: number, newDcId: number, layer?: number): Promise<void> {
    const clientData = this.clients.get(userId);
    if (!clientData) return;

    try {
      this.updateClientState(userId, ConnectionState.MIGRATING);

      const session = await storage.getTelegramSession(userId);
      if (!session) throw new Error("No session found during DC migration");

      const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
      const apiHash = process.env.TELEGRAM_API_HASH || "";

      // Create new client with layer awareness
      const newClient = new TelegramClient(
        new StringSession(session.sessionString),
        apiId,
        apiHash,
        {
          ...this.config,
          dcId: newDcId,
          connectionRetries: 1,
          autoReconnect: false,
          useIPV6: false,
          floodSleepThreshold: 60,
          deviceModel: `TelegramCRM DC${newDcId}`,
          systemVersion: process.version,
          appVersion: '1.0.0',
          langCode: 'en'
        }
      );

      // Initialize connection with layer negotiation
      await this.initializeClientWithLayer(newClient, layer);

      // Update session with new DC info
      await storage.updateTelegramSession(session.id, {
        sessionString: newClient.session.save() as string,
        lastUsed: new Date(),
        metadata: {
          ...session.metadata,
          lastDcId: newDcId,
          layer: layer || clientData.layer
        }
      });

      // Clean up old client and update maps
      await clientData.client.disconnect();
      this.clients.set(userId, {
        client: newClient,
        state: ConnectionState.CONNECTED,
        layer: layer || clientData.layer
      });

      // Update DC pool
      this.updateDcPool(newDcId, newClient);

    } catch (error) {
      logger.error('DC migration failed:', error);
      this.updateClientState(userId, ConnectionState.DISCONNECTED);
      throw error;
    }
  }

  private async initializeClientWithLayer(client: TelegramClient, preferredLayer?: number): Promise<void> {
    await client.connect();

    if (preferredLayer) {
      try {
        // Attempt to negotiate the preferred layer
        await client.invoke(new Api.InitConnection({
          apiId: parseInt(process.env.TELEGRAM_API_ID || "0"),
          deviceModel: this.config.deviceModel,
          systemVersion: this.config.systemVersion,
          appVersion: this.config.appVersion,
          langCode: 'en',
          systemLangCode: 'en',
          langPack: '',
          query: new Api.help.GetConfig(),
          proxy: undefined,
          params: undefined
        }));
      } catch (error) {
        logger.warn(`Failed to negotiate layer ${preferredLayer}, falling back to default`);
      }
    }
  }

  private async updateDcPool(dcId: number, client: TelegramClient): Promise<void> {
    if (!this.dcClients.has(dcId)) {
      this.dcClients.set(dcId, { clients: new Set(), latency: Infinity });
    }

    const pool = this.dcClients.get(dcId)!;
    pool.clients.add(client);

    // Start latency probing for this DC if not already running
    if (!this.dcLatencyProbes.has(dcId)) {
      this.initializeDcProbing(dcId);
    }
  }

  private async probeDcLatency(dcId: number): Promise<void> {
    const pool = this.dcClients.get(dcId);
    if (!pool || pool.clients.size === 0) return;

    const client = Array.from(pool.clients)[0];
    try {
      const start = Date.now();
      await client.invoke(new Api.Ping({ pingId: BigInt(Math.floor(Math.random() * 1000000)) }));
      const latency = Date.now() - start;
      pool.latency = latency;
    } catch (error) {
      logger.warn(`Failed to probe DC ${dcId} latency:`, error);
      pool.latency = Infinity;
    }
  }

  private initializeDcProbing(dcId?: number): void {
    const probeDc = async (id: number) => {
      await this.probeDcLatency(id);
      // Schedule next probe with jitter
      const jitter = Math.random() * 2000;
      this.dcLatencyProbes.set(id, setTimeout(() => probeDc(id), 30000 + jitter));
    };

    if (dcId) {
      probeDc(dcId);
    } else {
      // Initialize probing for all DCs
      [1, 2, 3, 4, 5].forEach(id => {
        if (this.dcClients.has(id)) probeDc(id);
      });
    }
  }

  private getBestDc(): number {
    let bestDc = 1;
    let bestLatency = Infinity;

    for (const [dcId, { latency }] of this.dcClients) {
      if (latency < bestLatency) {
        bestLatency = latency;
        bestDc = dcId;
      }
    }

    return bestDc;
  }

  private updateClientState(userId: number, state: string): void {
    const clientData = this.clients.get(userId);
    if (clientData) {
      clientData.state = state;
      this.emit(Events.STATE_CHANGED, { userId, state });
    }
  }

  private async processConnectionQueue() {
    if (this.processingQueue || this.connectionQueue.length === 0) return;

    this.processingQueue = true;
    this.connectionQueue.sort((a, b) => {
      // Sort by priority first, then by timestamp
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    while (this.connectionQueue.length > 0) {
      const item = this.connectionQueue[0];

      try {
        // Check rate limits with DC awareness
        const rateLimit = this.rateLimits.get(item.userId);
        if (rateLimit && rateLimit.until > Date.now()) {
          const waitTime = Math.ceil((rateLimit.until - Date.now()) / 1000);
          throw new Error(`Rate limited on DC ${rateLimit.dcId}. Wait ${waitTime}s`);
        }

        const client = await this.createAndConnectClient(item.userId, item.dcId, item.layer);
        item.resolve(client);
      } catch (error: any) {
        if (error.code === 303) { // PHONE_MIGRATE_X
          const newDcId = parseInt(error.message.split('_').pop());
          this.emit(Events.DC_MIGRATION, { userId: item.userId, newDcId, layer: item.layer });
          // Requeue with new DC
          this.connectionQueue.push({
            ...item,
            dcId: newDcId,
            timestamp: Date.now()
          });
        } else {
          item.reject(error);
        }
      } finally {
        this.connectionQueue.shift();
      }

      // Add delay between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processingQueue = false;
  }

  public async getClient(userId: number, priority = 1, layer?: number): Promise<TelegramClient> {
    const clientData = this.clients.get(userId);
    if (clientData && clientData.state === ConnectionState.CONNECTED) {
      try {
        await clientData.client.getMe();
        return clientData.client;
      } catch (error) {
        await this.disconnectClient(userId);
      }
    }

    return new Promise((resolve, reject) => {
      this.connectionQueue.push({
        userId,
        priority: Math.min(Math.max(0, priority), this.config.priorityLevels! - 1),
        resolve,
        reject,
        timestamp: Date.now(),
        layer: layer
      });
      this.processConnectionQueue();
    });
  }

  private async createAndConnectClient(userId: number, preferredDcId?: number, preferredLayer?: number): Promise<TelegramClient> {
    const session = await storage.getTelegramSession(userId);
    if (!session) throw new Error("No session found");

    // Check session age and validity
    if (session.lastUsed &&
        Date.now() - new Date(session.lastUsed).getTime() > this.config.maxSessionAge!) {
      await this.invalidateSession(userId);
      throw new Error("Session expired");
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    if (!apiId || !apiHash) {
      throw new Error("Missing API credentials");
    }

    const client = new TelegramClient(
      new StringSession(session.sessionString),
      apiId,
      apiHash,
      {
        ...this.config,
        dcId: preferredDcId || this.getBestDc(),
        connectionRetries: 1,
        autoReconnect: false,
        useIPV6: false,
        floodSleepThreshold: 60,
        deviceModel: `TelegramCRM DC${preferredDcId || 1}`,
        systemVersion: process.version,
        appVersion: '1.0.0',
        langCode: 'en'
      }
    );

    await this.connectWithRetry(client, userId, preferredLayer);
    this.clients.set(userId, { client, state: ConnectionState.CONNECTED, layer: preferredLayer || session.metadata.layer });

    // Add to DC pool
    const dcId = client.session.dcId;
    this.updateDcPool(dcId, client);

    return client;
  }

  private async connectWithRetry(client: TelegramClient, userId: number, preferredLayer?: number, attempt = 1): Promise<void> {
    try {
      this.updateClientState(userId, ConnectionState.CONNECTING);
      await client.connect();

      const me = await client.getMe();
      if (!me) throw new Error("Failed to get user info");

      // Update session
      const session = await storage.getTelegramSession(userId);
      if (session) {
        await storage.updateTelegramSession(session.id, {
          sessionString: client.session.save() as string,
          lastUsed: new Date(),
          isActive: true,
          retryCount: 0,
          metadata: {
            ...session.metadata,
            lastDcId: client.session.dcId,
            layer: preferredLayer || session.metadata.layer
          }
        });
      }

      this.rateLimits.delete(userId);
      this.updateClientState(userId, ConnectionState.CONNECTED);

    } catch (error: any) {
      logger.error(`Connection attempt ${attempt} failed:`, error);

      if (error.code === 420) { // FLOOD_WAIT
        const waitSeconds = error.seconds || this.config.floodSleepThreshold!;
        this.rateLimits.set(userId, {
          until: Date.now() + (waitSeconds * 1000),
          dcId: client.session.dcId
        });

        this.updateClientState(userId, ConnectionState.RATE_LIMITED);
        this.emit(Events.FLOOD_WAIT, { userId, waitSeconds, dcId: client.session.dcId });
        throw error;
      }

      if (error.code === 401) { // AUTH_KEY_UNREGISTERED
        this.updateClientState(userId, ConnectionState.AUTH_KEY_UNREGISTERED);
        await this.invalidateSession(userId);
        throw error;
      }

      if (attempt < this.config.connectionRetries!) {
        const delay = this.config.retryDelay! * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connectWithRetry(client, userId, preferredLayer, attempt + 1);
      }

      this.updateClientState(userId, ConnectionState.DISCONNECTED);
      throw error;
    }
  }

  private async invalidateSession(userId: number): Promise<void> {
    await storage.deactivateTelegramSession(userId);
    this.emit(Events.SESSION_INVALID, userId);
  }

  public async disconnectClient(userId: number): Promise<void> {
    const clientData = this.clients.get(userId);
    if (clientData) {
      try {
        const dcId = clientData.client.session.dcId;
        await clientData.client.disconnect();
        this.dcClients.get(dcId)?.clients.delete(clientData.client);
      } catch (error) {
        logger.error('Error disconnecting client:', error);
      } finally {
        this.clients.delete(userId);
        this.updateClientState(userId, ConnectionState.DISCONNECTED);
      }
    }
  }

  public async cleanupAllClients(): Promise<void> {
    const disconnections = Array.from(this.clients.keys()).map(userId =>
      this.disconnectClient(userId)
    );
    await Promise.all(disconnections);
    this.dcClients.clear();
    this.dcLatencyProbes.forEach(timeout => clearTimeout(timeout));
  }

  public getDcStats(): Record<number, number> {
    const stats: Record<number, number> = {};
    for (const [dcId, { clients }] of this.dcClients) {
      stats[dcId] = clients.size;
    }
    return stats;
  }

  public getConnectionStats() {
    return {
      activeConnections: this.clients.size,
      queueLength: this.connectionQueue.length,
      rateLimitedUsers: this.rateLimits.size,
      dcStats: this.getDcStats(),
      connectionStates: Array.from(this.clients.entries()).reduce((acc, [userId, data]) => {
        acc[userId] = data.state;
        return acc;
      }, {} as Record<number, string>)
    };
  }

  private broadcastStatus() {
    const stats = this.getConnectionStats();
    (global as any).broadcastStatus?.({
      type: 'status',
      connected: stats.activeConnections > 0,
      lastChecked: new Date().toISOString(),
      metrics: stats
    });
  }

  public startStatusBroadcast(interval = 30000) {
    setInterval(() => this.broadcastStatus(), interval);
  }
}

export const clientManager = TelegramClientManager.getInstance();

// Cleanup on process termination
process.once("SIGINT", async () => {
  for (const timeout of clientManager['dcLatencyProbes'].values()) {
    clearTimeout(timeout);
  }
  await clientManager.cleanupAllClients();
});
process.once("SIGTERM", async () => {
  for (const timeout of clientManager['dcLatencyProbes'].values()) {
    clearTimeout(timeout);
  }
  await clientManager.cleanupAllClients();
});

clientManager.startStatusBroadcast();

export { clientManager as default };