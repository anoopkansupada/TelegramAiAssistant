import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { clientManager } from '../userbot-client';
import { CustomLogger } from '../utils/logger';

const logger = new CustomLogger('[TelegramAuth]');

async function attemptSessionRecovery(userId: number): Promise<boolean> {
  try {
    logger.info('Attempting session recovery', { userId });

    const telegramSession = await storage.getTelegramSession(userId);
    if (!telegramSession) {
      logger.warn('No session found in database');
      return false;
    }

    try {
      // Use the improved client manager to attempt connection
      const client = await clientManager.getClient(userId);
      const me = await client.getMe();

      if (me) {
        await storage.updateTelegramSession(telegramSession.id, {
          lastUsed: new Date(),
          isActive: true,
          retryCount: 0
        });
        logger.info('Successfully recovered session', { userId });
        return true;
      }

      logger.warn('Session recovery failed - invalid session state');
      return false;
    } catch (error: any) {
      // Handle specific Telegram errors
      if (error.code === 401) { // AUTH_KEY_UNREGISTERED
        logger.warn('Session invalidated, needs re-authentication');
        await storage.deactivateTelegramSession(telegramSession.id);
        return false;
      }

      if (error.code === 420) { // FLOOD_WAIT
        const retryAfter = error.seconds || 30;
        logger.warn('Rate limited, need to wait', { retryAfter });
        await storage.updateTelegramSession(telegramSession.id, {
          retryCount: telegramSession.retryCount ?? 0 + 1,
          metadata: { ...(telegramSession.metadata ?? {}), lastFloodWait: retryAfter }
        });
        return false;
      }

      throw error;
    }
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
    if (!req.session.userId) {
      logger.warn('User not logged in');
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const telegramSession = await storage.getTelegramSession(req.session.userId);
    if (!telegramSession || !telegramSession.isActive) {
      logger.warn('No active Telegram session found', { userId: req.session.userId });

      const recovered = await attemptSessionRecovery(req.session.userId);
      if (!recovered) {
        return res.status(401).json({ 
          message: 'Telegram authentication required',
          code: 'TELEGRAM_AUTH_REQUIRED'
        });
      }
    }

    try {
      const client = await clientManager.getClient(req.session.userId);
      const me = await client.getMe();

      if (!me) {
        throw new Error('Invalid session state');
      }

      // Update last activity
      if (telegramSession) {
        await storage.updateTelegramSession(telegramSession.id, {
          lastUsed: new Date()
        });
      }

      next();
    } catch (error: any) {
      logger.error('Failed to validate Telegram client', { error });

      // Handle specific error cases
      if (error.code === 401) {
        if (telegramSession) {
          await storage.deactivateTelegramSession(telegramSession.id);
        }
        return res.status(401).json({
          message: 'Telegram session expired, please re-authenticate',
          code: 'TELEGRAM_AUTH_EXPIRED'
        });
      }

      if (error.code === 420) {
        const retryAfter = error.seconds || 30;
        return res.status(429).json({
          message: `Rate limited, please try again in ${retryAfter} seconds`,
          code: 'TELEGRAM_RATE_LIMIT',
          retryAfter
        });
      }

      const recovered = await attemptSessionRecovery(req.session.userId);
      if (!recovered) {
        await clientManager.disconnectClient(req.session.userId);
        return res.status(401).json({
          message: 'Telegram session invalid, please re-authenticate', 
          code: 'TELEGRAM_AUTH_FAILED'
        });
      }

      next();
    }
  } catch (error) {
    logger.error('Error in Telegram auth middleware', { error });
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}