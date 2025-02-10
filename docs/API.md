// Basic authentication flow in userbot-client.ts
GET /api/telegram-auth/status
- Response: { connected: boolean, lastChecked: string }

POST /api/telegram-auth/disconnect
- Response: { success: boolean, message: string }
```

### Required Endpoints (Not Yet Implemented)

#### Session Management
```typescript
POST /api/telegram-auth/rotate-session
- Description: Safely rotate the current session
- Status: Planned
- Priority: High

GET /api/telegram-auth/session-health
- Description: Check detailed session health metrics
- Status: Planned
- Priority: Medium
```

#### Connection Management
```typescript
GET /api/telegram/connection-pool/status
- Description: Get connection pool health metrics
- Status: Not implemented
- Priority: High

POST /api/telegram/connection-pool/cleanup
- Description: Force cleanup of stale connections
- Status: Not implemented
- Priority: Medium
```

### WebSocket Events

Currently Implemented:
```typescript
// Basic status updates
{
  type: 'status',
  connected: boolean,
  lastChecked: string
}

// Basic error events
{
  type: 'error',
  message: string
}
```

Required Events (Not Yet Implemented):
```typescript
// Connection pool status
{
  type: 'pool_status',
  connections: Array<{
    id: string,
    status: 'active' | 'idle' | 'error',
    metrics: {
      latency: number,
      errors: number,
      lastUsed: string
    }
  }>
}

// Session rotation events
{
  type: 'session_rotation',
  status: 'started' | 'completed' | 'failed',
  error?: string
}
```

## Error Handling

Current implementation is basic:
```typescript
// Basic error responses
{
  success: false,
  message: string
}
```

Needed improvements:
- Structured error codes
- Detailed error information
- Retry-after headers for rate limits
- Error categorization

## Monitoring Endpoints

To be implemented:
```typescript
GET /api/monitoring/telegram
- Description: Get detailed Telegram client metrics
- Status: Planned
- Priority: High

GET /api/monitoring/sessions
- Description: Get session health metrics
- Status: Planned
- Priority: Medium