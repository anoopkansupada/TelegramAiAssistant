import { Router } from 'express';
import { debugTools } from '../debugger';

const router = Router();

router.get('/debug/metrics', async (req, res) => {
  const transaction = debugTools.apmCollector.trackTransaction('get_debug_metrics');

  try {
    // Collect all debugging metrics
    const metrics = {
      coverage: await debugTools.coverageReporter.generateReport(),
      errorInsights: debugTools.errorClassifier.generateInsights(),
      crashes: debugTools.crashReporter.aggregate(),
      apm: debugTools.apmCollector.getMetrics()
    };

    transaction.complete();
    res.json(metrics);
  } catch (error) {
    transaction.fail(error as Error);
    debugTools.crashReporter.capture(error as Error);
    res.status(500).json({ error: 'Failed to collect debug metrics' });
  }
});

export default router;