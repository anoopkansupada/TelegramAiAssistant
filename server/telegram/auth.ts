import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { APIError } from "../utils/errors";
import { computeCheck } from "telegram/Password";
import bigInt from "big-integer";

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
      maxConcurrentDownloads: 10,
      deviceModel: "Telegram Web",
      systemVersion: "Chrome",
      appVersion: "1.0.0"
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

    // Type assertion since we know the structure
    const phoneCodeHash = (result as any).phoneCodeHash as string;
    logger.info('Verification code sent successfully', { phoneNumber });
    return { phoneCodeHash };
  } catch (error: any) {
    logger.error('Failed to request verification code', error);
    throw APIError.fromTelegramError(error);
  } finally {
    await client.disconnect();
  }
}

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
      maxConcurrentDownloads: 10,
      deviceModel: "Telegram Web",
      systemVersion: "Chrome",
      appVersion: "1.0.0"
    }
  );

  try {
    await client.connect();

    const signInResult = await client.invoke(new Api.auth.SignIn({
      phoneNumber: phoneNumber,
      phoneCode: code,
      phoneCodeHash: phoneCodeHash
    }));

    if ((signInResult as any)._ === 'auth.authorizationSignUpRequired') {
      throw new TelegramAuthenticationError(
        TelegramAuthError.INVALID_CREDENTIALS,
        'Sign up required'
      );
    }

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
      maxConcurrentDownloads: 10,
      deviceModel: "Telegram Web",
      systemVersion: "Chrome",
      appVersion: "1.0.0"
    }
  );

  try {
    await client.connect();

    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const { A, M1 } = await computeCheck(passwordInfo, password);

    const srpId = passwordInfo.srpId ? 
      bigInt(passwordInfo.srpId.toString()) : 
      undefined;

    await client.invoke(new Api.auth.CheckPassword({
      password: {
        className: "InputCheckPasswordSRP",
        srpId: srpId || bigInt(0), // Use 0 as fallback if srpId is undefined
        A: Buffer.from(A),
        M1: Buffer.from(M1)
      }
    }));

    logger.info('2FA password verified successfully');
  } catch (error: any) {
    logger.error('Failed to verify 2FA password', error);
    throw APIError.fromTelegramError(error);
  } finally {
    await client.disconnect();
  }
}