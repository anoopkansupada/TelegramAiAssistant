import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";
import { CustomLogger } from "./utils/logger";
import { db } from "./db";
import { neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { TelegramConnectionManager } from "./telegram/connectionManager";

// Configure detailed logging
const logger = new CustomLogger("[Server]");

dotenv.config();

// Configure neon to handle WebSocket errors gracefully
(neonConfig as any).wssClosed = () => {
  logger.warn("Database connection closed, will attempt reconnect automatically");
};

(neonConfig as any).wssError = (error: Error) => {
  logger.error("Database connection error:", error);
};

async function initializeTelegramClient(): Promise<TelegramClient | null> {
  try {
    logger.info("🟢 Initializing Telegram client");
    const manager = TelegramConnectionManager.getInstance();
    const client = await manager.connect();
    return client;
  } catch (error) {
    logger.error("❌ Error initializing Telegram client:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    return null;
  }
}

async function startServer() {
  try {
    logger.info("🟢 Starting server initialization");

    // Test database connection
    const result = await db.execute(sql`SELECT 1`);
    if (!result) throw new Error("Database connection failed");
    logger.info("✅ Database connection successful");

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use(express.urlencoded({ extended: false }));

    // Enhanced logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
          if (capturedJsonResponse) {
            logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
          }

          if (logLine.length > 80) {
            logLine = logLine.slice(0, 79) + "…";
          }

          logger.debug(logLine);
        }
      });

      next();
    });

    // Initialize Telegram client
    await initializeTelegramClient();

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      logger.error("Error:", err);
    });

    if (process.env.NODE_ENV === "development") {
      await setupVite(app);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`🟢 Server started, serving on port ${PORT}`);
    });

    return server;
  } catch (error) {
    logger.error("🔴 Failed to start server:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error("🔴 Critical error starting server:", error);
  process.exit(1);
});