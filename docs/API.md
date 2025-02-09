# API Documentation

## Overview
Documentation for the Telegram CRM Platform API endpoints.

## Authentication
All API endpoints require authentication unless specified otherwise.

### Endpoints

#### User Management
```
GET /api/user
- Description: Get current user information
- Authentication: Required
- Response: User object
```

#### Telegram Integration
```
POST /api/telegram/connect
- Description: Connect Telegram account
- Authentication: Required
- Request Body: { telegramId: string }
- Response: Connection status
```

#### CRM Features
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
```

## Error Handling
All endpoints follow standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting
- 100 requests per minute per IP
- 1000 requests per hour per user

## Versioning
Current API version: v1
Base URL: `/api/v1`
