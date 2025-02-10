import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { storage } from "../storage";

const logger = new CustomLogger("[TelegramAuth]");

/**
 * Request a verification code for the provided phone number
 */
export async function requestVerificationCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
  logger.info('Requesting verification code', { phoneNumber });

  const client = new TelegramClient(
    new StringSession(""),
    parseInt(process.env.TELEGRAM_API_ID!),
    process.env.TELEGRAM_API_HASH!,
    {
      connectionRetries: 5,
      useWSS: true,
      maxConcurrentDownloads: 10
    }
  );

  try {
    await client.connect();

    const result = await client.sendCode({
      phoneNumber,
      apiId: parseInt(process.env.TELEGRAM_API_ID!),
      apiHash: process.env.TELEGRAM_API_HASH!,
    });

    logger.info('Verification code sent successfully', { phoneNumber });
    return { phoneCodeHash: result.phoneCodeHash };
  } catch (error) {
    logger.error('Failed to request verification code', error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Verify the provided code and create a new session
 */
export async function verifyCode(
  phoneNumber: string,
  code: string,
  phoneCodeHash: string
): Promise<string> {
  logger.info('Verifying code', { phoneNumber });

  const client = new TelegramClient(
    new StringSession(""),
    parseInt(process.env.TELEGRAM_API_ID!),
    process.env.TELEGRAM_API_HASH!,
    {
      connectionRetries: 5,
      useWSS: true,
      maxConcurrentDownloads: 10
    }
  );

  try {
    await client.connect();

    // Sign in with the provided code
    const signInResult = await client.signIn({
      phoneNumber,
      phoneCode: code,
      phoneCodeHash,
    });

    // Get the session string for storage
    const session = client.session.save() as unknown as string;
    logger.info('Code verified successfully', { phoneNumber });

    return session;
  } catch (error) {
    logger.error('Failed to verify code', error);
    if (error instanceof Error && error.message.includes('PHONE_CODE_INVALID')) {
      throw new Error('PHONE_CODE_INVALID');
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Verify 2FA password if required
 */
export async function verify2FA(
  password: string,
  client: TelegramClient
): Promise<void> {
  logger.info('Verifying 2FA password');

  try {
    const result = await client.checkPassword(password);
    logger.info('2FA password verified successfully');
    return result;
  } catch (error) {
    logger.error('Failed to verify 2FA password', error);
    throw error;
  }
}