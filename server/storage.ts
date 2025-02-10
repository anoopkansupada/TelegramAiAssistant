import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { InsertUser, User, Contact, Company, Message, Announcement,
         users, contacts, companies, messages, announcements,
         TelegramChannel, telegramChannels, InsertContact, InsertCompany,
         InsertMessage, InsertAnnouncement, InsertTelegramChannel,
         channelInvitations, ChannelInvitation, InsertChannelInvitation,
         TelegramChat, InsertTelegramChat, CompanySuggestion, InsertCompanySuggestion,
         telegramChats, companySuggestions, messageSuggestions, InsertMessageSuggestion, MessageSuggestion,
         telegramSessions, InsertTelegramSession, TelegramSession } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import {
  InsertFollowupSchedule, FollowupSchedule, followupSchedules
} from "@shared/schema";

const MemoryStore = createMemoryStore(session);

export class DatabaseStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
    // Run cleanup every 24 hours
    setInterval(() => this.cleanupExpiredSessions(), 24 * 60 * 60 * 1000);
  }

  // Auth operations with error handling
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .execute();
      return user;
    } catch (error) {
      console.error('Error in getUser:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .execute();
      return user;
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning()
        .execute();
      return user;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning()
        .execute();
      return user;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

  // Contacts
  async getContact(id: number): Promise<Contact | undefined> {
    try {
      return await db.query.contacts.findFirst({
        where: eq(contacts.id, id)
      });
    } catch (error) {
      console.error('Error in getContact:', error);
      throw error;
    }
  }

  async getContactByTelegramId(telegramId: string): Promise<Contact | undefined> {
    try {
      return await db.query.contacts.findFirst({where: eq(contacts.telegramId, telegramId)});
    } catch (error) {
      console.error('Error in getContactByTelegramId:', error);
      throw error;
    }
  }

  async listContacts(): Promise<Contact[]> {
    try {
      return await db.query.contacts.findMany();
    } catch (error) {
      console.error('Error in listContacts:', error);
      throw error;
    }
  }

  async createContact(contact: InsertContact & { createdById: number }): Promise<Contact> {
    try {
      const [newContact] = await db.insert(contacts).values(contact).returning();
      return newContact;
    } catch (error) {
      console.error('Error in createContact:', error);
      throw error;
    }
  }

  // Companies
  async getCompany(id: number): Promise<Company | undefined> {
    try {
      return await db.query.companies.findFirst({
        where: eq(companies.id, id)
      });
    } catch (error) {
      console.error('Error in getCompany:', error);
      throw error;
    }
  }

  async listCompanies(): Promise<Company[]> {
    try {
      return await db.query.companies.findMany();
    } catch (error) {
      console.error('Error in listCompanies:', error);
      throw error;
    }
  }

  async createCompany(company: InsertCompany & { createdById: number }): Promise<Company> {
    try {
      const [newCompany] = await db.insert(companies).values(company).returning();
      return newCompany;
    } catch (error) {
      console.error('Error in createCompany:', error);
      throw error;
    }
  }

  // Messages
  async getMessage(id: number): Promise<Message | undefined> {
    try {
      return await db.query.messages.findFirst({
        where: eq(messages.id, id)
      });
    } catch (error) {
      console.error('Error in getMessage:', error);
      throw error;
    }
  }

  async listMessages(contactId: number): Promise<Message[]> {
    try {
      return await db
        .select()
        .from(messages)
        .where(eq(messages.contactId, contactId))
        .orderBy(messages.createdAt);
    } catch (error) {
      console.error('Error in listMessages:', error);
      throw error;
    }
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    try {
      const [newMessage] = await db.insert(messages).values(message).returning();
      return newMessage;
    } catch (error) {
      console.error('Error in createMessage:', error);
      throw error;
    }
  }

  // Announcements  
  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    try {
      return await db.query.announcements.findFirst({where: eq(announcements.id, id)});
    } catch (error) {
      console.error('Error in getAnnouncement:', error);
      throw error;
    }
  }

  async listAnnouncements(): Promise<Announcement[]> {
    try {
      return await db
        .select()
        .from(announcements)
        .orderBy(announcements.createdAt);
    } catch (error) {
      console.error('Error in listAnnouncements:', error);
      throw error;
    }
  }

  async createAnnouncement(announcement: InsertAnnouncement & { createdById: number }): Promise<Announcement> {
    try {
      const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
      return newAnnouncement;
    } catch (error) {
      console.error('Error in createAnnouncement:', error);
      throw error;
    }
  }

  // Telegram Channels
  async getTelegramChannel(id: number): Promise<TelegramChannel | undefined> {
    try {
      return await db.query.telegramChannels.findFirst({where: eq(telegramChannels.id, id)});
    } catch (error) {
      console.error('Error in getTelegramChannel:', error);
      throw error;
    }
  }

  async getTelegramChannelByTelegramId(telegramId: string): Promise<TelegramChannel | undefined> {
    try {
      return await db.query.telegramChannels.findFirst({where: eq(telegramChannels.telegramId, telegramId)});
    } catch (error) {
      console.error('Error in getTelegramChannelByTelegramId:', error);
      throw error;
    }
  }

  async listTelegramChannels(): Promise<TelegramChannel[]> {
    try {
      return await db.query.telegramChannels.findMany();
    } catch (error) {
      console.error('Error in listTelegramChannels:', error);
      throw error;
    }
  }

  async createTelegramChannel(channel: InsertTelegramChannel & { createdById: number }): Promise<TelegramChannel> {
    try {
      const [newChannel] = await db.insert(telegramChannels).values(channel).returning();
      return newChannel;
    } catch (error) {
      console.error('Error in createTelegramChannel:', error);
      throw error;
    }
  }

  // Channel Invitations
  async getChannelInvitation(id: number): Promise<ChannelInvitation | undefined> {
    try {
      return await db.query.channelInvitations.findFirst({where: eq(channelInvitations.id, id)});
    } catch (error) {
      console.error('Error in getChannelInvitation:', error);
      throw error;
    }
  }

  async listChannelInvitations(channelId: number): Promise<ChannelInvitation[]> {
    try {
      return await db
        .select()
        .from(channelInvitations)
        .where(eq(channelInvitations.channelId, channelId))
        .orderBy(channelInvitations.createdAt);
    } catch (error) {
      console.error('Error in listChannelInvitations:', error);
      throw error;
    }
  }

  async createChannelInvitation(invitation: InsertChannelInvitation & { createdById: number }): Promise<ChannelInvitation> {
    try {
      const [newInvitation] = await db.insert(channelInvitations)
        .values({
          ...invitation,
          currentUses: 0,
          createdAt: sql`CURRENT_TIMESTAMP`
        })
        .returning();
      return newInvitation;
    } catch (error) {
      console.error('Error in createChannelInvitation:', error);
      throw error;
    }
  }

  async updateInvitationStatus(id: number, status: string): Promise<ChannelInvitation> {
    try {
      const [updatedInvitation] = await db.update(channelInvitations)
        .set({ status })
        .where(eq(channelInvitations.id, id))
        .returning();
      return updatedInvitation;
    } catch (error) {
      console.error('Error in updateInvitationStatus:', error);
      throw error;
    }
  }

  async incrementInvitationUses(id: number): Promise<ChannelInvitation> {
    try {
      const [updatedInvitation] = await db.update(channelInvitations)
        .set({
          currentUses: sql`${channelInvitations.currentUses} + 1`,
        })
        .where(eq(channelInvitations.id, id))
        .returning();
      return updatedInvitation;
    } catch (error) {
      console.error('Error in incrementInvitationUses:', error);
      throw error;
    }
  }

  // Telegram Chats
  async getTelegramChat(id: number): Promise<TelegramChat | undefined> {
    try {
      return await db.query.telegramChats.findFirst({where: eq(telegramChats.id, id)});
    } catch (error) {
      console.error('Error in getTelegramChat:', error);
      throw error;
    }
  }

  async getTelegramChatByTelegramId(telegramId: string): Promise<TelegramChat | undefined> {
    try {
      return await db.query.telegramChats.findFirst({where: eq(telegramChats.telegramId, telegramId)});
    } catch (error) {
      console.error('Error in getTelegramChatByTelegramId:', error);
      throw error;
    }
  }

  async listTelegramChats(): Promise<TelegramChat[]> {
    try {
      return await db.query.telegramChats.findMany({orderBy:{lastMessageAt: 'asc'}});
    } catch (error) {
      console.error('Error in listTelegramChats:', error);
      throw error;
    }
  }

  async createTelegramChat(chat: InsertTelegramChat & { createdById: number }): Promise<TelegramChat> {
    try {
      const [newChat] = await db.insert(telegramChats).values(chat).returning();
      return newChat;
    } catch (error) {
      console.error('Error in createTelegramChat:', error);
      throw error;
    }
  }

  async updateTelegramChatStatus(id: number, status: string): Promise<TelegramChat> {
    try {
      const [updatedChat] = await db
        .update(telegramChats)
        .set({ status })
        .where(eq(telegramChats.id, id))
        .returning();
      return updatedChat;
    } catch (error) {
      console.error('Error in updateTelegramChatStatus:', error);
      throw error;
    }
  }

  async updateTelegramChatUnreadCount(id: number, unreadCount: number): Promise<TelegramChat> {
    try {
      const [updatedChat] = await db
        .update(telegramChats)
        .set({ unreadCount })
        .where(eq(telegramChats.id, id))
        .returning();
      return updatedChat;
    } catch (error) {
      console.error('Error in updateTelegramChatUnreadCount:', error);
      throw error;
    }
  }

  async updateTelegramChatMetadata(id: number, metadata: any): Promise<TelegramChat> {
    try {
      const [updatedChat] = await db
        .update(telegramChats)
        .set({ metadata })
        .where(eq(telegramChats.id, id))
        .returning();
      return updatedChat;
    } catch (error) {
      console.error('Error in updateTelegramChatMetadata:', error);
      throw error;
    }
  }

  async updateTelegramChatCategory(id: number, category: string, importance: number): Promise<TelegramChat> {
    try {
      const [updatedChat] = await db
        .update(telegramChats)
        .set({ category, importance })
        .where(eq(telegramChats.id, id))
        .returning();
      return updatedChat;
    } catch (error) {
      console.error('Error in updateTelegramChatCategory:', error);
      throw error;
    }
  }

  async listChatsByCategory(category: string): Promise<TelegramChat[]> {
    try {
      return await db
        .select()
        .from(telegramChats)
        .where(eq(telegramChats.category, category))
        .orderBy(telegramChats.importance);
    } catch (error) {
      console.error('Error in listChatsByCategory:', error);
      throw error;
    }
  }

  async listChatsByImportance(minImportance: number): Promise<TelegramChat[]> {
    try {
      return await db
        .select()
        .from(telegramChats)
        .where(sql`${telegramChats.importance} >= ${minImportance}`)
        .orderBy(telegramChats.importance);
    } catch (error) {
      console.error('Error in listChatsByImportance:', error);
      throw error;
    }
  }

  // Company Suggestions
  async getCompanySuggestion(id: number): Promise<CompanySuggestion | undefined> {
    try {
      return await db.query.companySuggestions.findFirst({where: eq(companySuggestions.id, id)});
    } catch (error) {
      console.error('Error in getCompanySuggestion:', error);
      throw error;
    }
  }

  async listCompanySuggestions(chatId: number): Promise<CompanySuggestion[]> {
    try {
      return await db
        .select()
        .from(companySuggestions)
        .where(eq(companySuggestions.chatId, chatId))
        .orderBy(companySuggestions.confidenceScore);
    } catch (error) {
      console.error('Error in listCompanySuggestions:', error);
      throw error;
    }
  }

  async createCompanySuggestion(suggestion: InsertCompanySuggestion): Promise<CompanySuggestion> {
    try {
      const [newSuggestion] = await db.insert(companySuggestions).values(suggestion).returning();
      return newSuggestion;
    } catch (error) {
      console.error('Error in createCompanySuggestion:', error);
      throw error;
    }
  }

  async updateCompanySuggestionStatus(id: number, status: string): Promise<CompanySuggestion> {
    try {
      const [updatedSuggestion] = await db
        .update(companySuggestions)
        .set({ status })
        .where(eq(companySuggestions.id, id))
        .returning();
      return updatedSuggestion;
    } catch (error) {
      console.error('Error in updateCompanySuggestionStatus:', error);
      throw error;
    }
  }

  async updateCompanySuggestionConfidence(
    id: number,
    confidenceScore: number,
    confidenceFactors: any
  ): Promise<CompanySuggestion> {
    try {
      const [updatedSuggestion] = await db
        .update(companySuggestions)
        .set({ confidenceScore, confidenceFactors })
        .where(eq(companySuggestions.id, id))
        .returning();
      return updatedSuggestion;
    } catch (error) {
      console.error('Error in updateCompanySuggestionConfidence:', error);
      throw error;
    }
  }

  async listAutoConfirmableSuggestions(minConfidence: number): Promise<CompanySuggestion[]> {
    try {
      return await db
        .select()
        .from(companySuggestions)
        .where(
          and(
            eq(companySuggestions.status, 'pending'),
            sql`${companySuggestions.confidenceScore} >= ${minConfidence}`
          )
        )
        .orderBy(companySuggestions.confidenceScore);
    } catch (error) {
      console.error('Error in listAutoConfirmableSuggestions:', error);
      throw error;
    }
  }

  // Followup Schedules
  async getFollowupSchedule(id: number): Promise<FollowupSchedule | undefined> {
    try {
      return await db
        .query.followupSchedules.findFirst({where: eq(followupSchedules.id, id)});
    } catch (error) {
      console.error('Error in getFollowupSchedule:', error);
      throw error;
    }
  }

  async listFollowupSchedules(chatId: number): Promise<FollowupSchedule[]> {
    try {
      return await db
        .select()
        .from(followupSchedules)
        .where(eq(followupSchedules.chatId, chatId))
        .orderBy(followupSchedules.scheduledFor);
    } catch (error) {
      console.error('Error in listFollowupSchedules:', error);
      throw error;
    }
  }

  async createFollowupSchedule(
    schedule: InsertFollowupSchedule & { createdById: number }
  ): Promise<FollowupSchedule> {
    try {
      const [newSchedule] = await db
        .insert(followupSchedules)
        .values(schedule)
        .returning();
      return newSchedule;
    } catch (error) {
      console.error('Error in createFollowupSchedule:', error);
      throw error;
    }
  }

  async updateFollowupStatus(id: number, status: string): Promise<FollowupSchedule> {
    try {
      const [updatedSchedule] = await db
        .update(followupSchedules)
        .set({ status })
        .where(eq(followupSchedules.id, id))
        .returning();
      return updatedSchedule;
    } catch (error) {
      console.error('Error in updateFollowupStatus:', error);
      throw error;
    }
  }

  async listPendingFollowups(): Promise<FollowupSchedule[]> {
    try {
      return await db
        .select()
        .from(followupSchedules)
        .where(
          and(
            eq(followupSchedules.status, 'pending'),
            sql`${followupSchedules.scheduledFor} <= now()`
          )
        )
        .orderBy(followupSchedules.scheduledFor);
    } catch (error) {
      console.error('Error in listPendingFollowups:', error);
      throw error;
    }
  }

  // Extended User Methods
  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    try {
      return await db.query.users.findFirst({
        where: eq(users.username, phoneNumber)
      });
    } catch (error) {
      console.error('Error in getUserByPhoneNumber:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | undefined> {
    try {
      return await db.query.users.findFirst({
        where: eq(users.id, id)
      });
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error;
    }
  }


  async getRecentMessages(contactId: number, limit: number): Promise<Message[]> {
    try {
      return await db
        .select()
        .from(messages)
        .where(eq(messages.contactId, contactId))
        .orderBy(sql`${messages.createdAt} DESC`)
        .limit(limit);
    } catch (error) {
      console.error('Error in getRecentMessages:', error);
      throw error;
    }
  }

  async createMessageSuggestions(messageId: number, suggestions: string[]): Promise<MessageSuggestion[]> {
    try {
      const suggestionValues = suggestions.map(suggestion => ({
        messageId,
        suggestion,
      }));

      return await db
        .insert(messageSuggestions)
        .values(suggestionValues)
        .returning();
    } catch (error) {
      console.error('Error in createMessageSuggestions:', error);
      throw error;
    }
  }


  // Telegram Sessions
  async getTelegramSession(userId: number): Promise<TelegramSession | undefined> {
    try {
      return await db.query.telegramSessions.findFirst({
        where: and(
          eq(telegramSessions.userId, userId),
          eq(telegramSessions.isActive, true)
        )
      });
    } catch (error) {
      console.error('Error in getTelegramSession:', error);
      throw error;
    }
  }

  async createTelegramSession(session: InsertTelegramSession & { userId: number }): Promise<TelegramSession> {
    try {
      // Deactivate any existing active sessions for this user
      await db.update(telegramSessions)
        .set({ isActive: false })
        .where(and(
          eq(telegramSessions.userId, session.userId),
          eq(telegramSessions.isActive, true)
        ));

      // Create new session
      const [newSession] = await db.insert(telegramSessions)
        .values({
          ...session,
          lastUsed: new Date(),
          lastAuthDate: new Date(),
        })
        .returning();
      return newSession;
    } catch (error) {
      console.error('Error in createTelegramSession:', error);
      throw error;
    }
  }

  async updateTelegramSession(id: number, updates: Partial<TelegramSession>): Promise<TelegramSession> {
    try {
      const [updatedSession] = await db.update(telegramSessions)
        .set({
          ...updates,
          lastUsed: new Date()
        })
        .where(eq(telegramSessions.id, id))
        .returning();
      return updatedSession;
    } catch (error) {
      console.error('Error in updateTelegramSession:', error);
      throw error;
    }
  }

  async deactivateTelegramSession(id: number): Promise<void> {
    try {
      await db.update(telegramSessions)
        .set({
          isActive: false,
          lastUsed: new Date()
        })
        .where(eq(telegramSessions.id, id));
    } catch (error) {
      console.error('Error in deactivateTelegramSession:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Cleanup sessions older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await db.update(telegramSessions)
        .set({ isActive: false })
        .where(
          and(
            eq(telegramSessions.isActive, true),
            sql`${telegramSessions.lastUsed} < ${thirtyDaysAgo}`
          )
        );
    } catch (error) {
      console.error('Error in cleanupExpiredSessions:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();