import type { CoverageReport } from './types';

export class CoverageReporter {
  private coverageData: Map<string, boolean> = new Map();

  async generateReport(): Promise<CoverageReport> {
    const timestamp = new Date().toISOString();
    
    return {
      timestamp,
      coverage: Array.from(this.coverageData.entries()).reduce((acc, [path, covered]) => {
        acc[path] = { covered };
        return acc;
      }, {} as Record<string, { covered: boolean }>),
      summary: {
        totalPaths: this.coverageData.size,
        coveredPaths: Array.from(this.coverageData.values()).filter(Boolean).length
      }
    };
  }

  trackChanges(): void {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const stack = new Error().stack;
      if (stack) {
        const paths = stack.split('\n').slice(1).map(line => {
          const match = line.match(/\((.*?):\d+:\d+\)/);
          return match ? match[1] : null;
        }).filter(Boolean);
        
        paths.forEach(path => {
          if (path) this.coverageData.set(path, true);
        });
      }
      originalConsoleError.apply(console, args);
    };
  }

  async exportMetrics(): Promise<void> {
    const report = await this.generateReport();
    console.log('[Coverage] Metrics:', {
      timestamp: report.timestamp,
      coveragePercentage: (report.summary.coveredPaths / report.summary.totalPaths) * 100,
      ...report.summary
    });
  }
}
