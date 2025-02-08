import createMemoryStore from "memorystore";
import session from "express-session";
import { InsertUser, User, Contact, Company, Message, Announcement, InsertContact, InsertCompany, InsertMessage, InsertAnnouncement } from "@shared/schema";

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

  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contacts: Map<number, Contact>;
  private companies: Map<number, Company>;
  private messages: Map<number, Message>;
  private announcements: Map<number, Announcement>;
  private currentIds: {[key: string]: number};
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.companies = new Map();
    this.messages = new Map();
    this.announcements = new Map();
    this.currentIds = {
      users: 1,
      contacts: 1, 
      companies: 1,
      messages: 1,
      announcements: 1
    };
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
  }

  // Auth
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Contacts
  async getContact(id: number): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactByTelegramId(telegramId: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(c => c.telegramId === telegramId);
  }

  async listContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async createContact(contact: InsertContact & { createdById: number }): Promise<Contact> {
    const id = this.currentIds.contacts++;
    const newContact = { ...contact, id };
    this.contacts.set(id, newContact);
    return newContact;
  }

  // Companies
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async listCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async createCompany(company: InsertCompany & { createdById: number }): Promise<Company> {
    const id = this.currentIds.companies++;
    const newCompany = { ...company, id };
    this.companies.set(id, newCompany);
    return newCompany;
  }

  // Messages
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async listMessages(contactId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.contactId === contactId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentIds.messages++;
    const newMessage = { ...message, id, createdAt: new Date() };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  // Announcements
  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    return this.announcements.get(id);
  }

  async listAnnouncements(): Promise<Announcement[]> {
    return Array.from(this.announcements.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAnnouncement(announcement: InsertAnnouncement & { createdById: number }): Promise<Announcement> {
    const id = this.currentIds.announcements++;
    const newAnnouncement = { ...announcement, id, createdAt: new Date() };
    this.announcements.set(id, newAnnouncement);
    return newAnnouncement;
  }
}

export const storage = new MemStorage();
