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

  // Basic Information
  name: text("name").notNull(),
  legalName: text("legal_name"),
  industry: text("industry"),
  size: text("size"), // small, medium, large, enterprise
  location: text("location"),
  headquarters: text("headquarters"),

  // Contact Information
  phone: text("phone"),
  email: text("email"),
  website: text("website"),

  // Social Media Profiles
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  facebookUrl: text("facebook_url"),
  githubUrl: text("github_url"),

  // Business Information
  description: text("description"),
  mission: text("mission"),
  vision: text("vision"),
  annualRevenue: text("annual_revenue"),
  employeeCount: integer("employee_count"),
  foundedYear: integer("founded_year"),

  // Company Structure
  parentCompanyId: integer("parent_company_id"),
  subsidiaries: text("subsidiaries").array(),

  // Industry Specific
  competitors: text("competitors").array(),
  marketPosition: text("market_position"),

  // Financial Information
  fundingStage: text("funding_stage"), // seed, series_a, series_b, etc
  totalFunding: text("total_funding"),
  fundingRounds: jsonb("funding_rounds"), // Array of funding rounds with details
  lastFundingDate: timestamp("last_funding_date"),
  stockSymbol: text("stock_symbol"),
  marketCap: text("market_cap"),

  // Classification
  type: text("type"), // prospect, customer, partner, competitor
  status: text("status").default("active"), // active, inactive, lead
  priority: text("priority").default("medium"), // low, medium, high
  tags: text("tags").array(),

  // Engagement
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  engagementScore: integer("engagement_score"),

  // Custom & Additional Data
  customFields: jsonb("custom_fields"),
  documents: jsonb("documents"), // Store links to important company documents
  notes: text("notes"),

  // Metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  // Knowledge Hub
  knowledgeHub: jsonb("knowledge_hub").default({
    documents: [],
    categories: [],
    access_rules: {},
    metadata: {}
  }),
  documentCategories: text("document_categories").array(),
  lastDocumentUpdate: timestamp("last_document_update"),
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
  entities: jsonb("entities").default([]),
  topics: text("topics").array(),
  summary: text("summary"),
  contentAnalysis: jsonb("content_analysis").default({
    confidence: 0,
    language: null,
    toxicity: null,
    engagement: null
  }),
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

// Add opportunities table for better opportunity tracking
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  value: text("value"),
  currency: text("currency").default("USD"),
  stage: text("stage").notNull(), // prospecting, qualification, proposal, negotiation, closed_won, closed_lost
  probability: integer("probability"),
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),

  // Additional Details
  source: text("source"),
  type: text("type"),
  products: text("products").array(),
  competitors: text("competitors").array(),

  // Custom Data
  customFields: jsonb("custom_fields"),
  notes: text("notes"),

  // Metadata
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Add new document-related schemas
export const companyDocuments = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  documentType: text("document_type").notNull(),
  category: text("category").notNull(),
  url: text("url").notNull(),
  version: text("version"),
  status: text("status").default("active"),
  accessLevel: text("access_level").default("internal"),
  metadata: jsonb("metadata"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  archivedAt: timestamp("archived_at"),
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
}).extend({
  password: z.string().min(4, "Password must be at least 4 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
});

// Update insertCompanySchema to include more robust validation
export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  legalName: true,
  industry: true,
  size: true,
  location: true,
  headquarters: true,
  phone: true,
  email: true,
  website: true,
  linkedinUrl: true,
  twitterHandle: true,
  facebookUrl: true,
  githubUrl: true,
  description: true,
  mission: true,
  vision: true,
  annualRevenue: true,
  employeeCount: true,
  foundedYear: true,
  parentCompanyId: true,
  subsidiaries: true,
  competitors: true,
  marketPosition: true,
  fundingStage: true,
  totalFunding: true,
  fundingRounds: true,
  lastFundingDate: true,
  stockSymbol: true,
  marketCap: true,
  type: true,
  status: true,
  priority: true,
  tags: true,
  lastContactedAt: true,
  nextFollowUpDate: true,
  engagementScore: true,
  customFields: true,
  documents: true,
  notes: true,
  createdById: true,
}).extend({
  knowledgeHub: z.object({
    documents: z.array(z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      url: z.string(),
      version: z.string().optional(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime().optional()
    })),
    categories: z.array(z.string()),
    access_rules: z.record(z.object({
      roles: z.array(z.string()),
      permissions: z.array(z.string())
    })),
    metadata: z.record(z.unknown())
  }).optional(),
  documentCategories: z.array(z.string()).optional(),
  lastDocumentUpdate: z.string().datetime().optional(),
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
  entities: true,
  topics: true,
  summary: true,
  contentAnalysis: true,
}).extend({
  contentAnalysis: z.object({
    confidence: z.number().min(0).max(1),
    language: z.string().nullable(),
    toxicity: z.number().min(0).max(1).nullable(),
    engagement: z.number().min(0).max(1).nullable()
  }).optional()
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

// Add the insert schemas for the new table
export const insertOpportunitySchema = createInsertSchema(opportunities).pick({
  companyId: true,
  name: true,
  description: true,
  value: true,
  currency: true,
  stage: true,
  probability: true,
  expectedCloseDate: true,
  actualCloseDate: true,
  source: true,
  type: true,
  products: true,
  competitors: true,
  customFields: true,
  notes: true,
});

// Add insert schema for company documents
export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments).pick({
  companyId: true,
  title: true,
  description: true,
  documentType: true,
  category: true,
  url: true,
  version: true,
  status: true,
  accessLevel: true,
  metadata: true,
}).extend({
  title: z.string().min(1, "Title is required").max(255),
  documentType: z.enum(["contract", "proposal", "report", "presentation", "other"]),
  category: z.string().min(1, "Category is required"),
  url: z.string().url("Invalid document URL"),
  version: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  accessLevel: z.enum(["internal", "restricted", "public"]).default("internal"),
  metadata: z.record(z.unknown()).optional()
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
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;

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
export type Opportunity = typeof opportunities.$inferSelect;
export type CompanyDocument = typeof companyDocuments.$inferSelect;