export interface CoverageReport {
  timestamp: string;
  coverage: Record<string, { covered: boolean }>;
  summary: {
    totalPaths: number;
    coveredPaths: number;
  };
}

export type ErrorCategory = 
  | 'network'
  | 'database'
  | 'auth'
  | 'validation'
  | 'telegram'
  | 'system'
  | 'unknown';

export interface ErrorPattern {
  regex: RegExp;
  category: ErrorCategory;
  description?: string;
}

export interface ErrorInsights {
  categories: Record<ErrorCategory, number>;
  trends: Record<ErrorCategory, number>;
  recommendations: Array<{
    category: ErrorCategory;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

export interface CrashStatistics {
  total: number;
  recent: number;
  byType: Record<string, number>;
  timeline: Array<{
    id: string;
    timestamp: string;
    type: string;
    message: string;
  }>;
}

export interface Transaction {
  id: string;
  complete: () => void;
  fail: (error: Error) => void;
}
