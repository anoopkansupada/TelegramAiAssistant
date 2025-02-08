import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { sendAnnouncement } from "./telegram";

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

  const httpServer = createServer(app);
  return httpServer;
}