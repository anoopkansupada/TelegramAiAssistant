Client -> Server: POST /api/auth/refresh
Server -> Database: Validate refresh token
Database -> Server: Token valid
Server -> Client: New access token
```

## API Authentication

POST /api/auth/login
- Description: Authenticate user and create session
- Authentication: Not required
- Request Body: { username: string, password: string }
- Response: {
    user: {
      id: number,
      username: string
    },
    token: string
  }
- Rate Limit: 5 attempts per minute
- Headers:
  - X-RateLimit-Limit: 5
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 400: { message: "Invalid credentials", code: "AUTH_FAILED" }
  - 429: { message: "Too many attempts", code: "RATE_LIMIT", retryAfter: number }

POST /api/auth/refresh
- Description: Refresh authentication token
- Authentication: Required (Refresh token)
- Response: { token: string }
- Headers:
  - X-RateLimit-Limit: 10
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 401: { message: "Invalid refresh token", code: "INVALID_TOKEN" }
  - 429: { message: "Too many attempts", code: "RATE_LIMIT", retryAfter: number }

## Monitoring Endpoints

GET /health/websocket
- Description: Get WebSocket connection health metrics
- Authentication: Required (Admin)
- Response: {
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: {
      connections: number,
      messageRate: number,
      errorRate: number,
      averageLatency: number
    },
    timestamp: string
  }
- Headers:
  - X-RateLimit-Limit: 60
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 401: { message: "Authentication required", code: "AUTH_REQUIRED" }
  - 403: { message: "Insufficient permissions", code: "FORBIDDEN" }

GET /health/telegram
- Description: Get Telegram connection health metrics
- Authentication: Required (Admin)
- Response: {
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: {
      messageLatency: number[],
      dcLatency: Record<number, number>,
      floodWait: number,
      migrations: number
    },
    timestamp: string
  }
- Headers:
  - X-RateLimit-Limit: 60
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 401: { message: "Authentication required", code: "AUTH_REQUIRED" }
  - 403: { message: "Insufficient permissions", code: "FORBIDDEN" }

GET /health/rate-limits
- Description: Get current rate limit metrics
- Authentication: Required (Admin)
- Response: {
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: {
      telegram: {
        messagesSent: {
          current: number,
          limit: number,
          resetAt: string
        },
        mediaUploads: {
          current: number,
          limit: number,
          resetAt: string
        }
      },
      api: {
        standard: {
          current: number,
          limit: number,
          resetAt: string
        },
        auth: {
          current: number,
          limit: number,
          resetAt: string
        }
      },
      websocket: {
        connections: {
          current: number,
          limit: number
        },
        messages: {
          current: number,
          limit: number,
          resetAt: string
        }
      }
    },
    throttled: {
      count: number,
      rate: number
    },
    timestamp: string
  }
- Headers:
  - X-RateLimit-Limit: 60
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 401: { message: "Authentication required", code: "AUTH_REQUIRED" }
  - 403: { message: "Insufficient permissions", code: "FORBIDDEN" }

## Telegram Authentication

### 1. Initial Authentication
```sequence
Client -> Server: POST /api/telegram-auth/request-code
Server -> Telegram: Request verification code
Telegram -> User: Send code via Telegram
User -> Client: Enter code
Client -> Server: POST /api/telegram-auth/verify
Server -> Telegram: Verify code
Telegram -> Server: Session data
Server -> Client: Success response
```

### 2. 2FA Flow (if enabled)
```sequence
Client -> Server: POST /api/telegram-auth/verify
Server -> Telegram: Initial verification
Telegram -> Server: 2FA required
Server -> Client: 2FA required response
Client -> Server: POST /api/telegram-auth/verify-2fa
Server -> Telegram: Verify 2FA
Telegram -> Server: Session data
Server -> Client: Success response
```

POST /api/telegram-auth/request-code
- Description: Request Telegram verification code
- Authentication: Required
- Request Body: { phoneNumber: string }
- Response: { success: boolean, message: string }
- Rate Limit: 3 requests per 5 minutes
- Errors:
  - 400: { message: "Invalid phone number", code: "INVALID_PHONE" }
  - 429: { message: "Too many requests", code: "RATE_LIMIT", retryAfter: number }

POST /api/telegram-auth/verify
- Description: Verify Telegram code
- Authentication: Required
- Request Body: { code: string }
- Response: { success: boolean }
- Rate Limit: 5 attempts per verification code
- Errors:
  - 400: { message: "Invalid code", code: "INVALID_CODE" }
  - 400: { message: "Code expired", code: "CODE_EXPIRED" }
  - 429: { message: "Too many attempts", code: "MAX_ATTEMPTS" }

POST /api/telegram-auth/verify-2fa
- Description: Verify 2FA token
- Authentication: Required
- Request Body: { token: string }
- Response: { success: boolean, message: string }
- Rate Limit: 3 attempts per minute
- Errors:
  - 400: { message: "Invalid token", code: "INVALID_TOKEN" }
  - 429: { message: "Too many attempts", code: "MAX_ATTEMPTS" }

GET /api/telegram-auth/status
- Description: Check Telegram connection status
- Authentication: Required
- Response: { 
    connected: boolean, 
    user?: { 
      id: string, 
      username: string, 
      firstName?: string 
    },
    lastCheck: string,
    connectionUptime?: number
  }
- Headers: 
  - X-RateLimit-Limit: 60
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp

## Telegram Integration

### Channel Management

POST /api/telegram-channels/{channelId}/invitations
- Description: Create new channel invitation
- Authentication: Required
- Request Body: { 
    maxUses?: number, 
    expireDate?: string,
    title?: string,
    requireApproval?: boolean
  }
- Response: Created invitation object
- Rate Limit: 30 invites per channel per day
- Errors:
  - 400: { message: "Invalid request parameters", code: "INVALID_REQUEST" }
  - 403: { message: "Maximum active invitations reached", code: "MAX_INVITES_REACHED" }
  - 404: { message: "Channel not found", code: "CHANNEL_NOT_FOUND" }
  - 429: { message: "Rate limit exceeded", code: "RATE_LIMIT" }

GET /api/telegram-chats
- Description: Get all Telegram chats
- Authentication: Required
- Query Parameters:
  - orderBy: "lastMessageAt" (default) | "importance" | "unreadCount"
  - order: "asc" | "desc"
  - page: number (default: 1)
  - limit: number (default: 50, max: 100)
  - filter: "all" | "unread" | "important"
- Response: {
    chats: Chat[],
    pagination: {
      currentPage: number,
      totalPages: number,
      totalItems: number
    }
  }
- Headers:
  - X-RateLimit-Limit: 120
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp
- Errors:
  - 401: { message: "Telegram authentication required" }
  - 429: { message: "Rate limit exceeded", code: "RATE_LIMIT" }

### Media Handling

POST /api/media/upload
- Description: Upload media file
- Authentication: Required
- Request: multipart/form-data
- Parameters:
  - file: File (max 50MB)
  - type: "photo" | "document" | "video" | "audio"
  - caption?: string
  - thumb?: File (for videos/documents)
- Response: {
    fileId: string,
    type: string,
    url: string,
    thumbnailUrl?: string,
    size: number,
    mimeType: string
  }
- Rate Limit: 30 uploads per minute
- Errors:
  - 400: { message: "Invalid file type", code: "INVALID_FILE_TYPE" }
  - 413: { message: "File too large", code: "FILE_TOO_LARGE" }
  - 429: { message: "Rate limit exceeded", code: "RATE_LIMIT" }

GET /api/media/{fileId}
- Description: Get media file info
- Authentication: Required
- Response: {
    fileId: string,
    type: string,
    url: string,
    thumbnailUrl?: string,
    size: number,
    mimeType: string,
    uploadDate: string
  }
- Headers:
  - X-RateLimit-Limit: 300
  - X-RateLimit-Remaining: number
  - X-RateLimit-Reset: timestamp


## WebSocket Events

### Connection Setup
```
WebSocket Path: /ws
Authentication: Required via session token
Protocol: JSON messages
Connection Limit: 3 concurrent connections per user
Heartbeat Interval: 30 seconds
```

### Event Types

1. Authentication Events:
```typescript
// Initial auth
Client -> Server: {
  type: 'auth',
  token: string
}

