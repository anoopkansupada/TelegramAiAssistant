### Connection Management
```typescript
// Use connection pooling with proper limits
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500 // Prevent connection leaks
});

// Implement proper cleanup
async function cleanup() {
  await pool.end();
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
```

```typescript
## 2. Telegram Integration

### Session Management
```typescript
class TelegramSessionManager {
  // Implement proper session rotation
  async rotateSession(): Promise<void> {
    const oldSession = await this.getCurrentSession();
    const newSession = await this.createNewSession();

    await db.transaction(async (tx) => {
      await this.deactivateSession(oldSession.id);
      await this.activateSession(newSession.id);
    });
  }

  // Regular health checks
  async checkSessionHealth(): Promise<void> {
    const session = await this.getCurrentSession();
    if (!session.isValid()) {
      await this.rotateSession();
    }
  }

  // Secure session storage
  private async encryptSession(session: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(session, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + authTag.toString('hex');
  }

  // Session cleanup and recovery
  async handleSessionError(error: Error): Promise<void> {
    logger.error('Session error:', { error, sessionId: this.currentSessionId });
    await this.invalidateCurrentSession();
    await this.rotateSession();
    await this.reestablishConnection();
  }
}
```

```typescript
### Error Handling and Rate Limiting
```typescript
class TelegramRateLimiter {
  private rateLimits = new Map<string, {
    count: number;
    timestamp: number;
  }>();

  async execute<T>(
    operation: () => Promise<T>,
    key: string,
    limit: number,
    window: number
  ): Promise<T> {
    const now = Date.now();
    const rate = this.rateLimits.get(key) || { count: 0, timestamp: now };

    if (now - rate.timestamp > window) {
      rate.count = 0;
      rate.timestamp = now;
    }

    if (rate.count >= limit) {
      throw new RateLimitError(`Rate limit exceeded for ${key}`);
    }

    try {
      rate.count++;
      this.rateLimits.set(key, rate);
      return await operation();
    } catch (error) {
      if (error instanceof FloodWaitError) {
        await this.handleFloodWait(error.seconds);
        return this.execute(operation, key, limit, window);
      }
      throw error;
    }
  }
}
```

```typescript
### Media Handling
```typescript
class MediaUploadManager {
  private readonly CHUNK_SIZE = 512 * 1024; // 512KB chunks

  async uploadLargeFile(file: Buffer, fileName: string): Promise<string> {
    const chunks = this.splitIntoChunks(file);
    const fileId = await this.initializeUpload(fileName, chunks.length);

    for (let i = 0; i < chunks.length; i++) {
      await this.rateLimiter.execute(
        () => this.uploadChunk(fileId, i, chunks[i]),
        'media_upload',
        30,
        60000
      );
    }

    return await this.finalizeUpload(fileId);
  }

  private splitIntoChunks(file: Buffer): Buffer[] {
    const chunks: Buffer[] = [];
    for (let i = 0; i < file.length; i += this.CHUNK_SIZE) {
      chunks.push(file.slice(i, i + this.CHUNK_SIZE));
    }
    return chunks;
  }
}
```

```typescript
## 3. WebSocket Communication

### Connection Management
```typescript
class WebSocketManager {
  private readonly clients = new Set<WebSocket>();
  private readonly heartbeatInterval = 30000;

  setupConnection(ws: WebSocket): void {
    this.clients.add(ws);
    this.setupHeartbeat(ws);
    this.setupErrorHandling(ws);

    ws.on('close', () => {
      this.clients.delete(ws);
      this.cleanupConnection(ws);
    });
  }

  private setupHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, this.heartbeatInterval);

    ws.on('pong', () => {
      // Reset connection timeout
    });

    ws.on('close', () => clearInterval(interval));
  }

  async broadcast(message: any): Promise<void> {
    const payload = JSON.stringify(message);
    const deadClients = new Set<WebSocket>();

    for (const client of this.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        } else {
          deadClients.add(client);
        }
      } catch (error) {
        deadClients.add(client);
        logger.error('Broadcast error:', { error });
      }
    }

    // Cleanup dead clients
    deadClients.forEach(client => {
      this.clients.delete(client);
      this.cleanupConnection(client);
    });
  }
}
```

```typescript
## 4. Security Best Practices

### Authentication
```typescript
// Password hashing with proper salt and pepper
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const pepper = process.env.PEPPER_KEY;
  const combined = password + pepper;
  const hash = await scrypt(combined, salt, 64) as Buffer;
  return `${hash.toString('hex')}.${salt}`;
}

