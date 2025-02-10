interface WebSocketMetrics {
  messageLatency: number[];
  messageRate: number;
  errorRate: number;
  connectionStability: number;
  clientCount: number;
}

const wsPerformanceThresholds = {
  messageLatency: {
    warning: 100, // 100ms
    critical: 500  // 500ms
  },
  messageRate: {
    max: 100, // messages per second
    warning: 80
  },
  errorRate: {
    warning: 0.01, // 1%
    critical: 0.05 // 5%
  },
  reconnectRate: {
    warning: 0.1, // 10% of clients
    critical: 0.3 // 30% of clients
  }
};
```

### Health Checks
```typescript
class WebSocketHealthCheck {
  async checkHealth(): Promise<HealthStatus> {
    const metrics = await this.collectMetrics();

    return {
      status: this.determineStatus(metrics),
      clientCount: metrics.clientCount,
      messageRate: metrics.messageRate,
      averageLatency: this.calculateAverageLatency(metrics.messageLatency),
      errorRate: metrics.errorRate,
      timestamp: new Date().toISOString()
    };
  }

  private determineStatus(metrics: WebSocketMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.errorRate > wsPerformanceThresholds.errorRate.critical ||
        metrics.connectionStability < 0.7) {
      return 'unhealthy';
    }

    if (metrics.errorRate > wsPerformanceThresholds.errorRate.warning ||
        metrics.connectionStability < 0.9) {
      return 'degraded';
    }

    return 'healthy';
  }
}
```

### Recovery Procedures
```typescript
class WebSocketRecovery {
  async handleFailure(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

    // 1. Close existing connection
    await this.closeConnection(connection);

    // 2. Clean up resources
    await this.cleanupResources(connection);

    // 3. Attempt reconnection with exponential backoff
    await this.reconnectWithBackoff(connection);

    // 4. Verify new connection
    await this.verifyConnection(connection);

    // 5. Restore subscription state
    await this.restoreState(connection);
  }

  private async reconnectWithBackoff(connection: WebSocketConnection): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.connect(connection);
        break;
      } catch (error) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

## Telegram Session Management

### Session Health Monitoring
```typescript
class TelegramSessionMonitor {
  private readonly healthCheckInterval = 5 * 60 * 1000; // 5 minutes
  private readonly sessionRotationInterval = 24 * 60 * 60 * 1000; // 24 hours

  async monitorSession(): Promise<void> {
    // Regular health checks
    setInterval(async () => {
      const health = await this.checkSessionHealth();
      if (!health.healthy) {
        await this.handleUnhealthySession(health);
      }
    }, this.healthCheckInterval);

    // Scheduled session rotation
    setInterval(async () => {
      await this.rotateSession();
    }, this.sessionRotationInterval);
  }

  private async checkSessionHealth(): Promise<SessionHealth> {
    const session = await this.getCurrentSession();
    return {
      healthy: this.isSessionHealthy(session),
      lastUsed: session.lastUsed,
      errorCount: await this.getSessionErrorCount(session.id),
      performance: await this.getSessionPerformance(session.id)
    };
  }

  private async handleUnhealthySession(health: SessionHealth): Promise<void> {
    console.error('[Telegram] Unhealthy session detected:', {
      lastUsed: health.lastUsed,
      errorCount: health.errorCount,
      performance: health.performance
    });

    if (health.errorCount > 5) {
      await this.forceSessionRotation();
    } else {
      await this.attemptSessionRecovery();
    }
  }
}
```

