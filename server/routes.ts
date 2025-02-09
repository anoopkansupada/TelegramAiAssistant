import * as speakeasy from 'speakeasy';
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { sendAnnouncement, generateChannelInviteLink, revokeChannelInviteLink } from "./telegram";
import { requestVerificationCode, verifyCode, verify2FA } from "./userbot-auth";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { clientManager } from "./userbot-client";
import { generateResponseSuggestions } from "./aiSuggestions";

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

// Add WebSocket types
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

  // Require authentication for all /api routes except Telegram auth
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith('/telegram-auth/')) {
      return next();
    }

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  });

  // Telegram Authentication Routes
  app.post("/api/telegram-auth/request-code", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Clean up existing client
      await clientManager.cleanup();

      // Clear only Telegram-related session data
      req.session.telegramSession = undefined;
      req.session.phoneCodeHash = undefined;
      req.session.phoneNumber = undefined;
      req.session.requires2FA = undefined;
      req.session.codeRequestTime = undefined;

      // Save session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Check if 2FA is required
      const user = await storage.getUserByPhoneNumber(phoneNumber);
      if (user && user.twoFactorSecret) {
        return res.status(200).json({ 
          requires2FA: true,
          message: "2FA verification required" 
        });
      }

      res.json({ 
        success: true,
        message: "Verification code sent. Please enter it within 2 minutes" 
      });
    } catch (error: any) {
      console.error("[Route] Error requesting verification code:", error);

      if (error.message?.includes('AUTH_RESTART')) {
        return res.status(500).json({
          message: "Please try requesting the code again",
          code: "AUTH_RESTART"
        });
      }

      res.status(500).json({
        message: error.message || "Failed to send verification code"
      });
    }
  });

  // 2FA Validation Route
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
      console.error("[Route] Error in 2FA verification:", error);
      res.status(500).json({ message: "Failed to verify 2FA code" });
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
        // Clear Telegram-related session data
        req.session.telegramSession = undefined;
        req.session.phoneCodeHash = undefined;
        req.session.phoneNumber = undefined;
        req.session.requires2FA = undefined;
        req.session.codeRequestTime = undefined;

        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });

        return res.status(400).json({
          message: "Session expired. Please request a new verification code.",
          code: "SESSION_EXPIRED"
        });
      }

      // Check code expiration (2 minutes)
      const CODE_EXPIRATION_MS = 120000;
      if (!codeRequestTime || Date.now() - codeRequestTime > CODE_EXPIRATION_MS) {
        // Clear Telegram-related session data
        req.session.telegramSession = undefined;
        req.session.phoneCodeHash = undefined;
        req.session.phoneNumber = undefined;
        req.session.requires2FA = undefined;
        req.session.codeRequestTime = undefined;

        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });

        return res.status(400).json({ 
          message: "Verification code expired. Please request a new code.",
          code: "PHONE_CODE_EXPIRED"
        });
      }

      const session = await verifyCode(phoneNumber, code, phoneCodeHash);

      // Update session with new data
      req.session.telegramSession = session;
      req.session.phoneCodeHash = undefined;
      req.session.phoneNumber = undefined;
      req.session.codeRequestTime = undefined;

      // Save session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'PHONE_CODE_EXPIRED') {
        // Clear Telegram-related session data
        req.session.telegramSession = undefined;
        req.session.phoneCodeHash = undefined;
        req.session.phoneNumber = undefined;
        req.session.requires2FA = undefined;
        req.session.codeRequestTime = undefined;

        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });

        return res.status(400).json({ 
          message: "Verification code expired. Please request a new code.",
          code: "PHONE_CODE_EXPIRED"
        });
      }

      if (error.message === 'PHONE_CODE_INVALID') {
        return res.status(400).json({
          message: "Invalid verification code. Please try again.",
          code: "PHONE_CODE_INVALID"
        });
      }

      console.error("[Route] Error verifying code:", error);
      res.status(500).json({
        message: error.message || "Failed to verify code"
      });
    }
  });

  // Contacts
  app.get("/api/contacts", async (req, res) => {
    const contacts = await storage.listContacts();
    res.json(contacts);
  });

  app.post("/api/contacts", async (req, res) => {
    const contact = await storage.createContact({
      ...req.body,
      createdById: req.user!.id,
    });
    res.status(201).json(contact);
  });

  // Companies
  app.get("/api/companies", async (req, res) => {
    const companies = await storage.listCompanies();
    res.json(companies);
  });

  app.post("/api/companies", async (req, res) => {
    const company = await storage.createCompany({
      ...req.body,
      createdById: req.user!.id,
    });
    res.status(201).json(company);
  });

  // Telegram Channels
  app.get("/api/telegram-channels", async (req, res) => {
    try {
      console.log("[Route] GET /api/telegram-channels - Starting retrieval");

      const telegramSession = req.session?.telegramSession;
      if (!telegramSession) {
        console.log("[Route] No telegram session found");
        return res.status(401).json({ message: "Telegram authentication required" });
      }

      console.log("[Route] Found telegram session, getting client");
      const client = await clientManager.getClient(telegramSession);

      console.log("[Route] Getting dialogs");
      const dialogs = await client.getDialogs({
        limit: 100,
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
      });

      console.log(`[Route] Retrieved ${dialogs.length} dialogs`);
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
      console.error("[Route] Failed to list channels:", error);
      res.status(500).json({ message: "Failed to list channels" });
    }
  });


  app.post("/api/test/telegram-message", async (req, res) => {
    try {
      console.log('Received request body:', req.body);
      console.log('Request body type:', typeof req.body);

      let message;
      if (typeof req.body === 'string') {
        message = req.body;
      } else if (req.body && typeof req.body.message === 'string') {
        message = req.body.message;
      } else {
        console.log('Invalid message format received:', req.body);
        return res.status(400).json({ 
          message: "Message is required and must be a string",
          received: req.body
        });
      }

      // Simulate a telegram message
      const mockContact = await storage.createContact({
        firstName: "Test",
        lastName: "User",
        telegramId: "test-" + Date.now(),
        jobTitle: "Test Position",
        createdById: req.user!.id,
      });

      // Create the message
      const dbMessage = await storage.createMessage({
        contactId: mockContact.id,
        content: message,
        sentiment: "neutral"
      });

      // Generate suggestions
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
      console.error("Test message error details:", {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      res.status(500).json({ 
        message: "Failed to process test message",
        error: error.message 
      });
    }
  });

  app.get("/api/telegram-auth/status", async (req, res) => {
    try {
      console.log("[Route] Checking Telegram auth status:", {
        hasSession: !!req.session,
        hasTelegramSession: !!req.session?.telegramSession,
        sessionID: req.sessionID
      });

      const telegramSession = req.session?.telegramSession;
      if (!telegramSession) {
        console.log("[Route] No Telegram session found");
        return res.json({ connected: false });
      }

      console.log("[Route] Found Telegram session, checking connection");
      const client = await clientManager.getClient(telegramSession);
      const me = await client.getMe();

      console.log("[Route] Connection check succeeded, user:", {
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
      console.error("[Route] Connection status check failed:", error);
      // Clear invalid session
      req.session.telegramSession = undefined;
      await clientManager.cleanup();
      res.json({ connected: false });
    }
  });

  // 2FA Setup
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
      console.error("[Route] Error in 2FA setup:", error);
      res.status(500).json({ message: "Failed to set up 2FA" });
    }
  });


  const httpServer = createServer(app);

  // Initialize WebSocket server with a specific path
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/status'
  });

  // Store active connections
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] Client connected');
    clients.add(ws);

    // Send initial status
    ws.send(JSON.stringify({
      type: 'status',
      connected: false,
      lastChecked: new Date().toISOString()
    }));

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });
  });

  // Export broadcast function to be used by userbot client
  (global as any).broadcastStatus = (status: StatusUpdate) => {
    const statusJSON = JSON.stringify(status);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(statusJSON);
        } catch (error) {
          console.error('[WebSocket] Failed to send status update:', error);
        }
      }
    });
  };

  return httpServer;
}