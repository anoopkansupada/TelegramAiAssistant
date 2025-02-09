## System Architecture

### Frontend
- React with TypeScript
- Shadcn UI components
- TanStack Query for data fetching
- Real-time WebSocket updates

### Backend
- Express.js server
- PostgreSQL with Drizzle ORM
- WebSocket server for real-time updates
- Telegram client integration via gram.js

### Authentication Flow
1. User Authentication
   - Local authentication with username/password
   - Session management with express-session

2. Telegram Integration
   - Phone number verification with proper expiration handling
   - 2FA support with timeout handling
   - Session persistence with proper cleanup
   - Real-time connection status monitoring

### Current Implementation Status
1. ✅ Basic Authentication
   - User registration and login
   - Session management
   - Protected routes

2. 🟡 Telegram Integration
   - Client setup and configuration
   - Phone verification flow (needs improvement)
   - Session management
   - Known Issue: Code expiration handling requires optimization

3. ✅ CRM Features
   - Contact management
   - Company management
   - Basic data organization

4. 🟡 Channel Management
   - Channel listing
   - Basic channel operations
   - Pending: Enhanced channel analytics

### Known Issues & Future Improvements
1. Telegram Authentication
   - Code expiration handling needs improvement
   - Current implementation shows intermittent timing issues with code validation
   - Attempted solutions:
     - Implemented server-side code expiration tracking
     - Added session regeneration for cleanup
     - Enhanced error handling for expired codes
   - TODO: Investigate alternative approaches for code timing synchronization

### Prioritized Task List
1. High Priority
   - [ ] Implement robust error handling for Telegram authentication
   - [ ] Add real-time message synchronization
   - [ ] Implement channel analytics dashboard
   - [ ] Add contact import/export functionality

2. Medium Priority
   - [ ] Enhance UI/UX for mobile responsiveness
   - [ ] Add message templates feature
   - [ ] Implement broadcast scheduling
   - [ ] Add contact segmentation

3. Low Priority
   - [ ] Add dark mode support
   - [ ] Implement advanced search filters
   - [ ] Add custom field support for contacts
   - [ ] Implement audit logging

### Getting Started

#### Prerequisites
1. Node.js (v18+)
2. PostgreSQL database
3. Telegram API credentials
   - Create an application at https://my.telegram.org/apps
   - Note down API_ID and API_HASH

#### Environment Variables
```env
DATABASE_URL=postgresql://...  # PostgreSQL connection string
TELEGRAM_API_ID=your_api_id    # From Telegram API dashboard
TELEGRAM_API_HASH=your_hash    # From Telegram API dashboard
SESSION_SECRET=random_string   # For session encryption
```

#### Development Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up the database:
   ```bash
   npm run db:push
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Real-time Features
- WebSocket server for live updates
- Connection status monitoring
- Message synchronization
- Channel activity tracking

### Database Management
- Schema defined in `shared/schema.ts`
- Migrations handled by Drizzle ORM
- Tables:
  - Users
  - Contacts
  - Companies
  - Messages
  - Channels
  - Announcements

### Security Considerations
1. API Authentication
   - JWT tokens for API requests
   - Session-based authentication for web interface
   - Rate limiting on sensitive endpoints

2. Telegram Integration
   - Secure session storage
   - Phone number verification
   - 2FA support
   - Session cleanup on logout

3. Data Protection
   - Input validation
   - SQL injection prevention via ORM
   - XSS protection
   - CSRF tokens

### Debugging Guide
1. Common Issues:
   - Telegram authentication timeouts
   - WebSocket connection drops
   - Database connection issues
   - Session persistence problems

2. Logging:
   - Application logs in server console
   - Telegram client logs
   - Database query logs
   - WebSocket connection logs

### Data Synchronization
- Real-time channel updates
- Invitation management
- Contact synchronization

### AI Features
- Sentiment analysis for messages
- Automated response suggestions
- Contact engagement scoring
- Channel analytics

## Contributing
1. Fork the repository
2. Create a feature branch
3. Follow TypeScript best practices
4. Submit a pull request

### Project Structure
```
├── client/          # React frontend
│   ├── src/         
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utility functions
│   │   └── pages/      # Route components
├── server/          # Express backend
└── shared/          # Shared types and utilities