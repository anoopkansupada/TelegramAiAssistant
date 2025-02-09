# Telegram CRM Platform Best Practices

## Project Overview
A Telegram-integrated CRM platform designed to streamline customer relationship management with intelligent communication tools and channel management capabilities.

## Tech Stack
- React frontend with shadcn/ui components
- Express backend
- Telegraf for Telegram integration
- PostgreSQL database
- Drizzle ORM for database management
- Enhanced authentication debugging and logging
- AI-powered communication features

## Development Guidelines

### 1. Project Setup
- Use Git for version control
- Configure environment variables properly using Replit Secrets
- Follow the proper project structure:
  ```
  ├── client/          # React frontend
  ├── server/          # Express backend
  ├── shared/          # Shared types and utilities
  ├── docs/            # Documentation
  └── drizzle.config.ts
  ```

### 2. Bot Structure & Responsibilities
#### Telegram Bot (Telegraf)
- Broadcasts announcements when requested
- Handles user interactions through web UI
- Maintains secure session management

#### User Bot Integration
- Reads messages and chat history
- Processes meeting transcripts
- Suggests engagement strategies
- Requires web UI approval for actions

### 3. Database Management
- Use Drizzle ORM for all database operations
- Define schemas in `shared/schema.ts`
- Never write raw SQL queries
- Use migrations for schema changes

### 4. Frontend Development
- Use shadcn/ui components
- Implement responsive designs
- Follow React Query patterns for data fetching
- Use proper form validation with Zod

### 5. Security Practices
- Store sensitive data in Replit Secrets
- Implement proper authentication flows
- Validate all user inputs
- Use secure session management

### 6. AI Features Implementation
- Implement rate limiting for API calls
- Cache responses when appropriate
- Handle errors gracefully
- Log important events for debugging

## Working with the Codebase

### Starting Development
1. Clone the repository
2. Install dependencies using packager_install_tool
3. Set up required environment variables
4. Start the development server with `npm run dev`

### Making Changes
1. Create feature branches
2. Follow TypeScript best practices
3. Test thoroughly before merging
4. Update documentation as needed

### Deployment
- Deploy using Replit
- Ensure all environment variables are set
- Verify database migrations
- Test in staging environment first

## Common Pitfalls to Avoid
1. Direct database manipulation without ORM
2. Hardcoding sensitive information
3. Skipping input validation
4. Ignoring TypeScript types
5. Missing error handling

## Additional Resources
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [React Query Documentation](https://tanstack.com/query/latest)
