import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { clientManager } from '../userbot-client';
import { CustomLogger } from '../utils/logger';
import fs from 'fs';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const logger = new CustomLogger('[TelegramAuth]');
const SESSION_FILE_PATH = "./telegram.session.json";

async function attemptSessionRecovery(userId: number): Promise<boolean> {
  try {
    logger.info('Attempting session recovery', { userId });

    // Try loading session from file
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const sessionString = fs.readFileSync(SESSION_FILE_PATH, "utf8").trim();
      const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
      const apiHash = process.env.TELEGRAM_API_HASH || "";

      const client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        {
          connectionRetries: 3,
          useWSS: true
        }
      );

      await client.connect();
      const me = await client.getMe();

      if (me) {
        // Save recovered session
        await storage.updateTelegramSession(userId, {
          sessionString,
          lastAuthDate: new Date(),
          lastUsed: new Date(),
          isActive: true
        });
        logger.info('Successfully recovered session', { userId });
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Session recovery failed', { error });
    return false;
  }
}

export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      logger.warn('User not logged in');
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check for active Telegram session
    const telegramSession = await storage.getTelegramSession(req.session.userId);
    if (!telegramSession) {
      logger.warn('No Telegram session found', { userId: req.session.userId });

      // Attempt session recovery
      const recovered = await attemptSessionRecovery(req.session.userId);
      if (!recovered) {
        return res.status(401).json({ message: 'Telegram authentication required' });
      }
    }

    // Validate client connection
    try {
      const client = await clientManager.getClient(req.session.userId);
      const me = await client.getMe(); // Verify connection is active

      if (!me) {
        throw new Error('Invalid session state');
      }

      next();
    } catch (error) {
      logger.error('Failed to validate Telegram client', error);

      // Attempt recovery one last time
      const recovered = await attemptSessionRecovery(req.session.userId);
      if (!recovered) {
        // Clean up invalid session
        await clientManager.cleanupClient(req.session.userId.toString());
        return res.status(401).json({
          message: 'Telegram session invalid, please re-authenticate',
          code: 'TELEGRAM_AUTH_REQUIRED'
        });
      }

      next();
    }
  } catch (error) {
    logger.error('Error in Telegram auth middleware', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}