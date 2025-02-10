// Required Protocol Version
const LAYER = 158;  // Current MTProto layer version

// Proper connection setup
const client = new TelegramClient(stringSession, {
  apiId: process.env.TELEGRAM_API_ID,
  apiHash: process.env.TELEGRAM_API_HASH,
  connectionRetries: 5,
  useWSS: true,
  baseLogger: new CustomLogger(),
  floodSleepThreshold: 60,
});
```

### Migration Management
- Handle layer version changes gracefully
- Implement proper session migration
- Support both MTProto 1.0 and 2.0
- Handle server-initiated migration

### Session Storage
```typescript
// Secure session storage implementation
class SecureSessionStorage {
  async store(session: string): Promise<void> {
    const encrypted = await this.encrypt(session);
    await db.update(telegramSessions)
      .set({ session: encrypted })
      .where(eq(telegramSessions.id, sessionId));
  }

  async retrieve(): Promise<string | null> {
    const session = await db.query.telegramSessions.findFirst({
      where: eq(telegramSessions.isActive, true)
    });
    return session ? await this.decrypt(session.session) : null;
  }
}
```

### Connection Management
```typescript
class TelegramConnectionManager {
  private retryCount = 0;
  private maxRetries = 5;
  private backoffDelay = 1000;

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.retryCount = 0;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        await this.handleRetry(error);
      } else {
        throw new ConnectionError('Failed to connect after max retries');
      }
    }
  }

  private async handleRetry(error: Error): Promise<void> {
    const delay = this.backoffDelay * Math.pow(2, this.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    this.retryCount++;
    await this.connect();
  }
}
```

### Error Handling Patterns
```typescript
class TelegramErrorHandler {
  async handle(error: any): Promise<void> {
    if (error instanceof FloodWaitError) {
      await this.handleFloodWait(error.seconds);
    } else if (error instanceof PhoneMigrationError) {
      await this.handlePhoneMigration(error.dcId);
    } else if (error instanceof SessionPasswordNeededError) {
      await this.handle2FARequired();
    } else {
      await this.handleGenericError(error);
    }
  }

  private async handleFloodWait(seconds: number): Promise<void> {
    console.warn(`Rate limited, waiting ${seconds} seconds`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
```

### Media Handling
```typescript
class MediaHandler {
  private readonly MAX_BOT_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_MTPROTO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

  async uploadFile(file: Buffer, fileName: string): Promise<string> {
    if (file.length > this.MAX_BOT_SIZE) {
      return await this.handleLargeFileUpload(file, fileName);
    }
    return await this.normalUpload(file, fileName);
  }

  private async handleLargeFileUpload(file: Buffer, fileName: string): Promise<string> {
    const chunks = this.splitIntoChunks(file);
    const fileId = await this.initiateUpload(fileName, chunks.length);

    for (let i = 0; i < chunks.length; i++) {
      await this.uploadChunk(fileId, i, chunks[i]);
    }

    return await this.finalizeUpload(fileId);
  }
}
```

## Current Implementation Status

### Complete Features
1. Basic Authentication Flow
   - Phone number verification
   - Code verification
   - 2FA support
   - Session management

2. Message Handling
   - Send/receive messages
   - Media handling
   - Message history
   - Chat management

### Pending Improvements
1. Session Management
   - [ ] Automatic session rotation
   - [ ] Better error recovery
   - [ ] Connection pooling
   - [ ] Rate limiting

2. Media Handling
   - [ ] Chunked uploads
   - [ ] Progress tracking
   - [ ] Retry mechanism
   - [ ] Format validation

3. Error Handling
   - [ ] Comprehensive error codes
   - [ ] Automatic recovery
   - [ ] Rate limit handling
   - [ ] Migration support

## Next Steps

### Short Term (1-2 weeks)
1. Implement session rotation
2. Add connection monitoring
3. Improve error recovery
4. Add comprehensive logging

### Medium Term (1-2 months)
1. Implement media handling
2. Add rate limiting
3. Improve type safety
4. Add automated testing

### Long Term (3+ months)
1. Full MTProto support
2. Enhanced security features
3. Performance optimizations
4. Clustering support

## References
1. [Telegram MTProto Documentation](https://core.telegram.org/mtproto)
2. [Telegram API Documentation](https://core.telegram.org/api)
3. [Bot API Documentation](https://core.telegram.org/bots/api)
4. [Error Handling Guide](https://core.telegram.org/api/errors)

## Telegram Session Management

### Issue: Session Persistence
**Problem**: Telegram sessions expire unexpectedly, requiring frequent re-authentication

**Root Cause** (Based on Telegram Docs):
- Session strings need proper storage and encryption
- Missing proper connection lifecycle management
- Incorrect handling of connection states
- No proper error recovery mechanism

**Official Telegram Recommendations**:
1. Session Storage:
   ```typescript
   // Store session string securely
   const stringSession = new StringSession("");
   const client = new TelegramClient(stringSession, apiId, apiHash, {
     connectionRetries: 5
   });
   ```

2. Connection Lifecycle:
   ```typescript
   // Recommended connection handling
   await client.connect();
   await client.getDialogs();
   const sessionString = client.session.save();
   // Store sessionString securely in database
   ```

3. Error Recovery:
   ```typescript
   // Implement exponential backoff
   const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_DELAY);
   await new Promise(resolve => setTimeout(resolve, delay));
   ```

**Current Implementation**:
1. Session Storage Solution:
   - Store sessions in PostgreSQL with encryption
   - Track session metadata (last used, expiry)
   - Implement automatic cleanup for expired sessions

2. Connection Management:
   ```typescript
   class TelegramClientManager {
     private async connect(session: string): Promise<void> {
       try {
         // Get stored session from database
         const storedSession = await this.getStoredSession(session);

         // Attempt connection with retry logic
         await this.connectWithRetry(storedSession);

         // Update session last used timestamp
         await this.updateSessionTimestamp(storedSession.id);
       } catch (error) {
         await this.handleConnectionError(error);
       }
     }
   }
   ```

3. Error Handling:
   ```typescript
   private async handleConnectionError(error: any): Promise<void> {
     if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
       // Session invalid, needs re-authentication
       await this.invalidateSession();
     } else if (error.message.includes('FLOOD_WAIT_')) {
       // Handle rate limiting
       const seconds = parseInt(error.message.split('_').pop());
       await this.handleFloodWait(seconds);
     }
   }
   ```

**Current Issues and Solutions**:

1. Schema Definition Issues:
   ```typescript
   // Issue: Missing type definition for currentUses in channelInvitations
   // Solution: Update schema.ts to include proper type
   export const channelInvitations = pgTable('channel_invitations', {
     currentUses: integer('current_uses').default(0),
   });