// Token generation with proper expiration
function generateToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      version: user.tokenVersion // For invalidating all tokens
    },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
}

// Request validation
const requestSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8)
  }),
  headers: z.object({
    authorization: z.string().optional()
  })
});
```

```typescript
### Data Protection
```typescript
class DataProtection {
  // Sensitive data masking
  static maskSensitiveData(data: any): any {
    const sensitiveFields = ['password', 'token', 'apiKey'];
    return this.traverse(data, (key, value) => {
      if (sensitiveFields.includes(key)) {
        return '********';
      }
      return value;
    });
  }

  // Safe error messages
  static getSafeError(error: Error): object {
    return {
      message: error.message,
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    };
  }
}
```

```typescript
## 5. Performance Optimization

### Caching Strategy
```typescript
class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }

    const data = await fetchFn();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  invalidate(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

```typescript
### Resource Management
```typescript
class ResourceManager {
  private resources = new Map<string, {
    resource: any;
    lastUsed: number;
  }>();

  async acquire<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const existing = this.resources.get(key);
    if (existing && Date.now() - existing.lastUsed < ttl) {
      existing.lastUsed = Date.now();
      return existing.resource as T;
    }

    const resource = await factory();
    this.resources.set(key, {
      resource,
      lastUsed: Date.now()
    });

    return resource;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, { resource, lastUsed }] of this.resources.entries()) {
      if (now - lastUsed > 30 * 60 * 1000) { // 30 minutes
        if (typeof resource.close === 'function') {
          await resource.close();
        }
        this.resources.delete(key);
      }
    }
  }
}
```

```typescript
## 6. Testing Guidelines

### Unit Testing
```typescript
describe('TelegramSessionManager', () => {
  let manager: TelegramSessionManager;

  beforeEach(() => {
    manager = new TelegramSessionManager();
  });

  it('should rotate session successfully', async () => {
    const oldSession = await manager.getCurrentSession();
    await manager.rotateSession();
    const newSession = await manager.getCurrentSession();

    expect(newSession.id).not.toBe(oldSession.id);
    expect(newSession.isActive).toBe(true);
    expect(oldSession.isActive).toBe(false);
  });

  it('should handle session errors gracefully', async () => {
    const error = new Error('Session expired');
    jest.spyOn(manager, 'getCurrentSession').mockRejectedValue(error);

    await expect(manager.checkSessionHealth()).resolves.not.toThrow();
    expect(manager.rotateSession).toHaveBeenCalled();
  });
});
```

```typescript
### Integration Testing
```typescript
describe('Telegram Integration', () => {
  it('should handle message sending with rate limiting', async () => {
    const message = 'Test message';
    const chatId = '123456789';

    const responses = await Promise.all(
      Array(10).fill(null).map(() =>
        telegramClient.sendMessage(chatId, message)
      )
    );

    expect(responses).toHaveLength(10);
    expect(responses.every(r => r.ok)).toBe(true);
  });

  it('should recover from flood wait errors', async () => {
    jest.spyOn(telegramClient, 'sendMessage')
      .mockRejectedValueOnce(new FloodWaitError(5))
      .mockResolvedValueOnce({ ok: true });

    const result = await telegramClient.sendMessage('123', 'test');
    expect(result.ok).toBe(true);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  });
});
```

```typescript
Remember to:
- Write tests for both success and failure scenarios
- Mock external dependencies
- Test rate limiting and error recovery
- Verify data integrity
- Test WebSocket connections
- Include performance tests


## 7. Userbot Implementation Best Practices

### Session Management
```typescript
// Implement secure session storage
class SecureSessionStore {
  private async encryptSession(session: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(session, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }

  private async decryptSession(encrypted: string): Promise<string> {
    const [iv, data, authTag] = encrypted.split(':').map(x => Buffer.from(x, 'hex'));
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  }
}

// Implement session rotation
class SessionManager {
  private readonly MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  async rotateIfNeeded(): Promise<void> {
    const currentSession = await this.getCurrentSession();
    if (Date.now() - currentSession.createdAt > this.MAX_SESSION_AGE) {
      await this.rotateSession();
    }
  }
}
```

