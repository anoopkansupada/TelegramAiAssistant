import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { PgTable } from 'drizzle-orm/pg-core';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create separate pools for auth and CRM databases
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Add error handler to the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Create the Drizzle instance with retry wrapper
const drizzleDb = drizzle(pool, { schema });

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

// Export the enhanced db instance with retry capabilities
export const db = {
  ...drizzleDb,
  execute: async <T>(query: Parameters<typeof drizzleDb.execute>[0]): Promise<T> => {
    return withRetry(() => drizzleDb.execute(query) as Promise<T>);
  },
  insert: <T extends PgTable>(table: T) => ({
    values: (values: any) => ({
      returning: () => ({
        execute: async () => withRetry(() => 
          drizzleDb.insert(table).values(values).returning().execute()
        )
      })
    })
  }),
  update: <T extends PgTable>(table: T) => ({
    set: (values: any) => ({
      where: (condition: any) => ({
        returning: () => ({
          execute: async () => withRetry(() => 
            drizzleDb.update(table).set(values).where(condition).returning().execute()
          )
        })
      })
    })
  }),
  delete: <T extends PgTable>(table: T) => ({
    where: (condition: any) => ({
      returning: () => ({
        execute: async () => withRetry(() => 
          drizzleDb.delete(table).where(condition).returning().execute()
        )
      })
    })
  }),
  transaction: async <T>(
    callback: (tx: typeof drizzleDb) => Promise<T>
  ): Promise<T> => {
    return withRetry(() => drizzleDb.transaction(callback));
  }
};