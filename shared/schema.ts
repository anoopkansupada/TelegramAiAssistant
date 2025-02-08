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

// Insert schemas
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
