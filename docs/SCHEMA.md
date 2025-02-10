### Companies
```sql
Table companies {
  id serial [pk]
  name text [not null]
  website text
  industry text
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### Contacts
```sql
Table contacts {
  id serial [pk]
  companyId integer [ref: > companies.id]
  telegramId text [unique]
  firstName text
  lastName text
  jobTitle text
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### Messages
```sql
Table messages {
  id serial [pk]
  contactId integer [ref: > contacts.id]
  content text [not null]
  sentiment text
  createdAt timestamp [default: `now()`]
}
```

### MessageSuggestions
```sql
Table messageSuggestions {
  id serial [pk]
  messageId integer [ref: > messages.id]
  suggestion text [not null]
  createdAt timestamp [default: `now()`]
}
```

### TelegramChannels
```sql
Table telegramChannels {
  id serial [pk]
  telegramId text [unique, not null]
  name text [not null]
  type text [not null]
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### ChannelInvitations
```sql
Table channelInvitations {
  id serial [pk]
  channelId integer [ref: > telegramChannels.id]
  inviteLink text [not null]
  maxUses integer
  currentUses integer [default: 0]
  expireDate timestamp
  status text [not null]
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### TelegramChats
```sql
Table telegramChats {
  id serial [pk]
  telegramId text [unique, not null]
  type text [not null]
  title text
  status text [not null]
  unreadCount integer [default: 0]
  category text
  importance integer [default: 0]
  metadata jsonb
  lastMessageAt timestamp [default: `now()`]
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### CompanySuggestions
```sql
Table companySuggestions {
  id serial [pk]
  chatId integer [ref: > telegramChats.id]
  companyName text [not null]
  confidenceScore float [not null]
  confidenceFactors jsonb
  status text [not null]
  createdAt timestamp [default: `now()`]
}
```

### TelegramSessions
```sql
Table telegramSessions {
  id serial [pk]
  userId integer [ref: > users.id]
  session text [not null]
  isActive boolean [default: true]
  lastUsed timestamp [default: `now()`]
  lastAuthDate timestamp [default: `now()`]
  createdAt timestamp [default: `now()`]
}
```

### FollowupSchedules
```sql
Table followupSchedules {
  id serial [pk]
  chatId integer [ref: > telegramChats.id]
  message text [not null]
  scheduledFor timestamp [not null]
  status text [not null]
  createdById integer [ref: > users.id]
  createdAt timestamp [default: `now()`]
}
```

### WebSocketConnections
```sql
Table webSocketConnections {
  id serial [pk]
  userId integer [ref: > users.id]
  connectionId text [unique, not null]
  clientInfo jsonb
  connected boolean [default: true]
  lastHeartbeat timestamp [default: `now()`]
  createdAt timestamp [default: `now()`]
}
```

### WebSocketEvents
```sql
Table webSocketEvents {
  id serial [pk]
  userId integer [ref: > users.id]
  connectionId text [ref: > webSocketConnections.connectionId]
  type text [not null]
  payload jsonb
  status text [not null]
  processedAt timestamp
  createdAt timestamp [default: `now()`]
}
```

### RateLimits
```sql
Table rateLimits {
  id serial [pk]
  userId integer [ref: > users.id]
  type text [not null]
  count integer [default: 1]
  resetAt timestamp [not null]
  createdAt timestamp [default: `now()`]
}
```

## Relationships
1. Users:
   - One-to-many with Companies (creator)
   - One-to-many with Contacts (creator)
   - One-to-many with TelegramChannels (creator)
   - One-to-many with TelegramSessions

2. Companies:
   - One-to-many with Contacts
   - Created by one User

3. Contacts:
   - Belongs to one Company
   - One-to-many with Messages
   - Created by one User

4. Messages:
   - Belongs to one Contact
   - One-to-many with MessageSuggestions

5. TelegramChannels:
   - One-to-many with ChannelInvitations
   - Created by one User

6. TelegramChats:
   - One-to-many with CompanySuggestions
   - One-to-many with FollowupSchedules
   - Created by one User

## Indexes
```sql
-- Performance indexes
CREATE INDEX idx_contacts_telegram_id ON contacts(telegramId);
CREATE INDEX idx_messages_contact_id ON messages(contactId);
CREATE INDEX idx_message_suggestions_message_id ON messageSuggestions(messageId);
CREATE INDEX idx_telegram_channels_telegram_id ON telegramChannels(telegramId);
CREATE INDEX idx_telegram_chats_telegram_id ON telegramChats(telegramId);
CREATE INDEX idx_company_suggestions_chat_id ON companySuggestions(chatId);
CREATE INDEX idx_followup_schedules_chat_id ON followupSchedules(chatId);
CREATE INDEX idx_telegram_sessions_user_id ON telegramSessions(userId);

-- Composite indexes for common queries
CREATE INDEX idx_messages_contact_created ON messages(contactId, createdAt DESC);
CREATE INDEX idx_telegram_chats_category_importance ON telegramChats(category, importance);
CREATE INDEX idx_company_suggestions_status_confidence ON companySuggestions(status, confidenceScore DESC);
CREATE INDEX idx_followup_schedules_status_date ON followupSchedules(status, scheduledFor);

-- WebSocket related indexes
CREATE INDEX idx_websocket_connections_user ON webSocketConnections(userId, connected);
CREATE INDEX idx_websocket_events_connection ON webSocketEvents(connectionId, createdAt DESC);
CREATE INDEX idx_rate_limits_user_type ON rateLimits(userId, type, resetAt);

-- Composite indexes for monitoring
CREATE INDEX idx_websocket_connections_heartbeat ON webSocketConnections(connected, lastHeartbeat);
CREATE INDEX idx_websocket_events_processing ON webSocketEvents(status, processedAt);