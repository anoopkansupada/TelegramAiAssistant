import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import { CustomLogger } from "./logger";

const logger = new CustomLogger("[TelegramValidator]");

export interface SessionHealth {
  isValid: boolean;
  dcId?: number;
  layer?: number;
  lastActivity?: Date;
  latency?: number;
  error?: string;
}

export async function validateTelegramSession(client: TelegramClient): Promise<SessionHealth> {
  try {
    const startTime = Date.now();
    
    // Basic connection test
    await client.connect();
    
    // Authorization check
    const me = await client.getMe();
    if (!me) {
      return { 
        isValid: false,
        error: "Failed to get user info" 
      };
    }

    // Get DC information
    const nearestDc = await client.invoke(new Api.help.GetNearestDc());
    const config = await client.invoke(new Api.help.GetConfig());

    // Test API functionality
    try {
      const dialogs = await client.getDialogs({ limit: 1 });
      if (!dialogs || !dialogs.length) {
        logger.warn("Session appears valid but cannot fetch dialogs");
      }
    } catch (error) {
      logger.warn("Dialog fetch failed during validation", { error });
    }

    // Calculate latency
    const latency = Date.now() - startTime;

    const health: SessionHealth = {
      isValid: true,
      dcId: nearestDc.thisDc,
      layer: config.layer,
      lastActivity: new Date(),
      latency,
    };

    logger.info("Session validation successful", health);
    return health;

  } catch (error: any) {
    logger.error("Session validation failed:", error);
    return {
      isValid: false,
      error: error.message || "Unknown validation error",
      lastActivity: new Date()
    };
  }
}

export function isFloodError(error: any): boolean {
  return error?.message?.includes('FLOOD_WAIT_') || error?.code === 420;
}

export function isDcMigrationError(error: any): boolean {
  return error?.message?.includes('MIGRATE_') || error?.code === 303;
}

export function extractWaitTime(error: any): number {
  if (!isFloodError(error)) return 0;
  
  const matches = error.message.match(/FLOOD_WAIT_(\d+)/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  
  return error.seconds || 60; // Default to 60 seconds if no specific time found
}

export function extractDcId(error: any): number | null {
  if (!isDcMigrationError(error)) return null;
  
  const matches = error.message.match(/MIGRATE_(\d+)/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  
  return null;
}
