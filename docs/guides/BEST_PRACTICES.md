// ANTI-PATTERN: Global singleton instance
// Problem: Single point of failure, hard to test
class TelegramClient {
  private static instance: TelegramClient;
  // ...
}

// RECOMMENDED: Dependency injection
class TelegramService {
  constructor(private client: TelegramClient) {}
  // ...
}
```

### Connection Pooling
```typescript
// RECOMMENDED: Connection pool implementation
class ConnectionPool {
  private pool: TelegramClient[] = [];
  private maxSize = 5;

  async getConnection(): Promise<TelegramClient> {
    // Implement proper connection retrieval with health checks
    const client = this.pool.find(c => c.isHealthy());
    if (client) return client;

    // Create new connection if pool not full
    if (this.pool.length < this.maxSize) {
      const newClient = await this.createConnection();
      this.pool.push(newClient);
      return newClient;
    }

    throw new Error('Connection pool exhausted');
  }
}
```

## Error Handling

### Categorized Error Types
```typescript
// Define specific error types
class TelegramError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message);
  }
}

// Usage
throw new TelegramError(
  'Rate limit exceeded',
  'RATE_LIMIT',
  true
);
```

### Retry Strategy
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) throw error;
      await exponentialBackoff(i);
    }
  }

  throw lastError;
}
```

## Session Management

### Session Storage
```typescript
// RECOMMENDED: Encrypted session storage
class SecureSessionStorage {
  constructor(private encryptionKey: string) {}

  async store(session: string): Promise<void> {
    const encrypted = await this.encrypt(session);
    await db.insert(telegramSessions).values({
      sessionString: encrypted,
      lastUsed: new Date()
    });
  }

  async retrieve(id: number): Promise<string | null> {
    const session = await db.query.telegramSessions.findFirst({
      where: eq(telegramSessions.id, id)
    });
    return session ? await this.decrypt(session.sessionString) : null;
  }
}
```

### Session Cleanup
```typescript
// Regular session cleanup
async function cleanupSessions(): Promise<void> {
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

  await db.delete(telegramSessions)
    .where(
      lt(
        telegramSessions.lastUsed,
        new Date(Date.now() - TWO_WEEKS)
      )
    );
}
```

## Performance Optimization

### Caching Strategy
```typescript
// Implement caching for frequently accessed data
const cache = new Map<string, {
  data: any,
  timestamp: number
}>();

function getCached<T>(
  key: string,
  ttl: number,
  fetch: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return Promise.resolve(cached.data);
  }

  return fetch().then(data => {
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
    return data;
  });
}
```

### Message Batching
```typescript
// Batch message processing
class MessageBatcher {
  private queue: Message[] = [];
  private maxBatchSize = 100;
  private flushInterval = 5000;

  async add(message: Message): Promise<void> {
    this.queue.push(message);

    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, this.maxBatchSize);
    await this.processBatch(batch);
  }
}
```

## Testing Patterns

### Mock Telegram Client
```typescript
// Test helper for mocking Telegram client
class MockTelegramClient implements TelegramClient {
  async sendMessage(params: SendMessageParams): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return Promise.resolve();
  }

  async getMessages(params: GetMessagesParams): Promise<Message[]> {
    return Promise.resolve([
      // Return test messages
    ]);
  }
}
```

### Integration Tests
```typescript
describe('Telegram Integration', () => {
  let client: TelegramClient;

  beforeEach(() => {
    client = new MockTelegramClient();
  });

  it('should handle rate limits', async () => {
    // Test rate limit handling
    const service = new TelegramService(client);
    await expect(service.sendBulkMessages(messages))
      .resolves.not.toThrow();
  });
});
```

## Database Access Patterns

### Query Optimization
```typescript
// ANTI-PATTERN: N+1 queries
async function getCompanyContacts(companyId: number) {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId)
  });

  // BAD: Separate query for each contact
  const contacts = await Promise.all(
    company.contactIds.map(id =>
      db.query.contacts.findFirst({
        where: eq(contacts.id, id)
      })
    )
  );
}

// RECOMMENDED: Single query with join
async function getCompanyContacts(companyId: number) {
  return db.query.companies.findFirst({
    where: eq(companies.id, companyId),
    with: {
      contacts: true
    }
  });
}
```

### Transaction Management
```typescript
// RECOMMENDED: Use transactions for related operations
async function createCompanyWithContacts(
  company: InsertCompany,
  contacts: InsertContact[]
) {
  return await db.transaction(async (tx) => {
    const [newCompany] = await tx.insert(companies)
      .values(company)
      .returning();

    const newContacts = await tx.insert(contacts)
      .values(contacts.map(contact => ({
        ...contact,
        companyId: newCompany.id
      })))
      .returning();

    return { company: newCompany, contacts: newContacts };
  });
}
```

## Security Considerations

### Input Validation
```typescript
// RECOMMENDED: Use Zod for runtime validation
const messageSchema = z.object({
  content: z.string().min(1).max(4096),
  recipient: z.string().min(1),
  type: z.enum(['text', 'media']),
  metadata: z.record(z.unknown()).optional()
});

// Usage
async function sendMessage(input: unknown) {
  const message = messageSchema.parse(input);
  // Proceed with validated data
}
```

### Rate Limiting
```typescript
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async checkLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const recent = timestamps.filter(
      time => now - time < window
    );

    if (recent.length >= limit) {
      return false;
    }

    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}
```

## Monitoring and Logging

### Structured Logging
```typescript
// RECOMMENDED: Use structured logging
const logger = {
  info(message: string, context: Record<string, any>) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context
    }));
  },

  error(message: string, error: Error, context: Record<string, any>) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      ...context
    }));
  }
};
```

### Performance Monitoring
```typescript
// Track operation duration
async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - start;
    logger.info(`Operation ${name} completed`, {
      duration,
      timestamp: new Date()
    });
  }
}