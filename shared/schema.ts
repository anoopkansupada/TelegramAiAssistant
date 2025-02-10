import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - for authentication and system access
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  twoFactorSecret: text("two_factor_secret"),
  role: text("role").default("user"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Companies/Organizations
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  size: text("size"), // small, medium, large, enterprise
  location: text("location"),

  // Contact Information
  phone: text("phone"),
  email: text("email"),
  website: text("website"),

  // Social Media
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  facebookUrl: text("facebook_url"),

  // Business Information
  annualRevenue: text("annual_revenue"),
  employeeCount: integer("employee_count"),
  foundedYear: integer("founded_year"),

  // Relationships
  parentCompanyId: integer("parent_company_id"),

  // Additional Data
  type: text("type"), // prospect, customer, partner
  status: text("status").default("active"), // active, inactive, lead
  tags: text("tags").array(),
  customFields: jsonb("custom_fields"),

  // Financial Information
  fundingDetails: jsonb("funding_details"),

  // Metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Contacts (people)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  department: text("department"),
  telegramId: text("telegram_id").default('imported'),

  // Contact Information
  phone: text("phone"),
  email: text("email"),
  alternativeEmail: text("alternative_email"),

  // Social Profiles
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  facebookUrl: text("facebook_url"),
  otherSocialProfiles: jsonb("other_social_profiles"),

  // Relationships
  companyId: integer("company_id"),
  reportsToId: integer("reports_to_id"), // hierarchical relationship

  // Communication Preferences
  preferredContactMethod: text("preferred_contact_method"),
  timeZone: text("time_zone"),
  availabilityHours: jsonb("availability_hours"),
  doNotContact: boolean("do_not_contact").default(false),

  // Classification
  type: text("type").default("contact"), // lead, customer, prospect
  status: text("status").default("active"),
  leadScore: integer("lead_score"),
  tags: text("tags").array(),

  // Custom Data
  customFields: jsonb("custom_fields"),

  // Activity Tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpDate: timestamp("next_follow_up_date"),

  // Metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastActivityAt: timestamp("last_activity_at"),
});

// Interactions (meetings, calls, emails)
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  type: text("type").notNull(), // meeting, call, email, telegram
  subject: text("subject"),
  notes: text("notes"),
  outcome: text("outcome"),
  nextSteps: text("next_steps"),
  scheduledFor: timestamp("scheduled_for"),
  duration: integer("duration"), // in minutes
  status: text("status").default("completed"),
  location: text("location"),
  metadata: jsonb("metadata"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Messages (from Telegram)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  content: text("content").notNull(),
  direction: text("direction").default("inbound"), // inbound or outbound
  channel: text("channel").default("telegram"),
  sentiment: text("sentiment"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const telegramSessions = pgTable("telegram_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionString: text("session_string").notNull(),
  phoneNumber: text("phone_number").notNull(),
  lastUsed: timestamp("last_used"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
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

export const insertTelegramSessionSchema = createInsertSchema(telegramSessions).pick({
  userId: true,
  sessionString: true,
  phoneNumber: true,
  lastUsed: true,
  isActive: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
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
  employeeCount: true,
  foundedYear: true,
  parentCompanyId: true,
  type: true,
  status: true,
  tags: true,
  customFields: true,
  fundingDetails: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  firstName: true,
  lastName: true,
  jobTitle: true,
  department: true,
  telegramId: true,
  phone: true,
  email: true,
  alternativeEmail: true,
  linkedinUrl: true,
  twitterHandle: true,
  facebookUrl: true,
  otherSocialProfiles: true,
  companyId: true,
  reportsToId: true,
  preferredContactMethod: true,
  timeZone: true,
  availabilityHours: true,
  doNotContact: true,
  type: true,
  status: true,
  leadScore: true,
  tags: true,
  customFields: true,
  nextFollowUpDate: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  contactId: true,
  content: true,
  direction: true,
  channel: true,
  sentiment: true,
  metadata: true,
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
  subject: true,
  notes: true,
  outcome: true,
  nextSteps: true,
  scheduledFor: true,
  duration: true,
  status: true,
  location: true,
  metadata: true,
});

export const messageSuggestions = pgTable("message_suggestions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  suggestion: text("suggestion").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSuggestionSchema = createInsertSchema(messageSuggestions).pick({
  messageId: true,
  suggestion: true,
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
export type InsertMessageSuggestion = z.infer<typeof insertMessageSuggestionSchema>;
export type InsertTelegramSession = z.infer<typeof insertTelegramSessionSchema>;

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
export type MessageSuggestion = typeof messageSuggestions.$inferSelect;
export type TelegramSession = typeof telegramSessions.$inferSelect;