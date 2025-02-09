DATABASE_URL=postgresql://...      # Database connection string
TELEGRAM_BOT_TOKEN=...            # Telegram Bot API token
TELEGRAM_API_ID=...               # Telegram API credentials
TELEGRAM_API_HASH=...             # Telegram API credentials
SESSION_SECRET=...                # Secret for session management
```

## Installation Steps
1. Install dependencies:
```bash
npm install
```

2. Initialize database:
```bash
npm run db:push
```

3. Start development server:
```bash
npm run dev
```

## Documentation

- [Best Practices Guide](docs/BEST_PRACTICES.md) - Comprehensive development guidelines
- [API Documentation](docs/API.md) - API endpoints and usage
- [Database Schema](docs/SCHEMA.md) - Database structure and relationships
- [Debugging Guide](docs/DEBUGGING.md) - Advanced troubleshooting
- [Compliance Checking](scripts/check-compliance.ts) - Automated best practices verification

## Development Workflow

1. Follow the [Best Practices Guide](docs/BEST_PRACTICES.md)
2. Use TypeScript for all new code
3. Run compliance checks regularly:
   ```bash
   npm run check-compliance
   ```
4. Implement proper error handling
5. Add necessary documentation
6. Test thoroughly before deployment

## Monitoring and Debugging

1. Real-time Connection Status
   - WebSocket-based connection monitoring
   - Telegram session state tracking
   - Automatic reconnection handling

2. Error Diagnostics
   - Structured logging system
   - Detailed error context capture
   - Performance metrics tracking

3. Data Integrity
   - Database consistency checks
   - Cache synchronization verification
   - Message delivery confirmation

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
├── docs/            # Documentation
└── scripts/         # Utility scripts