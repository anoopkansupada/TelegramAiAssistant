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
import { getOrCreateClient } from "./userbot-client";

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
    // Skip auth check for Telegram auth routes
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
    try {
      console.log("[Route] GET /api/telegram-channels - Starting retrieval");

      const telegramSession = req.session?.telegramSession;
      if (!telegramSession) {
        console.log("[Route] No telegram session found");
        return res.status(401).json({ message: "Telegram authentication required" });
      }

      console.log("[Route] Found telegram session, getting client");
      const client = await getOrCreateClient(telegramSession);

      console.log("[Route] Getting dialogs");
      const dialogs = await client.getDialogs({
        limit: 100,
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
      });

      console.log(`[Route] Retrieved ${dialogs.length} dialogs`);
      console.log("[Route] Dialog details:", dialogs.map(d => ({
        name: d.name,
        id: d.id,
        type: d.isChannel ? 'channel' : d.isGroup ? 'group' : 'private'
      })));

      // Process and store each dialog
      const processResults = await Promise.all(dialogs.map(async (dialog) => {
        try {
          if (!dialog.entity) {
            console.log("[Route] Skipping dialog - no entity:", dialog);
            return null;
          }

          const chat = dialog.entity;
          console.log("[Route] Processing chat:", {
            id: chat.id,
            className: chat.className,
            name: dialog.name,
            isChannel: dialog.isChannel,
            isGroup: dialog.isGroup
          });

          // Get or create channel in database
          let dbChannel = await storage.getTelegramChannelByTelegramId(chat.id.toString());
          if (!dbChannel) {
            console.log("[Route] Creating new channel record for:", chat.id);
            dbChannel = await storage.createTelegramChannel({
              telegramId: chat.id.toString(),
              name: dialog.name || 'Untitled',
              type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'private',
              createdById: req.user!.id,
            });
          }

          return dbChannel;
        } catch (error) {
          console.error("[Route] Error processing dialog:", error);
          return null;
        }
      }));

      // Filter out null results and return valid channels
      const channels = processResults.filter(Boolean);
      console.log(`[Route] Returning ${channels.length} channels`);

      res.json(channels);
    } catch (error) {
      console.error("[Route] Failed to list channels:", error);
      res.status(500).json({ message: "Failed to list channels" });
    }
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

  // Update the status check route with better logging
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
      const client = await getOrCreateClient(telegramSession);

      // Get account info to verify connection
      const me = await client.getMe();
      console.log("[Route] Connection check succeeded, user:", {
        id: me?.id,
        username: me?.username,
        firstName: me?.firstName
      });

      res.json({
        connected: true,
        user: {
          id: me?.id,
          username: me?.username,
          firstName: me?.firstName
        }
      });
    } catch (error) {
      console.error("[Route] Connection status check failed:", error);
      res.json({ connected: false });
    }
  });


  // Add detailed logging for chat retrieval
  app.get("/api/telegram-chats", async (req, res) => {
    try {
      const telegramSession = req.session.telegramSession;
      if (!telegramSession) {
        console.log("[Route] No telegram session found in request");
        return res.status(401).json({ message: "Telegram authentication required" });
      }

      console.log("[Route] Getting or creating client for session");
      const client = await getOrCreateClient(telegramSession);

      console.log("[Route] Starting to fetch dialogs with parameters");

      // First try to get the total number of dialogs
      const initialDialogs = await client.getDialogs({
        limit: 1,
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
      });

      console.log(`[Route] Initial dialog fetch complete, attempting to get all dialogs`);

      // Now fetch all dialogs with proper parameters
      const dialogs = await client.getDialogs({
        limit: 500, // Increased limit substantially
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        includeSpam: true, // Include spam chats
        excludePinned: false, // Include pinned chats
      });

      console.log(`[Route] Successfully fetched ${dialogs.length} dialogs`);

      // Detailed logging for each dialog
      dialogs.forEach((dialog, index) => {
        console.log(`[Route] Dialog ${index + 1} details:`, {
          name: dialog.name,
          isChannel: dialog.isChannel,
          isGroup: dialog.isGroup,
          isUser: dialog.isUser,
          entity: dialog.entity ? {
            className: dialog.entity.className,
            id: dialog.entity.id,
            type: dialog.entity.constructor.name,
            hasAccessHash: !!dialog.entity.accessHash,
          } : 'No entity',
          unreadCount: dialog.unreadCount,
          date: dialog.date ? new Date(dialog.date * 1000).toISOString() : null,
          hasMessage: !!dialog.message,
        });
      });

      // Process and store each chat with validation
      const processResults = await Promise.all(
        dialogs.map(async (dialog, index) => {
          const chat = dialog.entity;
          if (!chat) {
            console.log(`[Route] Skipping dialog ${index} - no entity:`, dialog);
            return { success: false, reason: 'no_entity' };
          }

          try {
            console.log(`[Route] Processing chat ${index}:`, {
              id: chat.id,
              className: chat.className,
              name: dialog.name,
              isChannel: dialog.isChannel,
              isGroup: dialog.isGroup,
              isUser: dialog.isUser
            });

            // Get or create chat in database
            let dbChat = await storage.getTelegramChatByTelegramId(chat.id.toString());
            console.log(`[Route] Database lookup for chat ${chat.id}:`, {
              found: !!dbChat,
              existingId: dbChat?.id
            });

            if (!dbChat) {
              console.log(`[Route] Creating new chat record for ${chat.id}`);
              dbChat = await storage.createTelegramChat({
                telegramId: chat.id.toString(),
                title: dialog.name || 'Untitled',
                type: chat.className.toLowerCase(),
                status: 'pending',
                unreadCount: dialog.unreadCount || 0,
                lastMessageAt: dialog.date ? new Date(dialog.date * 1000) : new Date(),
                metadata: {
                  participantsCount: dialog.isChannel || dialog.isGroup ? -1 : 2,
                  isChannel: dialog.isChannel,
                  isGroup: dialog.isGroup,
                  isUser: dialog.isUser,
                  accessHash: chat.accessHash?.toString(),
                },
                createdById: req.user!.id,
              });
              console.log(`[Route] Successfully created chat record:`, {
                id: dbChat.id,
                telegramId: dbChat.telegramId,
                type: dbChat.type
              });
            } else {
              console.log(`[Route] Updating existing chat record for ${chat.id}`);
              dbChat = await storage.updateTelegramChatMetadata(dbChat.id, {
                participantsCount: dialog.isChannel || dialog.isGroup ? -1 : 2,
                isChannel: dialog.isChannel,
                isGroup: dialog.isGroup,
                isUser: dialog.isUser,
                accessHash: chat.accessHash?.toString(),
              });
              console.log(`[Route] Successfully updated chat record:`, {
                id: dbChat.id,
                telegramId: dbChat.telegramId,
                type: dbChat.type
              });
            }

            return { success: true, chat: dbChat };
          } catch (error) {
            console.error(`[Route] Error processing chat ${index}:`, error);
            return { success: false, reason: 'processing_error', error };
          }
        })
      );

      // Analyze results
      const successCount = processResults.filter(r => r.success).length;
      const failureCount = processResults.filter(r => !r.success).length;
      console.log(`[Route] Chat processing summary:`, {
        total: processResults.length,
        successful: successCount,
        failed: failureCount
      });

      // Filter out successful results and return
      const validChats = processResults
        .filter((result): result is { success: true, chat: any } => result.success)
        .map(result => result.chat);

      console.log(`[Route] Returning ${validChats.length} valid chats`);
      console.log("[Route] Chat summary:", validChats.map(c => ({
        id: c.id,
        telegramId: c.telegramId,
        title: c.title,
        type: c.type,
        metadata: c.metadata
      })));

      res.json(validChats);

    } catch (error) {
      console.error("[Route] Failed to list chats:", error);
      console.error("[Route] Error details:", error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error);
      res.status(500).json({ 
        message: "Failed to list chats",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/telegram-chats/:chatId/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['synced', 'ignored'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const chat = await storage.getTelegramChat(parseInt(req.params.chatId));
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const updatedChat = await storage.updateTelegramChatStatus(chat.id, status);
      res.json(updatedChat);
    } catch (error) {
      console.error("Failed to update chat status:", error);
      res.status(500).json({ message: "Failed to update chat status" });
    }
  });

  // Enhanced Telegram Chats
  app.get("/api/telegram-chats/category/:category", async (req, res) => {
    try {
      const chats = await storage.listChatsByCategory(req.params.category);
      res.json(chats);
    } catch (error) {
      console.error("Failed to list chats by category:", error);
      res.status(500).json({ message: "Failed to list chats by category" });
    }
  });

  app.get("/api/telegram-chats/importance/:minImportance", async (req, res) => {
    try {
      const chats = await storage.listChatsByImportance(parseInt(req.params.minImportance));
      res.json(chats);
    } catch (error) {
      console.error("Failed to list chats by importance:", error);
      res.status(500).json({ message: "Failed to list chats by importance" });
    }
  });

  app.post("/api/telegram-chats/:chatId/category", async (req, res) => {
    try {
      const { category, importance } = req.body;
      const chat = await storage.getTelegramChat(parseInt(req.params.chatId));
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const updatedChat = await storage.updateTelegramChatCategory(
        chat.id,
        category,
        importance
      );
      res.json(updatedChat);
    } catch (error) {
      console.error("Failed to update chat category:", error);
      res.status(500).json({ message: "Failed to update chat category" });
    }
  });

  // Company Suggestions
  app.get("/api/telegram-chats/:chatId/suggestions", async (req, res) => {
    try {
      const suggestions = await storage.listCompanySuggestions(parseInt(req.params.chatId));
      res.json(suggestions);
    } catch (error) {
      console.error("Failed to list suggestions:", error);
      res.status(500).json({ message: "Failed to list suggestions" });
    }
  });

  app.post("/api/telegram-chats/:chatId/suggestions/:suggestionId/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['confirmed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const suggestion = await storage.getCompanySuggestion(parseInt(req.params.suggestionId));
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }

      const updatedSuggestion = await storage.updateCompanySuggestionStatus(suggestion.id, status);
      res.json(updatedSuggestion);
    } catch (error) {
      console.error("Failed to update suggestion status:", error);
      res.status(500).json({ message: "Failed to update suggestion status" });
    }
  });

  // Enhanced Company Suggestions
  app.get("/api/company-suggestions/auto-confirmable/:minConfidence", async (req, res) => {
    try {
      const suggestions = await storage.listAutoConfirmableSuggestions(
        parseInt(req.params.minConfidence)
      );
      res.json(suggestions);
    } catch (error) {
      console.error("Failed to list auto-confirmable suggestions:", error);
      res.status(500).json({ message: "Failed to list auto-confirmable suggestions" });
    }
  });

  app.post("/api/company-suggestions/:suggestionId/confidence", async (req, res) => {
    try {
      const { confidenceScore, confidenceFactors } = req.body;
      const suggestion = await storage.getCompanySuggestion(parseInt(req.params.suggestionId));
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }

      const updatedSuggestion = await storage.updateCompanySuggestionConfidence(
        suggestion.id,
        confidenceScore,
        confidenceFactors
      );
      res.json(updatedSuggestion);
    } catch (error) {
      console.error("Failed to update suggestion confidence:", error);
      res.status(500).json({ message: "Failed to update suggestion confidence" });
    }
  });

  // Followup Schedules
  app.get("/api/followups/chat/:chatId", async (req, res) => {
    try {
      const followups = await storage.listFollowupSchedules(parseInt(req.params.chatId));
      res.json(followups);
    } catch (error) {
      console.error("Failed to list followups:", error);
      res.status(500).json({ message: "Failed to list followups" });
    }
  });

  app.post("/api/followups", async (req, res) => {
    try {
      const followup = await storage.createFollowupSchedule({
        ...req.body,
        createdById: req.user!.id,
      });
      res.status(201).json(followup);
    } catch (error) {
      console.error("Failed to create followup:", error);
      res.status(500).json({ message: "Failed to create followup" });
    }
  });

  app.post("/api/followups/:followupId/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['sent', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const followup = await storage.getFollowupSchedule(parseInt(req.params.followupId));
      if (!followup) {
        return res.status(404).json({ message: "Followup not found" });
      }

      const updatedFollowup = await storage.updateFollowupStatus(followup.id, status);
      res.json(updatedFollowup);
    } catch (error) {
      console.error("Failed to update followup status:", error);
      res.status(500).json({ message: "Failed to update followup status" });
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
    const sessionData = storage.sessionStore.get;
    if (sessionData?.telegramSession) {
      ws.send(JSON.stringify({
        type: 'status',
        connected: true,
        lastChecked: new Date().toISOString()
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'status',
        connected: false,
        lastChecked: new Date().toISOString()
      }));
    }

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