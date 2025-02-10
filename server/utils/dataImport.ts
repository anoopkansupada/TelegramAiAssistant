import { parse } from 'node-html-parser';
import { readFile } from 'fs/promises';
import path from 'path';
import { storage } from '../storage';
import { CustomLogger } from './logger';

const logger = new CustomLogger('[DataImport]');

async function readHtmlFile(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return parse(content);
  } catch (error) {
    logger.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

async function importContacts() {
  try {
    const root = await readHtmlFile('attached_assets/contacts.html');
    const contactElements = root.querySelectorAll('.contact');
    
    for (const element of contactElements) {
      const name = element.querySelector('.name')?.text || '';
      const [firstName, lastName] = name.split(' ');
      const phone = element.querySelector('.phone')?.text;
      
      await storage.createContact({
        firstName,
        lastName: lastName || null,
        phone: phone || null,
        createdById: 1, // Default admin user
      });
    }
    
    logger.info('Contacts imported successfully');
  } catch (error) {
    logger.error('Error importing contacts:', error);
    throw error;
  }
}

async function importMessages(userId: number) {
  try {
    for (let i = 1; i <= 14; i++) {
      const filename = i === 1 ? 'messages.html' : `messages${i}.html`;
      const root = await readHtmlFile(`attached_assets/${filename}`);
      const messageElements = root.querySelectorAll('.message');
      
      for (const element of messageElements) {
        const fromId = element.querySelector('.from')?.text || 'unknown';
        const content = element.querySelector('.text')?.text || '';
        
        await storage.createMessage({
          fromId,
          toId: userId.toString(),
          content,
        });
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
    const root = await readHtmlFile('attached_assets/chats.html');
    const chatElements = root.querySelectorAll('.chat');
    
    for (const element of chatElements) {
      const title = element.querySelector('.name')?.text || 'Untitled Chat';
      const type = element.classList.contains('group') ? 'group' : 'private';
      const telegramId = element.id || Date.now().toString();
      
      await storage.createTelegramChat({
        telegramId,
        title,
        type,
        status: 'synced',
        createdById: 1, // Default admin user
      });
    }
    
    logger.info('Chats imported successfully');
  } catch (error) {
    logger.error('Error importing chats:', error);
    throw error;
  }
}

export async function importTelegramData(userId: number) {
  logger.info('Starting Telegram data import');
  
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
