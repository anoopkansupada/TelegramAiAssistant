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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Add error handler to the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Create the Drizzle instance
export const db = drizzle(pool, { schema });

// Wrapper function for retrying database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      attempts++;

      // Check if error is recoverable
      if (error.code === '57P01' || // Admin shutdown 
          error.code === '08006' || // Connection failure
          error.code === '08001' || // Unable to establish connection
          error.code === '08004') { // Rejected connection

        console.warn(`Database operation failed (attempt ${attempts}/${maxRetries}):`, error.message);

        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}

// Export db with retry wrapper
export const dbWithRetry = {
  ...db,
  query: async (...args: Parameters<typeof db.query>) => {
    return withRetry(() => db.query(...args));
  },
  insert: async (...args: Parameters<typeof db.insert>) => {
    return withRetry(() => db.insert(...args));
  },
  update: async (...args: Parameters<typeof db.update>) => {
    return withRetry(() => db.update(...args));
  },
  delete: async (...args: Parameters<typeof db.delete>) => {
    return withRetry(() => db.delete(...args));
  },
  transaction: async (...args: Parameters<typeof db.transaction>) => {
    return withRetry(() => db.transaction(...args));
  }
};

export { dbWithRetry as db };