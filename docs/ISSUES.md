// Wrong
const [user] = await db.select().from(users).where(eq(users.id, id));

// Correct
const user = await db.query.users.findFirst({
  where: eq(users.id, id)
});
```

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

**Remaining Challenges**:
1. Session Rotation:
   - Need to implement automatic session rotation for long-lived connections
   - Should handle graceful migration between sessions
   - Must maintain connection state during rotation

2. Connection States:
   - Better state management for different connection phases
   - Proper handling of disconnection scenarios
   - Improved logging for debugging connection issues

3. Rate Limiting:
   - Implement proper flood wait handling
   - Add request queuing system
   - Track and respect server-side limits

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