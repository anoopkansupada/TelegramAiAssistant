import type { CrashStatistics } from './types';

export class CrashReporter {
  private crashes: Map<string, {
    error: Error;
    timestamp: Date;
    context: Record<string, any>;
  }> = new Map();

  capture(error: Error): string {
    const id = `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.crashes.set(id, {
      error,
      timestamp: new Date(),
      context: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      }
    });

    console.error('[CrashReporter] Captured crash:', {
      id,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    return id;
  }

  aggregate(): CrashStatistics {
    const now = Date.now();
    const stats: CrashStatistics = {
      total: this.crashes.size,
      recent: 0,
      byType: {},
      timeline: []
    };

    // Convert Map entries to array before iteration
    Array.from(this.crashes.entries()).forEach(([id, crash]) => {
      // Count recent crashes
      if (now - crash.timestamp.getTime() < 60 * 60 * 1000) {
        stats.recent++;
      }

      // Group by error type
      const type = crash.error.name;
      if (!stats.byType[type]) {
        stats.byType[type] = 0;
      }
      stats.byType[type]++;

      // Build timeline
      stats.timeline.push({
        id,
        timestamp: crash.timestamp.toISOString(),
        type,
        message: crash.error.message
      });
    });

    // Sort timeline by timestamp
    stats.timeline.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return stats;
  }

  notify(incidentId: string): void {
    const crash = this.crashes.get(incidentId);
    if (!crash) {
      console.warn('[CrashReporter] Incident not found:', incidentId);
      return;
    }

    console.error('[CrashReporter] Critical incident:', {
      id: incidentId,
      error: {
        name: crash.error.name,
        message: crash.error.message,
        stack: crash.error.stack
      },
      context: crash.context,
      timestamp: crash.timestamp
    });
  }
}