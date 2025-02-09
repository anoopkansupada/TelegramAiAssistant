// Correct
  const user = await db.query.users.findFirst({
    where: eq(users.id, id)
  });

  // Incorrect
  const [user] = await db.select().from(users).where(eq(users.id, id));
  ```
- Implement proper connection pooling:
  ```typescript
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    maxUses: 7500,
  });
  ```
- Use retry mechanisms for database operations
- Avoid raw SQL queries
- Use transactions for multi-step operations

### 2. Telegram Integration
- Implement proper session handling:
  - Regular connection health checks
  - Automatic cleanup on disconnection
  - Connection retry with backoff
- Use singleton pattern for client management
- Validate all API responses
- Handle rate limits properly

### 3. Authentication Flow
- Implement secure password validation
- Handle all 2FA scenarios
- Use proper session cleanup
- Validate inputs before API calls

### 4. Error Handling
- Use custom logger implementation
- Implement retry mechanisms with backoff
- Track connection states
- Log important state changes

### 5. Frontend Development
- Use shadcn/ui components
- Implement responsive designs
- Follow React Query patterns for data fetching
- Use proper form validation with Zod

### 6. Project Structure
```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and utils
├── docs/            # Documentation
└── drizzle.config.ts
```

### 7. Security Practices
- Store sensitive data in Replit Secrets
- Implement proper authentication flows
- Validate all user inputs
- Use secure session management

### 8. AI Features
- Implement rate limiting
- Cache responses when appropriate
- Handle errors gracefully
- Log important events

## Working with the Codebase

### Database Operations
1. Always use query builder:
   ```typescript
   // Correct
   return await db.query.users.findFirst({
     where: eq(users.id, id)
   });
   ```
2. Handle errors consistently:
   ```typescript
   try {
     // Database operation
   } catch (error) {
     console.error('Operation failed:', error);
     throw error;
   }
   ```
3. Use transactions when needed
4. Implement proper connection pooling

### Session Management
1. Implement health checks:
   ```typescript
   setInterval(async () => {
     if (clientManager.isConnected()) {
       try {
         const client = await clientManager.getClient();
         await client.getMe();
       } catch (error) {
         await clientManager.cleanup();
       }
     }
   }, 60 * 1000);
   ```

2. Clean up resources properly:
   ```typescript
   public async cleanup(): Promise<void> {
     if (this.cleanupInProgress) {
       await new Promise(resolve => setTimeout(resolve, 1000));
       return;
     }
     this.cleanupInProgress = true;
     try {
       if (this.client?.connected) {
         await this.client.disconnect();
       }
       await this.client?.destroy();
     } finally {
       this.client = null;
       this.session = null;
       this.connected = false;
       this.cleanupInProgress = false;
     }
   }