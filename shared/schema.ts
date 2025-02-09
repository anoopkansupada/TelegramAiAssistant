import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  size: text("size"),
  location: text("location"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  facebookUrl: text("facebook_url"),
  annualRevenue: text("annual_revenue"),
  fundingDetails: jsonb("funding_details"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  department: text("department"),

  // Contact Details
  phone: text("phone"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  facebookUrl: text("facebook_url"),
  otherSocialProfiles: jsonb("other_social_profiles"), // Store additional social media profiles

  // Telegram Integration
  telegramId: text("telegram_id").notNull().unique(),
  telegramUsername: text("telegram_username"),

  // Company Association
  companyId: integer("company_id"),

  // Communication Preferences
  preferredContactMethod: text("preferred_contact_method"), // email, phone, telegram, etc
  timeZone: text("time_zone"),
  availabilityHours: jsonb("availability_hours"), // Store working hours/availability

  // Interaction History
  lastContactedAt: timestamp("last_contacted_at"),
  meetingNotes: jsonb("meeting_notes"), // Array of meeting notes with timestamps
  callHistory: jsonb("call_history"), // Array of call logs with timestamps
  emailHistory: jsonb("email_history"), // Track email interactions

  // Task Management
  followUpTasks: jsonb("followup_tasks"), // Array of pending tasks
  reminders: jsonb("reminders"), // Array of upcoming reminders

  // Status and Tags
  status: text("status").default('active'), // active, inactive, do-not-contact
  tags: text("tags").array(), // For categorization and filtering

  // Custom Fields
  customFields: jsonb("custom_fields"), // For organization-specific data

  // Metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastActivityAt: timestamp("last_activity_at"),
});

// Update the insert schema to include new fields
export const insertContactSchema = createInsertSchema(contacts).pick({
  firstName: true,
  lastName: true,
  jobTitle: true,
  department: true,
  phone: true,
  email: true,
  linkedinUrl: true,
  twitterHandle: true,
  facebookUrl: true,
  otherSocialProfiles: true,
  telegramId: true,
  telegramUsername: true,
  companyId: true,
  preferredContactMethod: true,
  timeZone: true,
  availabilityHours: true,
  status: true,
  tags: true,
  customFields: true,
});

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  type: text("type").notNull(), // meeting, call, email, telegram
  notes: text("notes"),
  meetingNotes: text("meeting_notes"),
  nextSteps: text("next_steps"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  industry: true,
  size: true,
  location: true,
  phone: true,
  email: true,
  website: true,
  linkedinUrl: true,
  twitterHandle: true,
  facebookUrl: true,
  annualRevenue: true,
  fundingDetails: true,
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

export const insertInteractionSchema = createInsertSchema(interactions).pick({
  contactId: true,
  type: true,
  notes: true,
  meetingNotes: true,
  nextSteps: true,
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
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;

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
export type Interaction = typeof interactions.$inferSelect;