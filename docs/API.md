POST /api/register
- Description: Register new user
- Authentication: Not required
- Request Body: { username: string, password: string }
- Response: User object

POST /api/login
- Description: Login user
- Authentication: Not required
- Request Body: { username: string, password: string }
- Response: User object

POST /api/logout
- Description: Logout current user
- Authentication: Required
- Response: 200 OK

GET /api/user
- Description: Get current user information
- Authentication: Required
- Response: User object
```

### Telegram Integration

```
POST /api/telegram-auth/request-code
- Description: Request Telegram verification code
- Authentication: Required
- Request Body: { phoneNumber: string }
- Response: { success: boolean, message: string }

POST /api/telegram-auth/verify
- Description: Verify Telegram code
- Authentication: Required
- Request Body: { code: string }
- Response: { success: boolean }

POST /api/telegram-auth/verify-2fa
- Description: Verify 2FA token
- Authentication: Required
- Request Body: { token: string }
- Response: { success: boolean, message: string }

GET /api/telegram-auth/status
- Description: Check Telegram connection status
- Authentication: Required
- Response: { connected: boolean, user?: { id: string, username: string, firstName?: string } }
```

### CRM Features

```
GET /api/contacts
- Description: Get all contacts
- Authentication: Required
- Response: Array of contact objects

POST /api/contacts
- Description: Create new contact
- Authentication: Required
- Request Body: Contact object
- Response: Created contact

GET /api/companies
- Description: Get all companies
- Authentication: Required
- Response: Array of company objects

POST /api/companies
- Description: Create new company
- Authentication: Required
- Request Body: Company object
- Response: Created company

GET /api/telegram-channels
- Description: Get all Telegram channels
- Authentication: Required
- Response: Array of channel objects

POST /api/test/telegram-message
- Description: Test message processing
- Authentication: Required
- Request Body: { message: string }
- Response: { message: object, suggestions: string[], contact: object }
```

### WebSocket Endpoints

```
WebSocket /ws/status
- Description: Real-time connection status updates
- Authentication: Required via session
- Messages:
  - Server -> Client: { type: 'status', connected: boolean, user?: object, lastChecked: string }
```

## Error Handling
All endpoints follow standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

Common error responses:
```json
{
  "message": "Error description",
  "code": "ERROR_CODE" // Optional error code
}