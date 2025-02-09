import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { InsertUser, User, Contact, Company, Message, Announcement, 
         users, contacts, companies, messages, announcements,
         TelegramChannel, telegramChannels, InsertContact, InsertCompany,
         InsertMessage, InsertAnnouncement, InsertTelegramChannel,
         channelInvitations, ChannelInvitation, InsertChannelInvitation,
         TelegramChat, InsertTelegramChat, CompanySuggestion, InsertCompanySuggestion,
         telegramChats, companySuggestions } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Contacts
  getContact(id: number): Promise<Contact | undefined>;
  getContactByTelegramId(telegramId: string): Promise<Contact | undefined>;
  listContacts(): Promise<Contact[]>;
  createContact(contact: InsertContact & { createdById: number }): Promise<Contact>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  listCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany & { createdById: number }): Promise<Company>;

  // Messages
  getMessage(id: number): Promise<Message | undefined>;
  listMessages(contactId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Announcements  
  getAnnouncement(id: number): Promise<Announcement | undefined>;
  listAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement & { createdById: number }): Promise<Announcement>;

  // Telegram Channels
  getTelegramChannel(id: number): Promise<TelegramChannel | undefined>;
  getTelegramChannelByTelegramId(telegramId: string): Promise<TelegramChannel | undefined>;
  listTelegramChannels(): Promise<TelegramChannel[]>;
  createTelegramChannel(channel: InsertTelegramChannel & { createdById: number }): Promise<TelegramChannel>;

  // Channel Invitations
  getChannelInvitation(id: number): Promise<ChannelInvitation | undefined>;
  listChannelInvitations(channelId: number): Promise<ChannelInvitation[]>;
  createChannelInvitation(invitation: InsertChannelInvitation & { createdById: number }): Promise<ChannelInvitation>;
  updateInvitationStatus(id: number, status: string): Promise<ChannelInvitation>;
  incrementInvitationUses(id: number): Promise<ChannelInvitation>;

  // Telegram Chats
  getTelegramChat(id: number): Promise<TelegramChat | undefined>;
  getTelegramChatByTelegramId(telegramId: string): Promise<TelegramChat | undefined>;
  listTelegramChats(): Promise<TelegramChat[]>;
  createTelegramChat(chat: InsertTelegramChat & { createdById: number }): Promise<TelegramChat>;
  updateTelegramChatStatus(id: number, status: string): Promise<TelegramChat>;
  updateTelegramChatUnreadCount(id: number, unreadCount: number): Promise<TelegramChat>;

  // Company Suggestions
  getCompanySuggestion(id: number): Promise<CompanySuggestion | undefined>;
  listCompanySuggestions(chatId: number): Promise<CompanySuggestion[]>;
  createCompanySuggestion(suggestion: InsertCompanySuggestion): Promise<CompanySuggestion>;
  updateCompanySuggestionStatus(id: number, status: string): Promise<CompanySuggestion>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
  }

  // Auth
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Contacts
  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async getContactByTelegramId(telegramId: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.telegramId, telegramId));
    return contact;
  }

  async listContacts(): Promise<Contact[]> {
    return await db.select().from(contacts);
  }

  async createContact(contact: InsertContact & { createdById: number }): Promise<Contact> {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  // Companies
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async listCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async createCompany(company: InsertCompany & { createdById: number }): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  // Messages
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async listMessages(contactId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.contactId, contactId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  // Announcements
  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement;
  }

  async listAnnouncements(): Promise<Announcement[]> {
    return await db.select()
      .from(announcements)
      .orderBy(announcements.createdAt);
  }

  async createAnnouncement(announcement: InsertAnnouncement & { createdById: number }): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
    return newAnnouncement;
  }

  // Telegram Channels
  async getTelegramChannel(id: number): Promise<TelegramChannel | undefined> {
    const [channel] = await db.select().from(telegramChannels).where(eq(telegramChannels.id, id));
    return channel;
  }

  async getTelegramChannelByTelegramId(telegramId: string): Promise<TelegramChannel | undefined> {
    const [channel] = await db.select().from(telegramChannels).where(eq(telegramChannels.telegramId, telegramId));
    return channel;
  }

  async listTelegramChannels(): Promise<TelegramChannel[]> {
    return await db.select().from(telegramChannels);
  }

  async createTelegramChannel(channel: InsertTelegramChannel & { createdById: number }): Promise<TelegramChannel> {
    const [newChannel] = await db.insert(telegramChannels).values(channel).returning();
    return newChannel;
  }

  // Channel Invitations
  async getChannelInvitation(id: number): Promise<ChannelInvitation | undefined> {
    const [invitation] = await db.select().from(channelInvitations).where(eq(channelInvitations.id, id));
    return invitation;
  }

  async listChannelInvitations(channelId: number): Promise<ChannelInvitation[]> {
    return await db.select()
      .from(channelInvitations)
      .where(eq(channelInvitations.channelId, channelId))
      .orderBy(channelInvitations.createdAt);
  }

  async createChannelInvitation(invitation: InsertChannelInvitation & { createdById: number }): Promise<ChannelInvitation> {
    const [newInvitation] = await db.insert(channelInvitations)
      .values({
        ...invitation,
        createdAt: sql`now()`,
      })
      .returning();
    return newInvitation;
  }

  async updateInvitationStatus(id: number, status: string): Promise<ChannelInvitation> {
    const [updatedInvitation] = await db.update(channelInvitations)
      .set({ status })
      .where(eq(channelInvitations.id, id))
      .returning();
    return updatedInvitation;
  }

  async incrementInvitationUses(id: number): Promise<ChannelInvitation> {
    const [updatedInvitation] = await db.update(channelInvitations)
      .set({
        currentUses: sql`${channelInvitations.currentUses} + 1`,
      })
      .where(eq(channelInvitations.id, id))
      .returning();
    return updatedInvitation;
  }

  // Telegram Chats
  async getTelegramChat(id: number): Promise<TelegramChat | undefined> {
    const [chat] = await db.select().from(telegramChats).where(eq(telegramChats.id, id));
    return chat;
  }

  async getTelegramChatByTelegramId(telegramId: string): Promise<TelegramChat | undefined> {
    const [chat] = await db.select().from(telegramChats).where(eq(telegramChats.telegramId, telegramId));
    return chat;
  }

  async listTelegramChats(): Promise<TelegramChat[]> {
    return await db.select().from(telegramChats).orderBy(telegramChats.lastMessageAt);
  }

  async createTelegramChat(chat: InsertTelegramChat & { createdById: number }): Promise<TelegramChat> {
    const [newChat] = await db.insert(telegramChats).values(chat).returning();
    return newChat;
  }

  async updateTelegramChatStatus(id: number, status: string): Promise<TelegramChat> {
    const [updatedChat] = await db
      .update(telegramChats)
      .set({ status })
      .where(eq(telegramChats.id, id))
      .returning();
    return updatedChat;
  }

  async updateTelegramChatUnreadCount(id: number, unreadCount: number): Promise<TelegramChat> {
    const [updatedChat] = await db
      .update(telegramChats)
      .set({ unreadCount })
      .where(eq(telegramChats.id, id))
      .returning();
    return updatedChat;
  }

  // Company Suggestions
  async getCompanySuggestion(id: number): Promise<CompanySuggestion | undefined> {
    const [suggestion] = await db.select().from(companySuggestions).where(eq(companySuggestions.id, id));
    return suggestion;
  }

  async listCompanySuggestions(chatId: number): Promise<CompanySuggestion[]> {
    return await db
      .select()
      .from(companySuggestions)
      .where(eq(companySuggestions.chatId, chatId))
      .orderBy(companySuggestions.confidenceScore);
  }

  async createCompanySuggestion(suggestion: InsertCompanySuggestion): Promise<CompanySuggestion> {
    const [newSuggestion] = await db.insert(companySuggestions).values(suggestion).returning();
    return newSuggestion;
  }

  async updateCompanySuggestionStatus(id: number, status: string): Promise<CompanySuggestion> {
    const [updatedSuggestion] = await db
      .update(companySuggestions)
      .set({ status })
      .where(eq(companySuggestions.id, id))
      .returning();
    return updatedSuggestion;
  }
}

export const storage = new DatabaseStorage();