import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { sendAnnouncement, generateChannelInviteLink, revokeChannelInviteLink } from "./telegram";
import { requestVerificationCode, verifyCode, verify2FA } from "./userbot-auth";

declare module 'express-session' {
  interface SessionData {
    telegramSession?: string;
    phoneCodeHash?: string;
    phoneNumber?: string;
    // Add new session variables here as needed.  For example:
    userId?: number;
    isAdmin?: boolean;
    targetChannelIds?: number[];
    requires2FA?: boolean;
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Require authentication for all /api routes
  app.use("/api", (req, res, next) => {
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

  // Messages
  app.get("/api/contacts/:contactId/messages", async (req, res) => {
    const messages = await storage.listMessages(parseInt(req.params.contactId));
    res.json(messages);
  });

  // Announcements
  app.get("/api/announcements", async (req, res) => {
    const announcements = await storage.listAnnouncements();
    res.json(announcements);
  });

  // Telegram Channels
  app.get("/api/telegram-channels", async (req, res) => {
    const channels = await storage.listTelegramChannels();
    res.json(channels);
  });

  // Channel Invitations
  app.get("/api/channels/:channelId/invitations", async (req, res) => {
    const invitations = await storage.listChannelInvitations(parseInt(req.params.channelId));
    res.json(invitations);
  });

  app.post("/api/channels/:channelId/invitations", async (req, res) => {
    try {
      const channel = await storage.getTelegramChannel(parseInt(req.params.channelId));
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      const inviteLink = await generateChannelInviteLink(channel.telegramId, {
        expireDate: req.body.expiresAt ? Math.floor(new Date(req.body.expiresAt).getTime() / 1000) : undefined,
        memberLimit: req.body.maxUses,
      });

      const invitation = await storage.createChannelInvitation({
        channelId: channel.id,
        inviteLink,
        status: "active",
        maxUses: req.body.maxUses,
        expiresAt: req.body.expiresAt,
        createdById: req.user!.id,
      });

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Failed to create invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.post("/api/channels/:channelId/invitations/:invitationId/revoke", async (req, res) => {
    try {
      const channel = await storage.getTelegramChannel(parseInt(req.params.channelId));
      const invitation = await storage.getChannelInvitation(parseInt(req.params.invitationId));

      if (!channel || !invitation) {
        return res.status(404).json({ message: "Channel or invitation not found" });
      }

      await revokeChannelInviteLink(channel.telegramId, invitation.inviteLink);
      const updatedInvitation = await storage.updateInvitationStatus(invitation.id, "revoked");
      res.json(updatedInvitation);
    } catch (error) {
      console.error("Failed to revoke invitation:", error);
      res.status(500).json({ message: "Failed to revoke invitation" });
    }
  });

  // Update the announcement POST route to support targeting
  app.post("/api/announcements", async (req, res) => {
    const announcement = await storage.createAnnouncement({
      content: req.body.content,
      createdById: req.user!.id,
    });

    // Send announcement via Telegram bot
    await sendAnnouncement(req.body.content, req.body.targetChannelIds);

    res.status(201).json(announcement);
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
    } catch (error) {
      console.error("[Route] Error requesting verification code:", error);
      console.error("[Route] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        message: "Failed to send verification code",
        error: error instanceof Error ? error.message : "Unknown error"
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
      console.error("[Route] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        message: "Failed to verify code",
        error: error instanceof Error ? error.message : "Unknown error"
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
      console.error("[Route] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        message: "Failed to verify 2FA password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}