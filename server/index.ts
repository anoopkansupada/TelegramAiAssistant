import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import fs from "fs";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { CustomLogger } from "./utils/logger";
import { registerRoutes } from "./routes";
import { db } from "./db";
import { neonConfig } from "@neondatabase/serverless";

dotenv.config();

const logger = new CustomLogger("[TelegramAuth]");
const SESSION_FILE_PATH = "./telegram.session.json";

// Configure neon to handle WebSocket errors gracefully
(neonConfig as any).wssClosed = () => {
  logger.warn("Database connection closed");
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

async function loadSessionString(): Promise<string> {
  try {
    // Try loading from environment variable first
    let sessionString = process.env.TELEGRAM_SESSION;

    // If not in env, try loading from file
    if (!sessionString && fs.existsSync(SESSION_FILE_PATH)) {
      sessionString = fs.readFileSync(SESSION_FILE_PATH, "utf8").trim();
    }

    return sessionString || "";
  } catch (error) {
    logger.error("Error loading session string", { error });
    return "";
  }
}

let client: TelegramClient | null = null;

async function initializeTelegramClient() {
  try {
    const sessionString = await loadSessionString();
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    if (!sessionString) {
      logger.error("Missing session string");
      return null;
    }

    if (!isValidSessionString(sessionString)) {
      logger.error("Invalid session string format");
      return null;
    }

    const stringSession = new StringSession(sessionString.trim());
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
      maxConcurrentDownloads: 10,
      deviceModel: "Replit CRM",
      systemVersion: "1.0.0",
      appVersion: "1.0.0"
    });

    await client.connect();

    // Verify connection is working
    const me = await client.getMe();
    if (!me) {
      throw new Error("Failed to get user info after connection");
    }

    // Save working session to file
    const savedSession = client.session.save() as unknown as string;
    fs.writeFileSync(SESSION_FILE_PATH, savedSession);

    logger.info("✅ Successfully connected to Telegram!", { userId: me.id });
    return client;
  } catch (error) {
    logger.error("❌ Error connecting to Telegram:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    return null;
  }
}

async function startServer() {
  try {
    // Test database connection first
    await db.execute('SELECT 1');
    logger.info("✅ Database connection successful");

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use(express.urlencoded({ extended: false }));

    // Configure session and auth before other middleware
    setupAuth(app);

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

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`serving on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error("Critical error starting server:", error);
  process.exit(1);
});