import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { CustomLogger } from "./utils/logger";
import { registerRoutes } from "./routes";
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

// Validate session string format
function isValidSessionString(session: string): boolean {
  try {
    if (!session) {
      logger.error("Empty session string");
      return false;
    }

    const trimmedSession = session.trim();
    if (trimmedSession.length < 10) {
      logger.error("Session string too short", { length: trimmedSession.length });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating session string", { error });
    return false;
  }
}

let client: TelegramClient | null = null;

async function initializeTelegramClient() {
  try {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;

    if (!apiId || !apiHash || !phoneNumber) {
      logger.error("Missing required environment variables (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE_NUMBER)");
      return null;
    }

    // Create a new client
    const stringSession = new StringSession("");
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
      maxConcurrentDownloads: 10,
      deviceModel: "Replit CRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      retryDelay: 1000
    });

    // Start the client with phone number
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => "",
      phoneCode: async () => {
        logger.info("Verification code required");
        // In production, this should be handled through your UI
        return process.env.TELEGRAM_CODE || "";
      },
      onError: (err) => {
        if (err.code === 420) { // FLOOD_WAIT
          logger.warn("Rate limited during initialization", { seconds: err.seconds });
        } else {
          logger.error("Client start error:", err);
        }
      },
    });

    // Verify connection is working
    const me = await client.getMe();
    if (!me) {
      throw new Error("Failed to get user info after connection");
    }

    // Save session to database
    const savedSession = client.session.save() as unknown as string;
    await storage.createTelegramSession({
      userId: me.id.toJSNumber(), // Fix: using toJSNumber() instead of toNumber()
      sessionString: savedSession,
      apiId: apiId.toString(),
      apiHash,
      phoneNumber: me.phone || "",
      lastAuthDate: new Date(),
      lastUsed: new Date(),
      isActive: true,
      retryCount: 0,
      metadata: {}
    });

    logger.info("✅ Successfully connected to Telegram!", { userId: me.id });
    return client;
  } catch (error: any) {
    if (error.code === 401) {
      logger.error("❌ Authentication failed - invalid credentials");
    } else if (error.code === 420) {
      logger.error("❌ Rate limited during initialization", { waitSeconds: error.seconds });
    } else {
      logger.error("❌ Error connecting to Telegram:", error);
      if (error instanceof Error) {
        logger.error("Stack trace:", error.stack);
      }
    }
    return null;
  }
}

async function startServer() {
  try {
    // Test database connection using Drizzle's query builder
    const result = await db.execute(sql`SELECT 1`);
    if (!result) throw new Error("Database connection failed");
    logger.info("✅ Database connection successful");

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use(express.urlencoded({ extended: false }));

    // Configure session and auth before other middleware
    await setupAuth(app);

    // Logging middleware
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

    // Initialize Telegram client before setting up routes
    await initializeTelegramClient();

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error("Error:", err);
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, "0.0.0.0", () => {
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