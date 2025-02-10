import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { storage } from "../storage";
import { TelegramPool } from "./pool";

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
    }
  );

  try {
    await client.connect();
    const { phoneCodeHash } = await client.sendCode({
      apiId: parseInt(process.env.TELEGRAM_API_ID!),
      apiHash: process.env.TELEGRAM_API_HASH!,
      phoneNumber: phoneNumber,
      settings: new Api.CodeSettings({
        allowFlashcall: false,
        currentNumber: true,
        allowAppHash: true,
      }),
    });

    logger.info('Verification code sent successfully', { phoneNumber });
    return { phoneCodeHash };
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
    }
  );

  try {
    await client.connect();
    
    await client.signIn({
      phoneNumber,
      phoneCodeHash,
      phoneCode: code,
    });

    // Get the session string for storage
    const session = client.session.save() as string;
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
  client: TelegramClient,
  password: string
): Promise<void> {
  logger.info('Verifying 2FA password');

  try {
    await client.checkPassword(password);
    logger.info('2FA password verified successfully');
  } catch (error) {
    logger.error('Failed to verify 2FA password', error);
    throw error;
  }
}
