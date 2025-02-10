import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { PgTable } from 'drizzle-orm/pg-core';
import { and, eq, sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create the connection pool
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Add error handler to the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Create the Drizzle instance
export const db = drizzle(pool, { schema });

// Wrapper function for database operations
export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      attempts++;

      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

// Export db operations with proper types and error handling
export const dbOps = {
  query: db,
  select: async <T extends PgTable>(table: T) => {
    return withRetry(() => db.select().from(table));
  },
  selectWhere: async <T extends PgTable>(table: T, condition: any) => {
    return withRetry(() => db.select().from(table).where(condition));
  },
  insert: async <T extends PgTable>(table: T, values: any) => {
    return withRetry(() => db.insert(table).values(values).returning());
  },
  update: async <T extends PgTable>(table: T, values: any, condition: any) => {
    return withRetry(() => db.update(table).set(values).where(condition).returning());
  },
  delete: async <T extends PgTable>(table: T, condition: any) => {
    return withRetry(() => db.delete(table).where(condition).returning());
  }
};

export { and, eq, sql };