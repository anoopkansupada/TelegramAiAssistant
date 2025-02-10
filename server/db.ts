import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { PgTable, PgTransaction } from 'drizzle-orm/pg-core';
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
const db = drizzle(pool, { schema });

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
  // Pass through the raw drizzle instance
  ...db,

  // Override query methods with retry wrapper
  query: {
    ...db.query,
    execute: async <T>(queryBuilder: { execute: () => Promise<T> }) => {
      return withRetry(() => queryBuilder.execute());
    }
  },

  // Wrap insert operations with proper types
  insert: <T extends PgTable>(table: T) => {
    const baseInsert = db.insert(table);
    return {
      ...baseInsert,
      values: (values: Parameters<typeof baseInsert.values>[0]) => ({
        returning: () => ({
          execute: async () => {
            return withRetry(() => 
              baseInsert.values(values).returning().execute()
            );
          }
        })
      })
    };
  },

  // Wrap update operations with proper types
  update: <T extends PgTable>(table: T) => {
    const baseUpdate = db.update(table);
    return {
      ...baseUpdate,
      set: (values: Parameters<typeof baseUpdate.set>[0]) => ({
        where: (condition?: Parameters<typeof baseUpdate.where>[0]) => ({
          returning: () => ({
            execute: async () => {
              const query = baseUpdate.set(values);
              if (condition) {
                return withRetry(() => 
                  query.where(condition).returning().execute()
                );
              }
              return withRetry(() => 
                query.returning().execute()
              );
            }
          })
        })
      })
    };
  },

  // Wrap delete operations with proper types
  delete: <T extends PgTable>(table: T) => {
    const baseDelete = db.delete(table);
    return {
      ...baseDelete,
      where: (condition?: Parameters<typeof baseDelete.where>[0]) => ({
        returning: () => ({
          execute: async () => {
            const query = baseDelete;
            if (condition) {
              return withRetry(() => 
                query.where(condition).returning().execute()
              );
            }
            return withRetry(() => 
              query.returning().execute()
            );
          }
        })
      })
    };
  },

  // Wrap transaction operations with proper types
  transaction: async <T>(
    callback: (tx: PgTransaction<typeof schema>) => Promise<T>
  ): Promise<T> => {
    return withRetry(() => db.transaction(callback));
  }
};

// Export the database instance with retry wrapper
export { dbWithRetry as db };