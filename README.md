### Development Setup

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

### Database Schema

Currently implemented tables:
- Users
- Companies
- Contacts
- Messages
- Channels
- Announcements

### Contributing Guidelines

1. Follow TypeScript best practices
2. Use the provided UI components
3. Maintain consistent code style
4. Add proper error handling
5. Include tests for new features

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