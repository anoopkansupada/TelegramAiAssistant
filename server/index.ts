import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import dotenv from "dotenv";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { CustomLogger } from "./utils/logger";
import { registerRoutes } from "./routes";

dotenv.config();

const logger = new CustomLogger("[TelegramAuth]");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));

// Validate session string format
function isValidSessionString(session: string): boolean {
  try {
    // Validate base64 format and minimum length
    if (!session || session.length < 10) {
      logger.error("Session string too short", { length: session.length });
      return false;
    }

    // Check if it's a valid base64 string with optional padding
    const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
    const trimmedSession = session.trim();
    if (!base64Regex.test(trimmedSession)) {
      logger.error("Invalid base64 format", { session: trimmedSession.substring(0, 10) + '...' });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating session string", { error });
    return false;
  }
}

const sessionString = process.env.TELEGRAM_SESSION || "";
const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

let client: TelegramClient | null = null;

async function initializeTelegramClient() {
  try {
    if (!sessionString) {
      logger.error("Missing session string");
      return null;
    }

    if (!isValidSessionString(sessionString)) {
      logger.error("Invalid session string format", { 
        sessionLength: sessionString.length,
        isBase64: /^[A-Za-z0-9+/=]+$/.test(sessionString.trim()),
        sample: sessionString.substring(0, 20) + '...'
      });
      return null;
    }

    const stringSession = new StringSession(sessionString.trim());
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
      maxConcurrentDownloads: 10,
      connection: {
        autoReconnect: true,
        maxRetries: 5,
        delay: 1000,
        timeout: 10000
      }
    });

    await client.connect();

    // Verify connection is working
    const me = await client.getMe();
    if (!me) {
      throw new Error("Failed to get user info after connection");
    }

    logger.info("✅ Successfully connected to Telegram!", { userId: me.id });
    return client;
  } catch (error) {
    logger.error("❌ Error connecting to Telegram:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack?.split('\n'));
    }
    return null;
  }
}

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

(async () => {
  try {
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
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();