import { ComplianceChecker } from '../shared/utils/compliance';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('Running compliance checks...'));
  console.log('===============================');

  const checker = new ComplianceChecker();
  const { passed, results } = await checker.runAllChecks();

  // Display results
  Object.entries(results).forEach(([checkName, result]) => {
    console.log(`\n${chalk.bold(checkName)}:`);
    if (result.passed) {
      console.log(chalk.green('✓ Passed'));
    } else {
      console.log(chalk.red('✗ Failed'));
      result.issues.forEach((issue) => {
        console.log(chalk.yellow(`  - ${issue}`));
      });
    }
  });

  console.log('\n===============================');
  if (passed) {
    console.log(chalk.green.bold('All compliance checks passed! ✨'));
  } else {
    console.log(chalk.red.bold('Some compliance checks failed. Please fix the issues above.'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Error running compliance checks:'), error);
  process.exit(1);
});
