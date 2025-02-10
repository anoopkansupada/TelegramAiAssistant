import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { clientManager } from '../userbot-client';
import { CustomLogger } from '../utils/logger';

const logger = new CustomLogger('[TelegramAuth]');

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
      return res.status(401).json({ message: 'Telegram authentication required' });
    }

    // Validate client connection
    try {
      const client = await clientManager.getClient(req.session.userId);
      await client.getMe(); // Verify connection is active
      next();
    } catch (error) {
      logger.error('Failed to validate Telegram client', error);
      // Clean up invalid session
      await clientManager.cleanupClient(req.session.userId.toString());
      return res.status(401).json({ message: 'Telegram session invalid' });
    }
  } catch (error) {
    logger.error('Error in Telegram auth middleware', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
