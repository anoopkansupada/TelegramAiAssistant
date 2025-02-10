import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomLogger } from "./logger";
import { Api } from "telegram/tl";
import { storage } from "../storage";
import { validateTelegramSession, isFloodError, isDcMigrationError, extractWaitTime, extractDcId } from "./telegram-validator";

const logger = new CustomLogger("[SessionCreator]");

// MTProto layer versions for progressive negotiation
const MTProtoLayers = {
  INITIAL: 1,
  LEGACY: 66,
  INTERMEDIATE: 91,
  LATEST: 158
};

const DC_ADDRESSES = {
  1: 'pluto.web.telegram.org',
  2: 'venus.web.telegram.org',
  3: 'aurora.web.telegram.org',
  4: 'vesta.web.telegram.org',
  5: 'flora.web.telegram.org'
};

interface SessionConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  verificationCode: string;
  deviceModel?: string;
  systemVersion?: string;
  appVersion?: string;
  useWSS?: boolean;
  preferredDc?: number;
  layer?: number;
  forceNewSession?: boolean;
}

export async function createSessionString({
  apiId,
  apiHash,
  phoneNumber,
  verificationCode,
  deviceModel = "TelegramCRM",
  systemVersion = process.version,
  appVersion = "1.0.0",
  useWSS = true,
  preferredDc,
  layer = MTProtoLayers.INITIAL,
  forceNewSession = false
}: SessionConfig): Promise<string> {
  logger.info("Starting session creation process", {
    phoneNumber,
    preferredDc,
    layer,
    forceNewSession
  });

  // Try to reuse existing session if possible
  if (!forceNewSession) {
    try {
      const existingSession = await storage.getTelegramSessionByPhone(phoneNumber);
      if (existingSession?.isActive) {
        const client = new TelegramClient(
          new StringSession(existingSession.sessionString),
          apiId,
          apiHash,
          {
            connectionRetries: 3,
            useWSS,
            deviceModel,
            systemVersion,
            appVersion,
            dcId: existingSession.metadata?.lastDcId,
            useIPV6: false,
            timeout: 30000
          }
        );

        logger.info("Attempting to reuse existing session");
        const health = await validateTelegramSession(client);

        if (health.isValid) {
          logger.info("Successfully reused existing session", {
            dcId: health.dcId,
            layer: health.layer,
            latency: health.latency
          });

          // Update session metadata
          await storage.updateTelegramSession(existingSession.id, {
            lastUsed: new Date(),
            metadata: {
              ...existingSession.metadata,
              lastDcId: health.dcId,
              layer: health.layer,
              latency: health.latency
            }
          });

          return existingSession.sessionString;
        } else {
          logger.warn("Existing session validation failed", { error: health.error });
          // Continue to create new session
        }
      }
    } catch (error) {
      logger.warn("Failed to reuse existing session", { error });
      // Continue to create new session
    }
  }

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
    useWSS,
    deviceModel,
    systemVersion,
    appVersion,
    langCode: "en",
    systemLangCode: "en",
    useIPV6: false,
    dcId: preferredDc,
    requestRetries: 3,
    autoReconnect: false,
    downloadRetries: 3,
    floodSleepThreshold: 60,
    timeout: 30000
  });

  try {
    // Connect with progressive layer negotiation
    await progressiveConnect(client);

    // Start authentication with proper error handling
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => "",
      phoneCode: async () => verificationCode,
      onError: handleAuthError,
    });

    // Validate session and ensure optimal DC connection
    const health = await validateTelegramSession(client);
    if (!health.isValid) {
      throw new Error(health.error || "Session validation failed");
    }

    // Ensure optimal DC connection
    if (health.dcId && health.dcId !== client.session.dcId) {
      await handleDcMigration(client, health.dcId);
    }

    // Save session
    const sessionString = client.session.save() as string;

    logger.info("Session created successfully", {
      dcId: health.dcId,
      layer: health.layer,
      latency: health.latency
    });

    await client.disconnect();
    return sessionString;

  } catch (error) {
    logger.error("Failed to create session:", error);
    await client.disconnect();
    throw error;
  }
}

async function progressiveConnect(client: TelegramClient): Promise<void> {
  await client.connect();

  const layers = [MTProtoLayers.INITIAL, MTProtoLayers.LEGACY, MTProtoLayers.INTERMEDIATE, MTProtoLayers.LATEST];

  for (const targetLayer of layers) {
    try {
      await initConnection(client, targetLayer);
      logger.info(`Successfully negotiated layer ${targetLayer}`);
      return;
    } catch (error: any) {
      if (isDcMigrationError(error)) {
        const newDc = extractDcId(error);
        if (newDc) {
          logger.info(`DC migration required during layer negotiation to DC ${newDc}`);
          await handleDcMigration(client, newDc);
          try {
            await initConnection(client, targetLayer);
            return;
          } catch (retryError) {
            logger.warn(`Layer ${targetLayer} negotiation failed after DC migration`, { error: retryError });
          }
        }
      } else if (isFloodError(error)) {
        const waitTime = extractWaitTime(error);
        logger.warn(`Rate limited during layer negotiation, wait ${waitTime}s`);
        throw error;
      }
      logger.warn(`Failed to negotiate layer ${targetLayer}, trying next`, { error: error.message });
    }
  }

  throw new Error("Failed to negotiate any MTProto layer");
}

async function initConnection(client: TelegramClient, layer: number): Promise<void> {
  await client.invoke(new Api.InitConnection({
    apiId: parseInt(process.env.TELEGRAM_API_ID || "0"),
    deviceModel: "TelegramCRM",
    systemVersion: process.version,
    appVersion: "1.0.0",
    langCode: 'en',
    systemLangCode: 'en',
    langPack: '',
    query: new Api.help.GetConfig(),
    proxy: undefined,
    params: undefined
  }));
}

function handleAuthError(err: Error): never {
  if (isDcMigrationError(err)) {
    const newDc = extractDcId(err);
    logger.info("DC migration required during auth", { newDc });
    throw err;
  }

  if (isFloodError(err)) {
    const waitTime = extractWaitTime(err);
    logger.warn(`Rate limited during auth, wait ${waitTime}s`);
    throw err;
  }

  logger.error("Authentication error:", err);
  throw err;
}

async function handleDcMigration(client: TelegramClient, newDc: number): Promise<void> {
  try {
    logger.info(`Migrating to DC ${newDc}`);
    await client.session.setDC(newDc, DC_ADDRESSES[newDc as keyof typeof DC_ADDRESSES], 443);
    await client.disconnect();
    await client.connect();
    logger.info(`Successfully migrated to DC ${newDc}`);
  } catch (error) {
    logger.error(`Failed to migrate to DC ${newDc}:`, error);
    throw error;
  }
}

export function validateSessionString(session: string): boolean {
  if (!session || typeof session !== 'string') {
    return false;
  }

  try {
    const rules = [
      // Minimum length check
      () => session.length >= 100,

      // Base64 segments check
      () => {
        const parts = session.split('.');
        return parts.length >= 2 && 
          parts.every(part => /^[a-zA-Z0-9+/]+={0,2}$/.test(part));
      },

      // DC ID check
      () => {
        const parts = session.split('.');
        const dcId = parseInt(parts[0], 10);
        return !isNaN(dcId) && dcId > 0 && dcId <= 5;
      },

      // Auth key format check
      () => {
        const parts = session.split('.');
        return parts[1] && parts[1].length >= 344; // Minimum auth key length
      }
    ];

    return rules.every(rule => rule());
  } catch (error) {
    logger.error("Error validating session string:", error);
    return false;
  }
}