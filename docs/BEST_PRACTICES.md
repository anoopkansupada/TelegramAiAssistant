// Correct: Use Drizzle query builder
const user = await db.query.users.findFirst({
  where: eq(users.id, id)
});

// Incorrect: Avoid raw SQL
const [user] = await db.select().from(users).where(eq(users.id, id));
```

#### Connection Management
```typescript
// Connection pooling configuration
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500,
});
```

#### Error Handling Pattern
```typescript
async function databaseOperation() {
  try {
    // Operation here
  } catch (error) {
    console.error('Operation failed:', error);
    // Log context and rethrow
    throw error;
  }
}
```

### 2. Telegram Integration

#### Session Management
```typescript
// Health check implementation
setInterval(async () => {
  if (clientManager.isConnected()) {
    try {
      const client = await clientManager.getClient();
      await client.getMe();
    } catch (error) {
      await clientManager.cleanup();
    }
  }
}, 60 * 1000);
```

#### Connection Cleanup
```typescript
public async cleanup(): Promise<void> {
  if (this.cleanupInProgress) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return;
  }

  this.cleanupInProgress = true;
  try {
    if (this.client?.connected) {
      await this.client.disconnect();
    }
    await this.client?.destroy();
  } finally {
    this.client = null;
    this.session = null;
    this.connected = false;
    this.cleanupInProgress = false;
  }
}
```

### 3. Error Handling

#### Logging Standards
```typescript
// Error logging with context
console.error('[Context] Error description:', {
  error: error.message,
  stack: error.stack,
  additionalContext: contextData
});
```

#### API Error Responses
```typescript
// Structured error responses
res.status(errorCode).json({
  message: "User-friendly error message",
  code: "ERROR_CODE",
  details: process.env.NODE_ENV === 'development' ? error.stack : undefined
});
```

### 4. WebSocket Management

#### Connection Handling
```typescript
wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error);
  });
});
```

#### Broadcasting Updates
```typescript
function broadcastStatus(status: StatusUpdate): void {
  const statusJSON = JSON.stringify(status);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(statusJSON);
      } catch (error) {
        console.error('[WebSocket] Failed to send status update:', error);
      }
    }
  });
}
```

### 5. Frontend Development

#### React Query Patterns
```typescript
// Query definition
const { data, isLoading } = useQuery({
  queryKey: ['/api/resource', id],
  queryFn: () => fetch(`/api/resource/${id}`).then(res => res.json())
});

// Cache invalidation
queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
```

#### Form Handling
```typescript
// Form with Zod validation
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    field: initialValue
  }
});
```

## Project Structure
```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and utils
├── docs/            # Documentation
└── drizzle.config.ts