// Auth response
Server -> Client: {
  type: 'auth_response',
  status: 'success' | 'error',
  error?: string
}
```

2. Status Events:
```typescript
Server -> Client: {
  type: 'status',
  connected: boolean,
  user?: {
    id: string,
    username: string,
    firstName?: string
  },
  lastChecked: string,
  metrics: {
    uptime: number,
    connectionCount: number,
    messageCount: number
  }
}
```

3. Message Events:
```typescript
// New message
Server -> Client: {
  type: 'message',
  chatId: string,
  message: {
    id: string,
    content: string,
    timestamp: string,
    sender: {
      id: string,
      name: string,
      type: 'user' | 'bot' | 'system'
    },
    metadata?: {
      attachments: Array<{
        type: 'photo' | 'document' | 'video',
        fileId: string,
        url: string
      }>,
      replyTo?: string,
      forwardFrom?: string
    }
  }
}

// Message status update
Server -> Client: {
  type: 'message_status',
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  error?: string
}
```

4. Chat Updates:
```typescript
Server -> Client: {
  type: 'chat_update',
  chatId: string,
  update: {
    unreadCount?: number,
    lastMessage?: Message,
    title?: string,
    photo?: string,
    participantCount?: number,
    typing?: Array<{
      userId: string,
      name: string,
      timestamp: string
    }>
  }
}
```

5. AI Processing Events:
```typescript
Server -> Client: {
  type: 'ai_process',
  status: 'started' | 'processing' | 'completed' | 'failed',
  messageId: string,
  result?: {
    sentiment?: 'positive' | 'negative' | 'neutral',
    suggestions?: string[],
    entities?: Array<{
      type: 'company' | 'person' | 'location',
      text: string,
      confidence: number
    }>,
    summary?: string
  },
  error?: {
    code: string,
    message: string
  }
}
```

6. Error Events:
```typescript
Server -> Client: {
  type: 'error',
  code: string,
  message: string,
  details?: Record<string, any>,
  retryAfter?: number
}
```

### Heartbeat Protocol
```typescript
// Client ping
Client -> Server: { type: 'ping', timestamp: number }

