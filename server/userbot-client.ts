import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "./utils/logger";
import { TelegramPool } from "./telegram/pool";
import { storage } from "./storage";

const logger = new CustomLogger("[UserBot]");

class TelegramClientManager {
    private static instance: TelegramClientManager;
    private pool: TelegramPool;

    private constructor() {
        this.pool = TelegramPool.getInstance();
    }

    public static getInstance(): TelegramClientManager {
        if (!TelegramClientManager.instance) {
            TelegramClientManager.instance = new TelegramClientManager();
        }
        return TelegramClientManager.instance;
    }

    public async getClient(userId: number): Promise<TelegramClient> {
        try {
            return await this.pool.getClient(userId);
        } catch (error) {
            logger.error('Failed to get client from pool', error);
            throw error;
        }
    }

    public async cleanupClient(userId: string): Promise<void> {
        try {
            await this.pool.cleanup(parseInt(userId));
        } catch (error) {
            logger.error('Failed to cleanup client', error);
        }
    }

    public async cleanupAllClients(): Promise<void> {
        const status = await this.pool.getPoolStatus();
        logger.info('Cleaning up all clients', { activeConnections: status.activeConnections });

        const clients = Array.from({ length: status.activeConnections }, (_, i) => i);
        await Promise.all(clients.map(userId => this.cleanupClient(userId.toString())));
    }

    public isConnected(userId: number): boolean {
        const status = this.pool.getPoolStatus();
        return status.activeConnections > 0;
    }

    public async getPoolStatus() {
        return await this.pool.getPoolStatus();
    }
}

export const clientManager = TelegramClientManager.getInstance();

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
    try {
        const status = await clientManager.getPoolStatus();

        logger.info('Broadcasting connection status', {
            activeConnections: status.activeConnections,
            totalErrors: status.totalErrors,
            averageLatency: status.averageLatency
        });

        global.broadcastStatus?.({
            type: 'status',
            connected: status.activeConnections > 0,
            lastChecked: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error in status check', error);
        global.broadcastStatus?.({
            type: 'status',
            connected: false,
            lastChecked: new Date().toISOString()
        });
    }
}

// Start periodic status checks
setInterval(checkAndBroadcastStatus, 30 * 1000);

// Export disconnect function
export async function disconnectClient(userId: number): Promise<void> {
    try {
        await clientManager.cleanupClient(userId.toString());
        logger.info('Client disconnected successfully', { userId });
    } catch (error) {
        logger.error('Error disconnecting client', error);
        throw error;
    }
}