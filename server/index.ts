import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { CustomLogger } from "./utils/logger";
import { createSessionString } from "./utils/session-creator";
import { validateTelegramSession, isFloodError, extractWaitTime } from "./utils/telegram-validator";
import { db } from "./db";
import { neonConfig } from "@neondatabase/serverless";
import { storage } from "./storage";
import { sql } from "drizzle-orm";

dotenv.config();

const logger = new CustomLogger("[TelegramAuth]");

// Configure neon to handle WebSocket errors gracefully
(neonConfig as any).wssClosed = () => {
  logger.warn("Database connection closed, will attempt reconnect automatically");
};

(neonConfig as any).wssError = (error: Error) => {
  logger.error("Database connection error:", error);
};

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

async function initializeTelegramClient(attempt = 1): Promise<TelegramClient | null> {
  try {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;

    if (!apiId || !apiHash || !phoneNumber) {
      logger.error("Missing required environment variables (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE_NUMBER)");
      return null;
    }

    // First try to retrieve existing session
    const existingSession = await storage.getTelegramSessionByPhone(phoneNumber);
    if (existingSession?.isActive) {
      try {
        const client = new TelegramClient(
          new StringSession(existingSession.sessionString),
          apiId,
          apiHash,
          {
            connectionRetries: 3,
            useWSS: true,
            maxConcurrentDownloads: 5,
            deviceModel: "Replit CRM",
            systemVersion: process.version,
            appVersion: "1.0.0",
            useIPV6: false,
            requestRetries: 3,
            downloadRetries: 3,
            retryDelay: 2000,
            floodSleepThreshold: 60,
            timeout: 30000
          }
        );

        const health = await validateTelegramSession(client);
        if (health.isValid) {
          logger.info("Successfully reused existing session", {
            dcId: health.dcId,
            layer: health.layer,
            latency: health.latency
          });
          return client;
        }
      } catch (error) {
        logger.warn("Failed to reuse existing session", { error });
      }
    }

    // If no valid session exists or reuse failed, create new session
    try {
      const sessionString = await createSessionString({
        apiId,
        apiHash,
        phoneNumber,
        verificationCode: process.env.TELEGRAM_CODE || "",
        deviceModel: "Replit CRM",
        systemVersion: process.version,
        appVersion: "1.0.0",
        useWSS: true
      });

      const client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        {
          connectionRetries: 3,
          useWSS: true,
          maxConcurrentDownloads: 5,
          deviceModel: "Replit CRM",
          systemVersion: process.version,
          appVersion: "1.0.0",
          useIPV6: false,
          requestRetries: 3,
          downloadRetries: 3,
          retryDelay: 2000,
          floodSleepThreshold: 60,
          timeout: 30000
        }
      );

      const health = await validateTelegramSession(client);
      if (!health.isValid) {
        throw new Error(health.error || "Session validation failed");
      }

      logger.info("✅ Successfully connected to Telegram!", {
        dcId: health.dcId,
        layer: health.layer,
        latency: health.latency
      });

      return client;
    } catch (error: any) {
      if (isFloodError(error)) {
        const waitSeconds = extractWaitTime(error);
        logger.warn(`Rate limited during initialization, attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`, { waitSeconds });

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delayMs = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
            MAX_RETRY_DELAY
          );
          logger.info(`Retrying in ${delayMs/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return initializeTelegramClient(attempt + 1);
        }
      }

      logger.error("❌ Error connecting to Telegram:", error);
      if (error instanceof Error) {
        logger.error("Stack trace:", error.stack);
      }
      return null;
    }
  } catch (error) {
    logger.error("Failed to initialize Telegram client:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    return null;
  }
}

async function startServer() {
  try {
    // Test database connection
    const result = await db.execute(sql`SELECT 1`);
    if (!result) throw new Error("Database connection failed");
    logger.info("✅ Database connection successful");

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use(express.urlencoded({ extended: false }));

    await setupAuth(app);

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

          log(logLine);
        }
      });

      next();
    });

    // Initialize Telegram client with retries and session handling
    await initializeTelegramClient();

    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      logger.error("Error:", err);
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      log(`serving on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error("Critical error starting server:", error);
  process.exit(1);
});