### Performance Monitoring
```typescript
interface TelegramMetrics {
  messageLatency: number[];
  dcLatency: Record<number, number>;
  updateRate: number;
  floodWaitCount: number;
  migrationCount: number;
}

const telegramThresholds = {
  messageLatency: {
    warning: 500, // 500ms
    critical: 2000 // 2 seconds
  },
  floodWait: {
    warning: 5, // 5 flood wait errors per hour
    critical: 20 // 20 flood wait errors per hour
  },
  dcLatency: {
    warning: 1000, // 1 second
    critical: 3000 // 3 seconds
  }
};

class TelegramPerformanceMonitor {
  async collectMetrics(): Promise<TelegramMetrics> {
    return {
      messageLatency: await this.measureMessageLatency(),
      dcLatency: await this.measureDCLatency(),
      updateRate: await this.calculateUpdateRate(),
      floodWaitCount: await this.getFloodWaitCount(),
      migrationCount: await this.getMigrationCount()
    };
  }

  private async measureDCLatency(): Promise<Record<number, number>> {
    const dcs = [1, 2, 3, 4, 5];
    const results: Record<number, number> = {};

    for (const dc of dcs) {
      const start = Date.now();
      try {
        await this.pingDC(dc);
        results[dc] = Date.now() - start;
      } catch (error) {
        results[dc] = -1; // DC unavailable
      }
    }

    return results;
  }
}
```

## Rate Limiting

### Configuration
```typescript
const rateLimitConfig = {
  telegram: {
    messagesSent: {
      window: 60 * 1000, // 1 minute
      max: 30, // 30 messages per minute
      perChat: 20 // 20 messages per chat per minute
    },
    mediaUploads: {
      window: 60 * 1000,
      max: 10, // 10 uploads per minute
      maxSize: 50 * 1024 * 1024 // 50MB
    },
    channelInvites: {
      window: 24 * 60 * 60 * 1000, // 24 hours
      max: 50 // 50 invites per day
    }
  },
  api: {
    standard: {
      window: 60 * 1000,
      max: 100 // 100 requests per minute
    },
    auth: {
      window: 15 * 60 * 1000, // 15 minutes
      max: 5 // 5 attempts per 15 minutes
    }
  },
  websocket: {
    connections: {
      perUser: 3,
      total: 1000
    },
    messages: {
      window: 60 * 1000,
      max: 100, // 100 messages per minute
      maxSize: 4 * 1024 // 4KB per message
    }
  }
};
```

### Implementation
```typescript
class RateLimiter {
  private storage = new Map<string, {
    count: number;
    resetAt: number;
  }>();

  async checkLimit(
    key: string,
    config: { window: number; max: number }
  ): Promise<boolean> {
    const now = Date.now();
    const entry = this.storage.get(key) || {
      count: 0,
      resetAt: now + config.window
    };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + config.window;
    }

    if (entry.count >= config.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new RateLimitError(`Rate limit exceeded, retry after ${retryAfter} seconds`);
    }

    entry.count++;
    this.storage.set(key, entry);
    return true;
  }
}
```

### Monitoring
```typescript
class RateLimitMonitor {
  async collectMetrics(): Promise<RateLimitMetrics> {
    return {
      telegramRates: await this.getTelegramRates(),
      apiRates: await this.getAPIRates(),
      websocketRates: await this.getWebSocketRates(),
      throttledRequests: await this.getThrottledRequests()
    };
  }

  private async checkThresholds(metrics: RateLimitMetrics): Promise<void> {
    if (metrics.throttledRequests.rate > 0.1) { // More than 10% of requests throttled
      await this.triggerAlert('high_throttle_rate', metrics);
    }

    if (metrics.telegramRates.floodWait > 5) { // More than 5 flood wait errors
      await this.triggerAlert('telegram_flood_wait', metrics);
    }
  }
}
```

## Health Check Endpoints

### WebSocket Health
```typescript
app.get('/health/websocket', async (req, res) => {
  const monitor = new WebSocketMonitor();
  const health = await monitor.checkHealth();

  res.status(health.status === 'healthy' ? 200 : 503).json({
    status: health.status,
    metrics: {
      connections: health.clientCount,
      messageRate: health.messageRate,
      errorRate: health.errorRate,
      averageLatency: health.averageLatency
    },
    timestamp: new Date().toISOString()
  });
});
```

