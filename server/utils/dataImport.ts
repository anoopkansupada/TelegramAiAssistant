import { parse } from 'node-html-parser';
import { readFile } from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { messages, contacts, telegramChats } from '@shared/schema';
import { CustomLogger } from './logger';

const logger = new CustomLogger('[DataImport]');

async function readHtmlFile(filePath: string) {
  try {
    logger.info(`Reading file: ${filePath}`);
    const content = await readFile(filePath, 'utf-8');
    return parse(content);
  } catch (error) {
    logger.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

async function importContacts() {
  try {
    logger.info('Starting contacts import');
    const root = await readHtmlFile('attached_assets/contacts.html');
    const contactElements = root.querySelectorAll('.contact');

    logger.info(`Found ${contactElements.length} contacts to import`);

    for (const element of contactElements) {
      const name = element.querySelector('.name')?.text || '';
      const [firstName, lastName] = name.split(' ');
      const phone = element.querySelector('.phone')?.text;

      await db.insert(contacts)
        .values({
          firstName,
          lastName: lastName || '',
          phone: phone || '',
          department: '',
          email: '',
          createdById: 1, // Default admin user
          status: 'active',
          telegramId: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID for imported contacts
        })
        .returning()
        .execute();
    }

    logger.info('Contacts imported successfully');
  } catch (error) {
    logger.error('Error importing contacts:', error);
    throw error;
  }
}

async function importMessages(userId: number) {
  try {
    logger.info('Starting messages import');

    // Create or get default contact for imported messages
    const [defaultContact] = await db.insert(contacts)
      .values({
        firstName: 'Imported',
        lastName: 'Messages',
        createdById: userId,
        status: 'active',
        telegramId: `imported-default-${Date.now()}`, // Add unique telegram ID for default contact
      })
      .returning()
      .execute();

    for (let i = 1; i <= 14; i++) {
      const filename = i === 1 ? 'messages.html' : `messages${i}.html`;
      logger.info(`Processing ${filename}`);

      const root = await readHtmlFile(`attached_assets/${filename}`);
      const messageElements = root.querySelectorAll('.message');

      logger.info(`Found ${messageElements.length} messages in ${filename}`);

      for (const element of messageElements) {
        const content = element.querySelector('.text')?.text || '';

        await db.insert(messages)
          .values({
            contactId: defaultContact.id,
            content: content,
            sentiment: 'neutral', // Default sentiment
          })
          .returning()
          .execute();
      }

      logger.info(`Messages from ${filename} imported successfully`);
    }
  } catch (error) {
    logger.error('Error importing messages:', error);
    throw error;
  }
}

async function importChats() {
  try {
    logger.info('Starting chats import');
    const root = await readHtmlFile('attached_assets/chats.html');
    const chatElements = root.querySelectorAll('.chat');

    logger.info(`Found ${chatElements.length} chats to import`);

    for (const element of chatElements) {
      const title = element.querySelector('.name')?.text || 'Untitled Chat';
      const type = element.classList.contains('group') ? 'group' : 'private';
      const telegramId = element.id || Date.now().toString();

      await db.insert(telegramChats)
        .values({
          telegramId,
          title,
          type,
          status: 'synced',
          createdById: 1, // Default admin user
          importance: 0,
          unreadCount: 0,
        })
        .returning()
        .execute();
    }

    logger.info('Chats imported successfully');
  } catch (error) {
    logger.error('Error importing chats:', error);
    throw error;
  }
}

export async function importTelegramData(userId: number) {
  logger.info('Starting Telegram data import', { userId });

  try {
    await importContacts();
    await importChats();
    await importMessages(userId);

    logger.info('Telegram data import completed successfully');
  } catch (error) {
    logger.error('Error during Telegram data import:', error);
    throw error;
  }
}