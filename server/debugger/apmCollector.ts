import type { Transaction } from './types';

export class APMCollector {
  private transactions: Map<string, {
    startTime: number;
    duration?: number;
    status: 'active' | 'completed' | 'failed';
  }> = new Map();

  private latencies: Map<string, number[]> = new Map();
  private dependencies: Map<string, {
    calls: number;
    errors: number;
    totalDuration: number;
  }> = new Map();

  trackTransaction(name: string): Transaction {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.transactions.set(id, {
      startTime,
      status: 'active'
    });

    return {
      id,
      complete: () => {
        const duration = Date.now() - startTime;
        this.transactions.set(id, {
          startTime,
          duration,
          status: 'completed'
        });
        this.recordLatency(name, duration);
      },
      fail: (error: Error) => {
        this.transactions.set(id, {
          startTime,
          duration: Date.now() - startTime,
          status: 'failed'
        });
        console.error('[APM] Transaction failed:', {
          id,
          name,
          error: {
            name: error.name,
            message: error.message
          }
        });
      }
    };
  }

  measureLatency(operation: string): number {
    const latencies = this.latencies.get(operation) || [];
    if (latencies.length === 0) return 0;

    // Calculate p95 latency
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    return sortedLatencies[p95Index];
  }

  recordDependencyCall(service: string): void {
    const stats = this.dependencies.get(service) || {
      calls: 0,
      errors: 0,
      totalDuration: 0
    };

    stats.calls++;
    this.dependencies.set(service, stats);
  }

  private recordLatency(operation: string, duration: number): void {
    const latencies = this.latencies.get(operation) || [];
    latencies.push(duration);
    // Keep only last 100 measurements
    if (latencies.length > 100) {
      latencies.shift();
    }
    this.latencies.set(operation, latencies);
  }

  getMetrics() {
    return {
      transactions: {
        active: Array.from(this.transactions.values()).filter(t => t.status === 'active').length,
        completed: Array.from(this.transactions.values()).filter(t => t.status === 'completed').length,
        failed: Array.from(this.transactions.values()).filter(t => t.status === 'failed').length
      },
      latencies: Object.fromEntries(
        Array.from(this.latencies.entries()).map(([op, latencies]) => [
          op,
          {
            p95: this.measureLatency(op),
            count: latencies.length
          }
        ])
      ),
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries()).map(([service, stats]) => [
          service,
          {
            ...stats,
            errorRate: stats.errors / stats.calls,
            avgDuration: stats.totalDuration / stats.calls
          }
        ])
      )
    };
  }
}
