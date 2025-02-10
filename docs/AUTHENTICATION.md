// Password hashing implementation
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Password verification
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
```

### Session Management
- Uses express-session with PostgreSQL store
- 30-day session lifetime
- Automatic cleanup of expired sessions
- Secure session cookie configuration

### Security Measures
1. Password Security:
   - Scrypt-based password hashing
   - Unique salt per password
   - Timing-safe comparison

2. Session Security:
   - HTTP-only cookies
   - Secure flag in production
   - CSRF protection
   - Session fixation prevention

### Headers Configuration
```typescript
// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: https:",
  ].join('; '));

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // HSTS (in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});
```

## 2. Telegram Authentication

### Flow Overview
1. Phone Number Verification
2. Code Verification
3. Optional 2FA
4. Session Storage

### Implementation Notes

#### 1. Session Storage
```typescript
class TelegramSessionManager {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  }

  async storeSession(userId: number, session: string): Promise<void> {
    const encrypted = await this.encryptSession(session);
    await db.update(telegramSessions)
      .set({ 
        session: encrypted,
        lastUsed: new Date(),
        isActive: true
      })
      .where(eq(telegramSessions.userId, userId));
  }

  async retrieveSession(userId: number): Promise<string | null> {
    const session = await db.query.telegramSessions.findFirst({
      where: and(
        eq(telegramSessions.userId, userId),
        eq(telegramSessions.isActive, true)
      )
    });

    return session ? await this.decryptSession(session.session) : null;
  }
}
```

#### 2. Two-Factor Authentication
```typescript
class TelegramTwoFactorAuth {
  async verify2FA(password: string): Promise<boolean> {
    const passwordInfo = await client.invoke(
      new Api.account.GetPassword()
    );

    const { srpId, A, M1 } = await this.calculateSRP(
      password,
      passwordInfo
    );

    try {
      await client.invoke(new Api.auth.CheckPassword({
        srpId,
        A: Buffer.from(A),
        M1: Buffer.from(M1)
      }));
      return true;
    } catch (error) {
      this.handle2FAError(error);
      return false;
    }
  }
}
```

### Security Best Practices

1. Session Encryption:
   - AES-256-GCM encryption for sessions
   - Unique IV per encryption
   - Regular key rotation

2. Error Handling:
   ```typescript
   class AuthenticationError extends Error {
     constructor(
       message: string,
       public code: string,
       public retryAfter?: number
     ) {
       super(message);
     }
   }

   function handle2FAError(error: any) {
     if (error.message.includes('PASSWORD_HASH_INVALID')) {
       throw new AuthenticationError(
         'Invalid 2FA password',
         'INVALID_2FA_PASSWORD'
       );
     }
     if (error.message.includes('FLOOD_WAIT_')) {
       const seconds = parseInt(error.message.split('_').pop());
       throw new AuthenticationError(
         'Too many attempts',
         'FLOOD_WAIT',
         seconds
       );
     }
   }
   ```

3. Rate Limiting:
   ```typescript
   const rateLimiter = {
     phoneCode: {
       window: 300000, // 5 minutes
       max: 3
     },
     verification: {
       window: 60000, // 1 minute
       max: 5
     },
     twoFactor: {
       window: 60000, // 1 minute
       max: 3
     }
   };
   ```

## 3. Error Handling

### Common Error Codes
```typescript
enum AuthErrorCode {
  // Application Auth Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Telegram Auth Errors
  INVALID_PHONE = 'INVALID_PHONE',
  CODE_EXPIRED = 'CODE_EXPIRED',
  INVALID_CODE = 'INVALID_CODE',
  INVALID_2FA = 'INVALID_2FA',

  // Rate Limiting
  FLOOD_WAIT = 'FLOOD_WAIT',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS'
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  message: string;
  code: AuthErrorCode;
  details?: Record<string, any>;
  retryAfter?: number;
}
```

## 4. Monitoring and Logging

### Authentication Events
```typescript
enum AuthEvent {
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH = 'auth.token.refresh',
  SESSION_EXPIRED = 'auth.session.expired',
  TELEGRAM_AUTH_START = 'auth.telegram.start',
  TELEGRAM_AUTH_SUCCESS = 'auth.telegram.success',
  TELEGRAM_AUTH_FAILURE = 'auth.telegram.failure'
}
```

### Logging Implementation
```typescript
class AuthLogger {
  log(event: AuthEvent, data: Record<string, any>) {
    console.log({
      timestamp: new Date().toISOString(),
      event,
      ...data,
      // Exclude sensitive information
      filtered: this.filterSensitiveData(data)
    });
  }

  private filterSensitiveData(data: Record<string, any>) {
    const sensitiveFields = ['password', 'token', 'session'];
    return Object.fromEntries(
      Object.entries(data).filter(
        ([key]) => !sensitiveFields.includes(key)
      )
    );
  }
}