### Telegram Health
```typescript
app.get('/health/telegram', async (req, res) => {
  const monitor = new TelegramPerformanceMonitor();
  const metrics = await monitor.collectMetrics();

  const health = {
    status: monitor.determineStatus(metrics),
    metrics: {
      messageLatency: metrics.messageLatency,
      dcLatency: metrics.dcLatency,
      floodWait: metrics.floodWaitCount,
      migrations: metrics.migrationCount
    },
    timestamp: new Date().toISOString()
  };

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### Rate Limit Status
```typescript
app.get('/health/rate-limits', async (req, res) => {
  const monitor = new RateLimitMonitor();
  const metrics = await monitor.collectMetrics();

  res.json({
    status: 'healthy',
    metrics: {
      telegram: metrics.telegramRates,
      api: metrics.apiRates,
      websocket: metrics.websocketRates
    },
    throttled: metrics.throttledRequests,
    timestamp: new Date().toISOString()
  });
});
```

```typescript
class ConnectionMonitor {
  private metrics: {
    wsStatus: boolean;
    telegramSession: boolean;
    dbConnection: boolean;
    apiLatency: number[];
  };

  async checkHealth(): Promise<HealthReport> {
    return {
      websocket: await this.checkWebSocket(),
      telegram: await this.checkTelegramConnection(),
      database: await this.checkDatabase(),
      api: await this.checkApiEndpoints(),
      latency: this.calculateLatencyMetrics()
    };
  }
}
```

```typescript
interface ConnectionMetrics {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
}

const thresholds = {
  responseTime: {
    warning: 1000, // 1 second
    critical: 5000 // 5 seconds
  },
  errorRate: {
    warning: 0.05, // 5%
    critical: 0.15 // 15%
  }
};
```

```typescript
async function analyzeQueryPerformance() {
  const metrics = await collectQueryMetrics({
    duration: '1h',
    minExecutionTime: 100, // ms
    includeExplain: true
  });

  console.log('[Performance] Slow queries:', 
    metrics.filter(m => m.executionTime > 200)
  );
}
```

```typescript
function monitorMemoryUsage() {
  const usage = process.memoryUsage();
  console.log('[Memory] Usage stats:', {
    heapUsed: usage.heapUsed / 1024 / 1024 + 'MB',
    heapTotal: usage.heapTotal / 1024 / 1024 + 'MB',
    external: usage.external / 1024 / 1024 + 'MB',
    rss: usage.rss / 1024 / 1024 + 'MB'
  });
}
```

```typescript
async function analyzeNetworkPerformance() {
  const metrics = await collectNetworkMetrics({
    period: '1h',
    resolution: '1m'
  });

  console.log('[Network] Performance:', {
    latency: calculatePercentiles(metrics.latency),
    throughput: metrics.throughput,
    errorRate: metrics.errorRate,
    saturation: metrics.saturation
  });
}
```

```typescript
async function recoverSession(error: SessionError) {
  console.log('[Recovery] Attempting session recovery');

  // 1. Clear invalid session
  await clearInvalidSessions();

  // 2. Attempt reconnection
  await reconnectWithBackoff();

  // 3. Verify new session
  await verifyNewSession();

  // 4. Restore previous state
  await restoreApplicationState();
}
```

```typescript
async function recoverState() {
  console.log('[Recovery] Initiating state recovery');

  // 1. Cache invalidation
  await invalidateCache();

  // 2. Reload user data
  await reloadUserData();

  // 3. Sync Telegram state
  await syncTelegramState();

  // 4. Verify integrity
  await verifySystemIntegrity();
}
```

```typescript
class MetricsCollector {
  private metrics: {
    wsConnections: number;
    activeUsers: number;
    errorRates: Record<string, number>;
    responseTime: number[];
  };

  async collectMetrics(): Promise<void> {
    this.metrics = {
      wsConnections: await this.countActiveConnections(),
      activeUsers: await this.countActiveUsers(),
      errorRates: await this.calculateErrorRates(),
      responseTime: await this.measureResponseTimes()
    };
  }
}
```

```typescript
const alertConfig = {
  connections: {
    threshold: 5,
    period: '5m',
    action: 'notify'
  },
  errors: {
    threshold: 10,
    period: '1m',
    action: 'escalate'
  },
  performance: {
    threshold: 1000, // ms
    period: '1m',
    action: 'warn'
  }
};
```

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  log(entry: LogEntry) {
    const sanitized = this.sanitizeLogData(entry);
    console.log(JSON.stringify(sanitized));
  }

  private sanitizeLogData(entry: LogEntry): LogEntry {
    return {
      ...entry,
      data: this.redactSensitiveData(entry.data)
    };
  }
}
```

