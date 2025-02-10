import { CoverageReporter } from './coverage';
import { ErrorClassifier } from './errorClassifier';
import { CrashReporter } from './crashReporter';
import { APMCollector } from './apmCollector';

export * from './types';

export const debugTools = {
  coverageReporter: new CoverageReporter(),
  errorClassifier: new ErrorClassifier(),
  crashReporter: new CrashReporter(),
  apmCollector: new APMCollector()
};

// Initialize default error patterns
debugTools.errorClassifier.updatePatterns([
  {
    regex: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/,
    category: 'network',
    description: 'Network connectivity issues'
  },
  {
    regex: /QueryFailedError|ConnectionError/,
    category: 'database',
    description: 'Database operation failures'
  },
  {
    regex: /AuthenticationError|UnauthorizedError/,
    category: 'auth',
    description: 'Authentication and authorization issues'
  },
  {
    regex: /ValidationError|InvalidInput/,
    category: 'validation',
    description: 'Input validation failures'
  },
  {
    regex: /TelegramError|MTProtoError/,
    category: 'telegram',
    description: 'Telegram API related issues'
  }
]);

// Start coverage tracking
debugTools.coverageReporter.trackChanges();

export default debugTools;