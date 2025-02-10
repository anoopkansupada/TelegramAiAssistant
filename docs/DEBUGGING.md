// Check session status
const sessionStatus = await checkSession();
if (!sessionStatus.valid) {
  console.error('[Auth] Invalid session:', {
    reason: sessionStatus.reason,
    lastValid: sessionStatus.lastValidTime
  });
}
```

### 2. WebSocket Disconnections
```typescript
// Proper WebSocket handling
ws.onclose = (event) => {
  console.error('[WebSocket] Connection closed:', {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean
  });
  // Implement exponential backoff
  setTimeout(reconnect, calculateBackoff());
};
```

### 3. Database Sync Issues
```typescript
// Verify database state
async function verifyDatabaseIntegrity() {
  const tables = ['contacts', 'messages', 'channels'];
  for (const table of tables) {
    const count = await db.count().from(table);
    console.log(`[Database] ${table} count:`, count);
  }
}
```

## Diagnostic Tools

### 1. Connection Monitor
- Real-time WebSocket status
- Telegram session state
- Database connection pool
- API response times

### 2. State Inspector
- Current authentication state
- Active subscriptions 
- Cached data status
- Pending operations

### 3. Performance Metrics
- Response times
- Resource usage
- Error rates 
- Cache hit rates

## Debug Process Flow

1. Initial Assessment
   - Check error logs
   - Verify connection status
   - Review recent changes
   - Check system resources

2. Root Cause Analysis
   - Trace error stack
   - Review related components
   - Check dependent services
   - Analyze timing issues

3. Solution Implementation
   - Create minimal reproduction
   - Test in isolation
   - Implement fix
   - Verify solution

4. Verification
   - Test primary functionality
   - Check related features
   - Verify performance impact
   - Monitor for regressions

## Best Practices

### 1. Logging
```typescript
// Structured logging
function logError(context: string, error: Error, metadata?: object) {
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: error.stack,
    ...metadata
  });
}
```

### 2. Error Handling
```typescript
// Proper error context
async function handleOperation(params: OpParams) {
  try {
    const result = await performOperation(params);
    return result;
  } catch (error) {
    logError('Operation', error, { params });
    throw new OperationalError('Operation failed', { cause: error });
  }
}
```

### 3. State Management
```typescript
// State verification
function verifyState(state: AppState) {
  const checks = [
    checkAuthentication(state.auth),
    checkConnections(state.connections),
    checkCache(state.cache)
  ];

  return Promise.all(checks);
}
```

## Emergency Procedures

### 1. Service Disruption
1. Check all connection statuses
2. Review recent error logs
3. Verify database state
4. Test API endpoints
5. Check Telegram API status

### 2. Data Synchronization Issues
1. Verify database consistency
2. Check Telegram session
3. Review sync logs
4. Test reconnection
5. Verify cache state

### 3. Performance Problems
1. Check resource usage
2. Review active connections
3. Analyze query performance
4. Monitor memory usage
5. Check network latency

## Monitoring Setup

### 1. Real-time Monitors
- WebSocket status
- Connection health
- Error rates
- Response times

### 2. Alerts
- Connection failures
- High error rates
- Performance degradation
- Authentication issues

### 3. Logging
- Error context
- Operation timing
- State changes
- Resource usage

## Recovery Procedures

### 1. Connection Recovery
```typescript
async function recoverConnection() {
  await clearInvalidSessions();
  await reconnectWebSocket();
  await verifyTelegramAuth();
  await checkDatabaseConnection();
}
```

### 2. State Recovery
```typescript
async function recoverState() {
  await invalidateCache();
  await reloadUserData();
  await syncTelegramState();
  await verifyIntegrity();
}
```

### 3. Error Recovery
```typescript
async function handleRecovery(error: SystemError) {
  await logError('System', error);
  await notifyAdministrators(error);
  await attemptAutoRecovery(error);
  await verifySystemState();
}