```typescript
class ErrorTracker {
  private errors: Map<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    samples: Error[];
  }>;

  track(error: Error) {
    const key = this.getErrorKey(error);
    const entry = this.errors.get(key) || {
      count: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      samples: []
    };

    entry.count++;
    entry.lastSeen = new Date();
    if (entry.samples.length < 5) {
      entry.samples.push(error);
    }

    this.errors.set(key, entry);
  }

  private getErrorKey(error: Error): string {
    return `${error.name}:${error.message}`;
  }
}
```

```typescript
const responseTimeThresholds = {
  api: {
    p95: 500, // 95th percentile should be under 500ms
    p99: 1000, // 99th percentile should be under 1s
    max: 2000 // No request should take more than 2s
  },
  database: {
    queryTime: 100, // Most queries should complete within 100ms
    transactionTime: 500 // Transactions should complete within 500ms
  },
  websocket: {
    messageLatency: 100, // Message delivery should be under 100ms
    reconnectTime: 1000 // Reconnection should happen within 1s
  }
};
```

```typescript
const resourceThresholds = {
  memory: {
    warning: 0.7, // 70% usage triggers warning
    critical: 0.85 // 85% usage triggers critical alert
  },
  cpu: {
    warning: 0.6, // 60% usage triggers warning
    critical: 0.8 // 80% usage triggers critical alert
  },
  storage: {
    warning: 0.8, // 80% usage triggers warning
    critical: 0.9 // 90% usage triggers critical alert
  }
};
```

```typescript
const errorRateThresholds = {
  api: {
    warning: 0.01, // 1% error rate triggers warning
    critical: 0.05 // 5% error rate triggers critical alert
  },
  websocket: {
    disconnectRate: 0.1, // 10% disconnect rate triggers warning
    errorRate: 0.05 // 5% message error rate triggers warning
  },
  telegram: {
    authFailure: 0.1, // 10% auth failure rate triggers warning
    messageFailure: 0.05 // 5% message failure rate triggers warning
  }
};
```

```typescript
const connectionPoolThresholds = {
  database: {
    maxSize: 20,
    minAvailable: 2,
    maxWaitingClients: 10
  },
  websocket: {
    maxConnectionsPerUser: 3,
    maxTotalConnections: 1000,
    maxConnectionRate: 100 // per minute
  }
};
```

```typescript
const alertingMatrix = {
  high: {
    channels: ['slack', 'email'],
    escalation: true,
    retryInterval: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3
  },
  medium: {
    channels: ['slack'],
    escalation: false,
    retryInterval: 15 * 60 * 1000, // 15 minutes
    maxRetries: 2
  },
  low: {
    channels: ['logs'],
    escalation: false,
    retryInterval: 60 * 60 * 1000, // 1 hour
    maxRetries: 1
  }
};
```

```typescript
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  const status = health.status === 'healthy' ? 200 : 503;

  res.status(status).json({
    status: health.status,
    timestamp: new Date().toISOString(),
    checks: health.checks,
    version: process.env.APP_VERSION
  });
});

app.get('/health/detailed', async (req, res) => {
  const details = await getDetailedHealth();
  res.json({
    ...details,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});
```

## Debugging Tools Documentation

### Available Tools
```typescript
interface DebuggingTools {
  // Test Coverage Tools
  coverageReporter: {
    generateReport(): Promise<CoverageReport>;
    trackChanges(): void;
    exportMetrics(): Promise<void>;
  };

  // Error Classification
  errorClassifier: {
    classify(error: Error): ErrorCategory;
    updatePatterns(patterns: ErrorPattern[]): void;
    generateInsights(): ErrorInsights;
  };

  // Crash Reporting
  crashReporter: {
    capture(error: Error): string; // Returns incident ID
    aggregate(): CrashStatistics;
    notify(incident: string): void;
  };

  // APM Tools
  apmCollector: {
    trackTransaction(name: string): Transaction;
    measureLatency(operation: string): number;
    recordDependencyCall(service: string): void;
  };
}