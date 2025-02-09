npm install
```
3. Set up environment variables (see Environment Setup below)
4. Start development server:
```bash
npm run dev
```

## Documentation

- [Best Practices Guide](docs/BEST_PRACTICES.md) - Comprehensive development guidelines
- [API Documentation](docs/API.md) - API endpoints and usage
- [Database Schema](docs/SCHEMA.md) - Database structure and relationships
- [Compliance Checking](scripts/check-compliance.ts) - Automated best practices verification

## Environment Setup

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Telegram Bot API token
- `SESSION_SECRET`: Secret for session management

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

## Project Structure
```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and utilities
├── docs/            # Documentation
└── scripts/         # Utility scripts