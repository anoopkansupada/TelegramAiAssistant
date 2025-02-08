import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  telegramId: text("telegram_id").notNull().unique(),
  companyId: integer("company_id"),
  createdById: integer("created_by_id").notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(), 
  name: text("name").notNull(),
  createdById: integer("created_by_id").notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const telegramChannels = pgTable("telegram_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  telegramId: text("telegram_id").notNull().unique(),
  type: text("type").notNull(), // 'group' or 'channel'
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const channelInvitations = pgTable("channel_invitations", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  inviteLink: text("invite_link").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'expired', 'revoked'
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  telegramId: true,
  companyId: true,
});

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  contactId: true,
  content: true,
  sentiment: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).pick({
  content: true,
});

export const insertTelegramChannelSchema = createInsertSchema(telegramChannels).pick({
  name: true,
  telegramId: true,
  type: true,
});

export const insertChannelInvitationSchema = createInsertSchema(channelInvitations)
  .pick({
    channelId: true,
    inviteLink: true,
    status: true,
    maxUses: true,
    expiresAt: true,
  })
  .extend({
    expiresAt: z.string().datetime().optional(),
    maxUses: z.number().min(1).optional(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertTelegramChannel = z.infer<typeof insertTelegramChannelSchema>;
export type InsertChannelInvitation = z.infer<typeof insertChannelInvitationSchema>;

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type TelegramChannel = typeof telegramChannels.$inferSelect;
export type ChannelInvitation = typeof channelInvitations.$inferSelect;