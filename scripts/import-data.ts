import { importTelegramData } from '../server/utils/dataImport';

async function main() {
  try {
    // Using userId 1 as default admin user
    await importTelegramData(1);
    console.log('Data import completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

main();
