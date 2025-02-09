import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with retries
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Configure pool with better defaults
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  maxUses: 7500, // Close & replace a connection after it has been used this many times
});

// Add error handler to the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Create the Drizzle instance directly
const drizzleDb = drizzle(pool, { schema });

// Wrapper function for retrying database operations
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is recoverable
      if (error.code === '57P01' || // Admin shutdown
          error.code === '08006' || // Connection failure
          error.code === '08001' || // Unable to establish connection
          error.code === '08004') { // Rejected connection

        console.warn(`Database operation failed (attempt ${i + 1}/${MAX_RETRIES}):`, error.message);

        // Wait before retrying
        if (i < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
          continue;
        }
      }

      // Non-recoverable error or max retries reached
      throw error;
    }
  }

  throw lastError;
}

// Export the db instance with retry wrapper
export const db = new Proxy(drizzleDb, {
  get(target, prop) {
    const value = target[prop as keyof typeof target];

    // Special handling for query builder
    if (prop === 'query') {
      return value;
    }

    // Special handling for transaction
    if (prop === 'transaction') {
      return async (...args: any[]) => withRetry(() => value.apply(target, args));
    }

    // Handle other functions
    if (typeof value === 'function') {
      return async (...args: any[]) => withRetry(() => value.apply(target, args));
    }

    return value;
  }
});