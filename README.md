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