// Server pong
Server -> Client: { type: 'pong', timestamp: number }
```

### Error Codes
```typescript
enum WebSocketErrorCode {
  // Connection Errors
  AUTH_FAILED = 'AUTH_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MAX_CONNECTIONS_EXCEEDED = 'MAX_CONNECTIONS_EXCEEDED',

  // Message Errors
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',

  // Chat Errors
  CHAT_NOT_FOUND = 'CHAT_NOT_FOUND',
  CHAT_ACCESS_DENIED = 'CHAT_ACCESS_DENIED',

  // AI Processing Errors
  AI_PROCESSING_FAILED = 'AI_PROCESSING_FAILED',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED'
}
```

### Rate Limiting
All WebSocket connections are subject to the following rate limits:

1. Connection Rate Limits:
   - 3 concurrent connections per user
   - 60 connection attempts per hour
   - 5 second cooldown between reconnection attempts

2. Message Rate Limits:
   - 30 messages per minute per chat
   - 100 messages per minute total
   - Maximum message size: 4KB

3. Event Rate Limits:
   - 100 events per minute per connection
   - 1000 events per hour per user

Rate limit exceeded errors will include a `retryAfter` field indicating when the client can retry.

## Rate Limiting

All API endpoints use token bucket rate limiting:
- Tokens refresh every minute
- Burst allowance varies by endpoint
- Rate limits are per user and per IP
- Exceeded limits return 429 status code

Headers:
```
X-RateLimit-Limit: Maximum requests allowed
X-RateLimit-Remaining: Requests remaining
X-RateLimit-Reset: Timestamp when limit resets
Retry-After: Seconds to wait before retrying
```

## Error Handling

All endpoints follow standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

Common error response format:
```json
{
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": {}, // Optional additional error details
  "retryAfter": 30 // Only for rate limit errors
}
```

## Pagination

For endpoints returning lists:
- page: Page number (default: 1)
- limit: Items per page (default: 50, max: 100)
- total: Total number of items
- pages: Total number of pages

Response format:
```json
{
  "data": [],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 495,
    "itemsPerPage": 50
  }
}