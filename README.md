DATABASE_URL=postgresql://...
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
```

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

### Data Synchronization
- Real-time channel updates
- Invitation management
- Contact synchronization

## Contributing
1. Fork the repository
2. Create a feature branch
3. Follow TypeScript best practices
4. Submit a pull request

## Project Structure
```
├── client/          # React frontend
│   ├── src/         
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utility functions
│   │   └── pages/      # Route components
├── server/          # Express backend
├── shared/          # Shared types and utilities