### Error Handling
```typescript
// Implement comprehensive error handling
class UserBotErrorHandler {
  async handle(error: Error): Promise<void> {
    if (error instanceof FloodWaitError) {
      await this.handleFloodWait(error);
    } else if (error instanceof ConnectionError) {
      await this.handleConnectionError(error);
    } else if (error instanceof AuthenticationError) {
      await this.handleAuthError(error);
    } else {
      await this.handleUnknownError(error);
    }
  }

  private async handleFloodWait(error: FloodWaitError): Promise<void> {
    logger.warn(`FloodWait: ${error.seconds}s`);
    await delay(error.seconds * 1000);
    metrics.increment('flood_wait_total', error.seconds);
  }
}
```

### Connection Management
```typescript
// Implement connection pooling
class ConnectionPool {
  private readonly pool: Map<string, TelegramClient> = new Map();
  private readonly maxSize = 5;

  async acquire(session: string): Promise<TelegramClient> {
    if (this.pool.has(session)) {
      const client = this.pool.get(session)!;
      if (await this.validateClient(client)) {
        return client;
      }
    }

    const client = await this.createClient(session);
    if (this.pool.size >= this.maxSize) {
      await this.cleanup();
    }
    this.pool.set(session, client);
    return client;
  }
}
```

```typescript
## 8. Monitoring and Logging
```typescript
const logger = {
  info(message: string, meta?: object) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error(error: Error, meta?: object) {
    console.error(JSON.stringify({
      level: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

const metrics = {
  async collect(): Promise<Metrics> {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      connections: await getConnectionCount(),
      activeUsers: await getActiveUserCount()
    };
  },

  async report(): Promise<void> {
    const data = await this.collect();
    logger.info('System metrics', { metrics: data });
  }
};
```

```typescript
## 9. Monitoring and Observability
```typescript
// Set up structured logging with context
const logger = {
  info(message: string, meta?: object) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION
    }));
  },
  error(error: Error, meta?: object) {
    console.error(JSON.stringify({
      level: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION
    }));
  }
};

// Implement health check endpoints
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    version: process.env.APP_VERSION
  };
  res.json(health);
});

// Track performance metrics
const metrics = {
  requests: new Map<string, number>(),
  latencies: new Map<string, number[]>(),
  errors: new Map<string, number>(),

  trackRequest(path: string) {
    const current = this.requests.get(path) || 0;
    this.requests.set(path, current + 1);
  },

  trackLatency(path: string, duration: number) {
    const latencies = this.latencies.get(path) || [];
    latencies.push(duration);
    this.latencies.set(path, latencies.slice(-100)); // Keep last 100 samples
  },

  trackError(path: string) {
    const current = this.errors.get(path) || 0;
    this.errors.set(path, current + 1);
  }
};

## 10. Documentation Maintenance

### Documentation Synchronization
```typescript
// Keep threshold definitions consistent across files
// Reference: See ISSUES.md#response-time-thresholds
const monitoringThresholds = {
  api: {
    responseTime: responseTimeThresholds.api,
    errorRate: errorRateThresholds.api
  },
  websocket: {
    messageLatency: responseTimeThresholds.websocket,
    connectionPool: connectionPoolThresholds.websocket
  }
};

// Implement monitoring based on documented thresholds
class PerformanceMonitor {
  async checkThresholds(): Promise<void> {
    const metrics = await this.collectMetrics();

    // Use centrally defined thresholds
    if (metrics.responseTime > monitoringThresholds.api.responseTime.p95) {
      await this.triggerAlert('response_time_exceeded', {
        current: metrics.responseTime,
        threshold: monitoringThresholds.api.responseTime.p95
      });
    }
  }
}
```

### Cross-Reference Management
```typescript
// Keep documentation references updated
const docReferences = {
  monitoring: {
    thresholds: 'ISSUES.md#response-time-thresholds',
    implementation: 'DEBUGGING.md#monitoring-metrics',
    bestPractices: 'BEST_PRACTICES.md#monitoring-and-observability'
  },
  security: {
    authentication: 'AUTHENTICATION.md#security-best-practices',
    dataProtection: 'BEST_PRACTICES.md#data-protection'
  }
};
```

## Version History
- v1.1.0 (2025-02-10)
  - Added userbot implementation best practices
  - Enhanced session management guidelines
  - Added connection pooling examples
  - Added error handling patterns