   // Issue: Incorrect sorting field in telegramChats
   // Solution: Add lastMessageAt to schema
   export const telegramChats = pgTable('telegram_chats', {
     lastMessageAt: timestamp('last_message_at').defaultNow(),
   });
   ```

2. Type Safety Improvements:
   ```typescript
   // Issue: Nullable jobTitle in contact info
   // Solution: Update type definition
   interface ContactInfo {
     name: string;
     jobTitle?: string; // Make explicitly optional
   }
   ```

3. Error Code Standardization:
   ```typescript
   // Issue: Inconsistent error codes
   // Solution: Define enum for error codes
   export enum TelegramErrorCode {
     AUTH_RESTART = 'AUTH_RESTART',
     SESSION_EXPIRED = 'SESSION_EXPIRED',
     PHONE_CODE_EXPIRED = 'PHONE_CODE_EXPIRED',
     PHONE_CODE_INVALID = 'PHONE_CODE_INVALID',
   }
   ```

**Next Steps**:
1. Implement session rotation
2. Add connection state monitoring
3. Improve error recovery mechanisms
4. Add comprehensive logging

**Status**: In Progress 🔄

## Authentication Flow

### Issue: 2FA Implementation
**Problem**: Two-factor authentication validation fails with cryptographic errors

**Official Telegram Guidance**:
1. Password Handling:
   ```typescript
   // Get password info first
   const passwordInfo = await client.invoke(new Api.account.GetPassword());

   // Use official password computation
   const { A, M1 } = await computeCheck(passwordInfo, password);

   // Verify with server
   await client.invoke(new Api.auth.CheckPassword({
     password: {
       A: Buffer.from(A),
       M1: Buffer.from(M1)
     }
   }));
   ```

2. Error Handling:
   ```typescript
   if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
     throw new Error('2FA_REQUIRED');
   }
   ```

**Status**: Implemented ✅

## Monitoring and Debugging

### Key Areas to Monitor:
1. Session Health:
   - Track session age and usage patterns
   - Monitor authentication failures
   - Log connection state changes

2. Performance Metrics:
   - Connection establishment time
   - Request latency
   - Rate limit encounters

3. Error Patterns:
   - Authentication failures
   - Network timeouts
   - API errors

### Debugging Tools:
1. Custom Logger Implementation:
   ```typescript
   class CustomLogger extends Logger {
     _log(level: LogLevel, message: string): void {
       const timestamp = new Date().toISOString();
       console.log(`${timestamp} [TelegramClient] [${level}] ${message}`);
     }
   }
   ```

2. Health Checks:
   ```typescript
   setInterval(async () => {
     await this.checkConnectionHealth();
     await this.validateSession();
     await this.updateMetrics();
   }, HEALTH_CHECK_INTERVAL);