import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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

export const telegramChats = pgTable("telegram_chats", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'private', 'group', 'supergroup', 'channel'
  status: text("status").notNull().default("pending"), // 'pending', 'synced', 'ignored'
  category: text("category"), // AI-assigned category
  importance: integer("importance").default(0), // AI-assigned importance score
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: integer("unread_count").default(0),
  metadata: jsonb("metadata"), // Store engagement metrics and other metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companySuggestions = pgTable("company_suggestions", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  companyName: text("company_name").notNull(),
  website: text("website"),
  confidenceScore: integer("confidence_score").notNull(),
  confidenceFactors: jsonb("confidence_factors"), // Store detailed explanation of confidence score
  metadata: jsonb("metadata"), // Store enriched data from various sources
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'rejected'
  autoConfirmed: boolean("auto_confirmed").default(false), // Track if suggestion was auto-confirmed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followupSchedules = pgTable("followup_schedules", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  message: text("message").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'cancelled'
  engagementScore: integer("engagement_score"), // AI-calculated optimal engagement time score
  metadata: jsonb("metadata"), // Store engagement metrics and other metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const insertTelegramChatSchema = createInsertSchema(telegramChats).pick({
  telegramId: true,
  title: true,
  type: true,
  status: true,
  category: true,
  importance: true,
  lastMessageAt: true,
  unreadCount: true,
  metadata: true,
});

export const insertCompanySuggestionSchema = createInsertSchema(companySuggestions).pick({
  chatId: true,
  companyName: true,
  website: true,
  confidenceScore: true,
  confidenceFactors: true,
  metadata: true,
  status: true,
  autoConfirmed: true,
});

export const insertFollowupScheduleSchema = createInsertSchema(followupSchedules).pick({
  chatId: true,
  message: true,
  scheduledFor: true,
  status: true,
  engagementScore: true,
  metadata: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertTelegramChannel = z.infer<typeof insertTelegramChannelSchema>;
export type InsertChannelInvitation = z.infer<typeof insertChannelInvitationSchema>;
export type InsertTelegramChat = z.infer<typeof insertTelegramChatSchema>;
export type InsertCompanySuggestion = z.infer<typeof insertCompanySuggestionSchema>;
export type InsertFollowupSchedule = z.infer<typeof insertFollowupScheduleSchema>;

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type TelegramChannel = typeof telegramChannels.$inferSelect;
export type ChannelInvitation = typeof channelInvitations.$inferSelect;
export type TelegramChat = typeof telegramChats.$inferSelect;
export type CompanySuggestion = typeof companySuggestions.$inferSelect;
export type FollowupSchedule = typeof followupSchedules.$inferSelect;