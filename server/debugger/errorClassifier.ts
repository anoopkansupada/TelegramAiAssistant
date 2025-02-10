import type { ErrorCategory, ErrorPattern, ErrorInsights } from './types';

export class ErrorClassifier {
  private patterns: ErrorPattern[] = [];
  private errorHistory: Map<string, {
    count: number;
    lastOccurrence: Date;
    category: ErrorCategory;
  }> = new Map();

  classify(error: Error): ErrorCategory {
    const errorString = `${error.name}: ${error.message}`;

    // Check against known patterns
    for (const pattern of this.patterns) {
      if (pattern.regex.test(errorString)) {
        this.trackError(errorString, pattern.category);
        return pattern.category;
      }
    }

    // Default classification
    this.trackError(errorString, 'unknown');
    return 'unknown';
  }

  updatePatterns(patterns: ErrorPattern[]): void {
    this.patterns = patterns.map(pattern => ({
      ...pattern,
      regex: new RegExp(pattern.regex)
    }));
  }

  generateInsights(): ErrorInsights {
    const insights: ErrorInsights = {
      categories: {
        validation: 0,
        network: 0,
        database: 0,
        auth: 0,
        telegram: 0,
        system: 0,
        unknown: 0
      },
      trends: {
        validation: 0,
        network: 0,
        database: 0,
        auth: 0,
        telegram: 0,
        system: 0,
        unknown: 0
      },
      recommendations: []
    };

    // Analyze error distribution
    for (const [, data] of this.errorHistory) {
      insights.categories[data.category]++;

      // Analyze trends (last 24 hours)
      if (Date.now() - data.lastOccurrence.getTime() < 24 * 60 * 60 * 1000) {
        insights.trends[data.category]++;
      }
    }

    // Generate recommendations
    Object.entries(insights.categories).forEach(([category, count]) => {
      if (count > 10) {
        insights.recommendations.push({
          category: category as ErrorCategory,
          message: `High number of ${category} errors detected (${count} occurrences)`,
          priority: 'high'
        });
      }
    });

    return insights;
  }

  private trackError(errorString: string, category: ErrorCategory): void {
    const existing = this.errorHistory.get(errorString) || {
      count: 0,
      lastOccurrence: new Date(),
      category
    };

    existing.count++;
    existing.lastOccurrence = new Date();
    this.errorHistory.set(errorString, existing);
  }
}