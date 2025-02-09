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

declare module 'express-session' {
  interface SessionData {
    telegramSession?: string;
    phoneCodeHash?: string;
    phoneNumber?: string;
    requires2FA?: boolean;
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
        .filter(d => d.isChannel)
        .map(async (dialog) => {
          const dbChannel = await storage.getTelegramChannelByTelegramId(dialog.id.toString());
          if (!dbChannel) {
            return storage.createTelegramChannel({
              telegramId: dialog.id.toString(),
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

  // Userbot Authentication Routes
  app.post("/api/telegram-auth/request-code", async (req, res) => {
    try {
      console.log("[Route] Received request-code request:", {
        body: req.body,
        session: req.session
      });

      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        console.error("[Route] Phone number missing in request");
        return res.status(400).json({ message: "Phone number is required" });
      }

      console.log("[Route] Requesting verification code for:", phoneNumber);
      const phoneCodeHash = await requestVerificationCode(phoneNumber);

      console.log("[Route] Received phone code hash:", phoneCodeHash);
      // Store the phone code hash in session for verification
      req.session.phoneCodeHash = phoneCodeHash;
      req.session.phoneNumber = phoneNumber;

      console.log("[Route] Updated session:", {
        phoneCodeHash: !!req.session.phoneCodeHash,
        phoneNumber: req.session.phoneNumber
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Route] Error requesting verification code:", error);
      console.error("[Route] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      if (error.message?.includes('AUTH_RESTART')) {
        // Cleanup the existing session data
        req.session.phoneCodeHash = undefined;
        req.session.phoneNumber = undefined;
        req.session.telegramSession = undefined;
        req.session.requires2FA = undefined;

        await clientManager.cleanup();
        return res.status(500).json({
          message: "Please try again",
          code: "AUTH_RESTART"
        });
      }

      res.status(500).json({
        message: "Failed to send verification code",
        error: error.message
      });
    }
  });

  app.post("/api/telegram-auth/verify", async (req, res) => {
    try {
      console.log("[Route] Received verify request:", {
        body: req.body,
        session: {
          hasPhoneNumber: !!req.session.phoneNumber,
          hasPhoneCodeHash: !!req.session.phoneCodeHash
        }
      });

      const { code } = req.body;
      const phoneNumber = req.session.phoneNumber;
      const phoneCodeHash = req.session.phoneCodeHash;

      if (!phoneNumber || !phoneCodeHash) {
        console.error("[Route] Missing session data:", {
          hasPhoneNumber: !!phoneNumber,
          hasPhoneCodeHash: !!phoneCodeHash
        });
        return res.status(400).json({
          message: "Please request a verification code first"
        });
      }

      console.log("[Route] Verifying code with parameters:", {
        phoneNumber,
        codeLength: code?.length,
        hashLength: phoneCodeHash?.length
      });

      try {
        const session = await verifyCode(phoneNumber, code, phoneCodeHash);
        console.log("[Route] Verification successful, session received:", {
          length: session?.length
        });

        req.session.telegramSession = session;
        console.log("[Route] Session stored successfully");
        res.json({ success: true });
      } catch (error: any) {
        if (error.message === '2FA_REQUIRED') {
          req.session.requires2FA = true;
          return res.json({ requires2FA: true });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("[Route] Error verifying code:", error);
      res.status(500).json({
        message: "Failed to verify code",
        error: error.message
      });
    }
  });

  app.post("/api/telegram-auth/verify-2fa", async (req, res) => {
    try {
      console.log("[Route] Received 2FA verification request");

      if (!req.session.requires2FA) {
        return res.status(400).json({
          message: "2FA verification not required"
        });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({
          message: "2FA password is required"
        });
      }

      const session = await verify2FA(password);
      req.session.telegramSession = session;
      req.session.requires2FA = false;

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Route] Error in 2FA verification:", error);
      res.status(500).json({
        message: "Failed to verify 2FA password",
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
  });

  // Export broadcast function to be used by userbot client
  (global as any).broadcastStatus = (status: StatusUpdate) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(status));
      }
    });
  };

  return httpServer;
}