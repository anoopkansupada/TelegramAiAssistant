┌─────────────────┐      ┌──────────────────┐      ┌───────────────┐
│  Telegram Bot   │      │   Userbot Client │      │    Storage    │
│  (telegram.ts)  │◄────►│(userbot-client.ts)│◄────►│   Interface  │
└─────────────────┘      └──────────────────┘      └───────────────┘
         ▲                        ▲
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌──────────────────┐
│    WebSocket    │      │   Status Monitor │
│    Server      │◄────►│(connection-status)│
└─────────────────┘      └──────────────────┘
```

### Client Manager (TelegramClientManager)
The client manager implements a singleton pattern to ensure consistent client state across the application:

```typescript
class TelegramClientManager {
  private static instance: TelegramClientManager;
  private client: TelegramClient | null = null;
  private session: string | null = null;
  private connected: boolean = false;
}
```

### Connection Management
The client implements sophisticated connection management with:
- Automatic reconnection
- Connection pooling
- Session persistence
- Rate limiting
- Error recovery

```typescript
async getClient(session?: string): Promise<TelegramClient> {
  // Session validation
  // Connection establishment
  // Error handling
  // Rate limit management
}
```

## Authentication Flow

1. **Initial Connection**
   - Client requests phone code hash
   - User receives verification code
   - Code verification and session establishment

2. **Two-Factor Authentication (if enabled)**
   - Password verification
   - 2FA token validation
   - Session upgrade

3. **Session Management**
   - Encrypted session storage
   - Automatic session refresh
   - Invalid session detection and cleanup

## Error Handling

The client implements comprehensive error handling for common scenarios:

```typescript
try {
  await client.connect();
} catch (error) {
  if (error instanceof FloodWaitError) {
    // Handle rate limiting
  } else if (error instanceof ConnectionError) {
    // Handle connection issues
  }
}
```

### Error Categories
- Network connectivity issues
- Rate limiting and flood wait
- Authentication failures
- Session invalidation
- API errors

## Real-time Status Monitoring

### WebSocket Integration
The system implements real-time status monitoring via WebSocket connections:

```typescript
interface StatusUpdate {
  type: 'status';
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}
```

### Connection Status Component
The React component `connection-status.tsx` provides real-time visibility into the userbot's connection state:
- Connection status indication
- User information display
- Last check timestamp
- Automatic reconnection handling

## Status Monitoring

### Status Monitoring
The client includes built-in health monitoring:
```typescript
async checkAndBroadcastStatus() {
  // Connection verification
  // User authentication check
  // Session validity check
  // Metrics collection
}
```

### Health Metrics
- Connection state
- Message latency
- Session age
- Error rates
- Flood wait occurrences

## Best Practices

### Connection Management
1. Always use the singleton client manager:
   ```typescript
   const client = await clientManager.getClient(session);
   ```

2. Implement proper cleanup:
   ```typescript
   process.on('SIGTERM', cleanup);
   process.on('SIGINT', cleanup);
   ```

### Error Handling
1. Always implement retries with exponential backoff:
   ```typescript
   let retries = 0;
   while (retries < maxRetries) {
     try {
       await operation();
       break;
     } catch (error) {
       retries++;
       await delay(1000 * Math.pow(2, retries));
     }
   }
   ```

2. Handle flood wait errors appropriately:
   ```typescript
   if (error instanceof FloodWaitError) {
     await delay(error.seconds * 1000);
     return retry();
   }
   ```

### Session Management
1. Encrypt sensitive session data:
   ```typescript
   const encrypted = await encryptSession(session);
   await storage.saveSession(encrypted);
   ```

2. Implement session rotation:
   ```typescript
   async rotateSession() {
     const newSession = await createNewSession();
     await validateSession(newSession);
     await switchToSession(newSession);
   }
   ```

## API Reference

### Client Manager
```typescript
interface TelegramClientManager {
  getClient(session?: string): Promise<TelegramClient>;
  cleanup(): Promise<void>;
  isConnected(): boolean;
}
```

### Status Updates
```typescript
interface StatusUpdate {
  type: 'status';
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}
```

## Common Issues and Solutions

### Connection Issues
1. **Problem**: Client fails to connect
   **Solution**: Implement connection retry with backoff
   ```typescript
   while (retries < maxRetries) {
     try {
       await client.connect();
       break;
     } catch (error) {
       await exponentialBackoff(retries);
     }
   }
   ```

2. **Problem**: Session invalidation
   **Solution**: Implement automatic session refresh
   ```typescript
   if (error.message.includes('SESSION_REVOKED')) {
     await clientManager.cleanup();
     await requestNewSession();
   }
   ```

### Rate Limiting
1. **Problem**: FloodWaitError
   **Solution**: Implement proper delay handling
   ```typescript
   if (error instanceof FloodWaitError) {
     await delay(error.seconds * 1000);
   }