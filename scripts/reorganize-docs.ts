import fs from 'fs';
import path from 'path';

const DOCS_PATH = path.join(process.cwd(), 'docs');

// Create new directory structure
const directories = [
  'guides',
  'ai'
];

// Create directories if they don't exist
directories.forEach(dir => {
  const fullPath = path.join(DOCS_PATH, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
});

// Move and rename files
const fileMovements = [
  // AI documentation
  { from: 'AI_INTEGRATION.md', to: 'ai/OVERVIEW.md' },
  { from: 'AI_MODELS.md', to: 'ai/MODELS.md' },
  
  // Developer guides
  { from: 'DEBUGGING.md', to: 'guides/DEBUGGING.md' },
  { from: 'BEST_PRACTICES.md', to: 'guides/BEST_PRACTICES.md' },
  { from: 'GET_TELEGRAM_SESSION.md', to: 'guides/TELEGRAM.md' },
  
  // Core documentation remains in root
  // These files stay in place: ARCHITECTURE.md, API.md, AUTHENTICATION.md, SCHEMA.md
];

// Execute file movements
fileMovements.forEach(({ from, to }) => {
  const sourcePath = path.join(DOCS_PATH, from);
  const targetPath = path.join(DOCS_PATH, to);
  
  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, targetPath);
    console.log(`Moved ${from} to ${to}`);
  } else {
    console.log(`Warning: Source file ${from} not found`);
  }
});

console.log('Documentation reorganization complete');
