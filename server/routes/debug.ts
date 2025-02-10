import { Router } from 'express';
import debugger from '../debugger';

const router = Router();

router.get('/debug/metrics', async (req, res) => {
  const transaction = debugger.apmCollector.trackTransaction('get_debug_metrics');
  
  try {
    // Collect all debugging metrics
    const metrics = {
      coverage: await debugger.coverageReporter.generateReport(),
      errorInsights: debugger.errorClassifier.generateInsights(),
      crashes: debugger.crashReporter.aggregate(),
      apm: debugger.apmCollector.getMetrics()
    };

    transaction.complete();
    res.json(metrics);
  } catch (error) {
    transaction.fail(error as Error);
    debugger.crashReporter.capture(error as Error);
    res.status(500).json({ error: 'Failed to collect debug metrics' });
  }
});

export default router;
