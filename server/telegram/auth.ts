import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { APIError } from "../utils/errors";

const logger = new CustomLogger("[TelegramAuth]");

export enum TelegramAuthError {
  INVALID_CREDENTIALS = 'TELEGRAM_INVALID_CREDENTIALS',
  PHONE_NUMBER_INVALID = 'TELEGRAM_PHONE_NUMBER_INVALID',
  PHONE_NUMBER_FLOOD = 'TELEGRAM_PHONE_NUMBER_FLOOD',
  CODE_EXPIRED = 'TELEGRAM_CODE_EXPIRED',
  CODE_INVALID = 'TELEGRAM_CODE_INVALID',
  PASSWORD_INVALID = 'TELEGRAM_PASSWORD_INVALID',
  SESSION_EXPIRED = 'TELEGRAM_SESSION_EXPIRED',
  API_ID_INVALID = 'TELEGRAM_API_ID_INVALID',
  CONNECTION_ERROR = 'TELEGRAM_CONNECTION_ERROR',
  PHONE_CODE_INVALID = 'TELEGRAM_PHONE_CODE_INVALID'
}

export class TelegramAuthenticationError extends Error {
  constructor(
    public code: TelegramAuthError,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'TelegramAuthenticationError';
  }
}

/**
 * Request a verification code for the provided phone number
 */
export async function requestVerificationCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
  logger.info('Requesting verification code', { phoneNumber });

  const stringSession = new StringSession(""); // Empty session for requesting code
  const client = new TelegramClient(
    stringSession,
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
    const result = await client.invoke(new Api.auth.SendCode({
      phoneNumber,
      apiId: parseInt(process.env.TELEGRAM_API_ID!),
      apiHash: process.env.TELEGRAM_API_HASH!,
      settings: new Api.CodeSettings({
        allowFlashcall: false,
        currentNumber: true,
        allowAppHash: true,
      })
    }));

    logger.info('Verification code sent successfully', { phoneNumber });
    return { phoneCodeHash: result.phoneCodeHash as string };
  } catch (error: any) {
    logger.error('Failed to request verification code', error);
    throw APIError.fromTelegramError(error);
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

  const stringSession = new StringSession(""); // Empty session for verification
  const client = new TelegramClient(
    stringSession,
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
      phoneCodeHash
    });

    if ('signUp' in signInResult && signInResult.signUp) {
      throw new TelegramAuthenticationError(
        TelegramAuthError.INVALID_CREDENTIALS,
        'Sign up required'
      );
    }

    // Get the session string for storage
    const session = client.session.save() as unknown as string;
    logger.info('Code verified successfully', { phoneNumber });

    return session;
  } catch (error: any) {
    logger.error('Failed to verify code', error);
    throw APIError.fromTelegramError(error);
  } finally {
    await client.disconnect();
  }
}

/**
 * Verify 2FA password if required
 */
export async function verify2FA(
  password: string,
  session: string
): Promise<void> {
  logger.info('Verifying 2FA password');

  const stringSession = new StringSession(session);
  const client = new TelegramClient(
    stringSession,
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
    const result = await client.checkPassword(password);

    if (!result) {
      throw new TelegramAuthenticationError(
        TelegramAuthError.PASSWORD_INVALID,
        'Invalid 2FA password'
      );
    }

    logger.info('2FA password verified successfully');
  } catch (error: any) {
    logger.error('Failed to verify 2FA password', error);
    throw APIError.fromTelegramError(error);
  } finally {
    await client.disconnect();
  }
}