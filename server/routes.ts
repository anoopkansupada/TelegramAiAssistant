import * as speakeasy from 'speakeasy';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import { clientManager } from "./userbot-client";
import { generateResponseSuggestions } from "./aiSuggestions";
import { requireTelegramAuth } from "./middleware/telegramAuth";
import { CustomLogger } from "./utils/logger";
import { requestVerificationCode, verifyCode, verify2FA } from "./telegram/auth";
import { errorHandler, ErrorType } from "./utils/errors";
import { importTelegramData } from './utils/dataImport';

const logger = new CustomLogger("[Routes]");

// Verify required environment variables
const requiredEnvVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'SESSION_ENCRYPTION_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    telegramSession?: string;
    phoneCodeHash?: string;
    phoneNumber?: string;
    requires2FA?: boolean;
    codeRequestTime?: number;
    is2FAAuthenticated?: boolean;
  }
}

interface StatusUpdate {
  type: 'status';
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);  

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith('/telegram-auth/')) {
      return next();
    }

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  });

  app.post("/api/telegram-auth/request-code", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({
          type: ErrorType.VALIDATION_ERROR,
          title: "Validation Error",
          status: 400,
          detail: "Phone number is required"
        });
      }

      if (req.session.userId) {
        await clientManager.cleanupClient(req.session.userId.toString());
      }

      req.session.telegramSession = undefined;
      req.session.phoneCodeHash = undefined;
      req.session.phoneNumber = phoneNumber;
      req.session.codeRequestTime = Date.now();

      logger.info('Requesting verification code', { phoneNumber });

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      const { phoneCodeHash } = await requestVerificationCode(phoneNumber);
      req.session.phoneCodeHash = phoneCodeHash;

      logger.info('Verification code sent successfully', { phoneNumber });

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      res.json({ 
        success: true,
        message: "Verification code sent. Please enter it within 5 minutes." 
      });
    } catch (error: any) {
      logger.error('Error requesting verification code', error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/telegram-auth/verify-2fa", async (req, res) => {
    try {
      const { token } = req.body;

      if (!req.session.userId) {
        return res.status(401).json({ message: "User session not found." });
      }

      const user = await storage.getUserById(req.session.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not set up." });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token
      });

      if (verified) {
        req.session.is2FAAuthenticated = true;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });
        return res.json({ success: true, message: "2FA verified successfully." });
      }

      return res.status(401).json({ message: "Invalid 2FA code." });
    } catch (error: any) {
      logger.error("[Route] Error in 2FA verification:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/telegram-auth/verify", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const { phoneNumber, phoneCodeHash, codeRequestTime } = req.session;

      if (!phoneNumber || !phoneCodeHash) {
        return res.status(400).json({
          message: "Please request a new verification code",
          code: "SESSION_EXPIRED"
        });
      }

      const CODE_EXPIRATION_MS = 300000; 
      if (!codeRequestTime || Date.now() - codeRequestTime > CODE_EXPIRATION_MS) {
        return res.status(400).json({ 
          message: "Verification code expired. Please request a new code.",
          code: "PHONE_CODE_EXPIRED"
        });
      }

      const session = await verifyCode(phoneNumber, code, phoneCodeHash);

      req.session.telegramSession = session;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      logger.error("[Route] Error verifying code:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.listContacts();
      res.json(contacts);
    } catch (error: any) {
      logger.error("[Route] Error getting contacts:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contact = await storage.createContact({
        ...req.body,
        createdById: req.user!.id,
      });
      res.status(201).json(contact);
    } catch (error: any) {
      logger.error("[Route] Error creating contact:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.listCompanies();
      res.json(companies);
    } catch (error: any) {
      logger.error("[Route] Error getting companies:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const company = await storage.createCompany({
        ...req.body,
        createdById: req.user!.id,
      });
      res.status(201).json(company);
    } catch (error: any) {
      logger.error("[Route] Error creating company:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.get("/api/telegram-channels", requireTelegramAuth, async (req, res) => {
    try {
      logger.info('Fetching telegram channels');

      const client = await clientManager.getClient(req.session.userId!);

      const dialogs = await client.getDialogs({
        limit: 100,
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
      });

      logger.info(`Retrieved ${dialogs.length} dialogs`);

      const channels = await Promise.all(dialogs
        .filter(d => d.isChannel && d.id !== undefined)
        .map(async (dialog) => {
          const dbChannel = await storage.getTelegramChannelByTelegramId(dialog.id!.toString());
          if (!dbChannel) {
            return storage.createTelegramChannel({
              telegramId: dialog.id!.toString(),
              name: dialog.name || 'Untitled',
              type: 'channel',
              createdById: req.user!.id,
            });
          }
          return dbChannel;
        }));

      res.json(channels);
    } catch (error) {
      logger.error('Failed to list channels', error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });


  app.post("/api/test/telegram-message", async (req, res) => {
    try {
      logger.info('Received request body:', req.body);

      let message;
      if (typeof req.body === 'string') {
        message = req.body;
      } else if (req.body && typeof req.body.message === 'string') {
        message = req.body.message;
      } else {
        logger.error('Invalid message format received:', req.body);
        return res.status(400).json({ 
          message: "Message is required and must be a string",
          received: req.body
        });
      }

      const mockContact = await storage.createContact({
        firstName: "Test",
        lastName: "User",
        telegramId: "test-" + Date.now(),
        jobTitle: "Test Position",
        createdById: req.user!.id,
      });

      const dbMessage = await storage.createMessage({
        contactId: mockContact.id,
        content: message,
        sentiment: "neutral"
      });

      const suggestions = await generateResponseSuggestions(
        message,
        {
          previousMessages: [],
          contactInfo: {
            name: `${mockContact.firstName} ${mockContact.lastName}`,
            jobTitle: mockContact.jobTitle,
          }
        }
      );

      if (suggestions && suggestions.length > 0) {
        await storage.createMessageSuggestions(dbMessage.id, suggestions);
      }

      res.json({ 
        message: dbMessage,
        suggestions,
        contact: mockContact
      });

    } catch (error: any) {
      logger.error("Test message error details:", {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.get("/api/telegram-auth/status", async (req, res) => {
    try {
      logger.info("[Route] Checking Telegram auth status:", {
        hasSession: !!req.session,
        hasTelegramSession: !!req.session?.telegramSession,
        sessionID: req.sessionID
      });

      const telegramSession = req.session?.telegramSession;
      if (!telegramSession) {
        logger.info("[Route] No Telegram session found");
        return res.json({ connected: false });
      }

      logger.info("[Route] Found Telegram session, checking connection");
      const client = await clientManager.getClient(req.session.userId!);
      const me = await client.getMe();

      logger.info("[Route] Connection check succeeded, user:", {
        id: me?.id,
        username: me?.username,
        firstName: me?.firstName
      });

      res.json({
        connected: true,
        user: {
          id: me?.id.toString(),
          username: me?.username,
          firstName: me?.firstName
        }
      });
    } catch (error) {
      logger.error("[Route] Connection status check failed:", error);
      if (req.session.userId) {
        await clientManager.cleanupClient(req.session.userId.toString());
      }
      req.session.telegramSession = undefined;
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/2fa-setup", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "User session not found." });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      const secret = speakeasy.generateSecret({ length: 20 });
      const updatedUser = {
        ...user,
        twoFactorSecret: secret.base32
      };

      await storage.updateUser(updatedUser);
      res.json({ otpauth_url: secret.otpauth_url });
    } catch (error: any) {
      logger.error("[Route] Error in 2FA setup:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  app.post("/api/import-telegram-data", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await importTelegramData(req.session.userId);
      res.json({ success: true, message: "Telegram data import completed successfully" });
    } catch (error: any) {
      logger.error("[Route] Error importing Telegram data:", error);
      const problem = errorHandler(error);
      res.status(problem.status).json(problem);
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/status'
  });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    logger.info('WebSocket client connected');
    clients.add(ws);

    ws.send(JSON.stringify({
      type: 'status',
      connected: false,
      lastChecked: new Date().toISOString()
    }));

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket connection error', error);
    });
  });

  (global as any).broadcastStatus = (status: StatusUpdate) => {
    const statusJSON = JSON.stringify(status);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(statusJSON);
        } catch (error) {
          logger.error('Failed to send status update', error);
        }
      }
    });
  };

  return httpServer;
}