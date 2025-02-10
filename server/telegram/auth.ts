import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomLogger } from "../utils/logger";
import { APIError } from "../utils/errors";
import { computeCheck } from "telegram/Password";
import bigInt from "big-integer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const logger = new CustomLogger("[TelegramAuth]");
const SESSION_FILE_PATH = "./telegram.session.json";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

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

// Utility functions for session encryption
const encryptSession = (sessionString: string): string => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(sessionString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decryptSession = (encryptedSession: string): string => {
    const [ivHex, authTagHex, encryptedData] = encryptedSession.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

function createTelegramClient(session: string = "") {
    return new TelegramClient(
        new StringSession(session),
        parseInt(process.env.TELEGRAM_API_ID!),
        process.env.TELEGRAM_API_HASH!,
        {
            connectionRetries: 5,
            useWSS: true,
            maxConcurrentDownloads: 10,
            deviceModel: "Telegram Web",
            systemVersion: "Chrome",
            appVersion: "1.0.0",
            autoReconnect: true,
            retryDelay: 2000
        }
    );
}

export async function loadSession(): Promise<string | null> {
    try {
        if (!fs.existsSync(SESSION_FILE_PATH)) {
            return null;
        }
        const encryptedSession = fs.readFileSync(SESSION_FILE_PATH, 'utf8').trim();
        return decryptSession(encryptedSession);
    } catch (error) {
        logger.error('Failed to load session:', error);
        return null;
    }
}

export async function saveSession(sessionString: string): Promise<void> {
    try {
        const encryptedSession = encryptSession(sessionString);
        fs.writeFileSync(SESSION_FILE_PATH, encryptedSession);
        logger.info('Session saved successfully');
    } catch (error) {
        logger.error('Failed to save session:', error);
        throw error;
    }
}

export async function validateSession(session: string): Promise<boolean> {
    const client = createTelegramClient(session);
    try {
        await client.connect();
        const isValid = await client.checkAuthorization();
        await client.disconnect();
        return isValid;
    } catch (error) {
        logger.error('Session validation failed:', error);
        return false;
    }
}

export async function requestVerificationCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
    logger.info('Requesting verification code', { phoneNumber });
    const client = createTelegramClient();

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

        if (!result || !(result as any).phoneCodeHash) {
            throw new Error('Failed to get phone code hash from Telegram');
        }

        const phoneCodeHash = (result as any).phoneCodeHash as string;
        logger.info('Verification code sent successfully', { phoneNumber });

        // Store the phone code hash temporarily
        process.env.TELEGRAM_PHONE_CODE_HASH = phoneCodeHash;

        return { phoneCodeHash };
    } catch (error: any) {
        if (error.errorMessage?.includes('PHONE_MIGRATE_')) {
            const dcId = parseInt(error.errorMessage.split('_').pop() || '0');
            await client.session.setDC(dcId, '', '');
            return requestVerificationCode(phoneNumber);
        }
        logger.error('Failed to request verification code', error);
        throw APIError.fromTelegramError(error);
    } finally {
        await client.disconnect();
    }
}

export async function verifyCode(
    phoneNumber: string,
    code: string,
    phoneCodeHash: string = process.env.TELEGRAM_PHONE_CODE_HASH || ''
): Promise<string> {
    logger.info('Verifying code', { phoneNumber });
    const client = createTelegramClient();

    if (!phoneCodeHash) {
        throw new Error('Phone code hash not found. Please request a new verification code.');
    }

    try {
        await client.connect();
        const signInResult = await client.invoke(new Api.auth.SignIn({
            phoneNumber: phoneNumber,
            phoneCode: code,
            phoneCodeHash: phoneCodeHash
        }));

        if (!signInResult) {
            throw new Error('Sign in failed - no response from Telegram');
        }

        if ((signInResult as any)._ === 'auth.authorizationSignUpRequired') {
            throw new Error('Sign up required');
        }

        const session = client.session.save() as unknown as string;
        await saveSession(session);
        logger.info('Code verified and session saved successfully', { phoneNumber });

        // Clear the stored phone code hash
        delete process.env.TELEGRAM_PHONE_CODE_HASH;

        return session;
    } catch (error: any) {
        if (error.errorMessage?.includes('PHONE_MIGRATE_')) {
            const dcId = parseInt(error.errorMessage.split('_').pop() || '0');
            await client.session.setDC(dcId, '', '');
            return verifyCode(phoneNumber, code, phoneCodeHash);
        }
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
    const client = createTelegramClient(session);

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
                srpId: srpId || bigInt(0),
                A: Buffer.from(A),
                M1: Buffer.from(M1)
            }
        }));

        const verifiedSession = client.session.save() as unknown as string;
        await saveSession(verifiedSession);
        logger.info('2FA password verified and session saved successfully');
    } catch (error: any) {
        logger.error('Failed to verify 2FA password', error);
        throw APIError.fromTelegramError(error);
    } finally {
        await client.disconnect();
    }
}