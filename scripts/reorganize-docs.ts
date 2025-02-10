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
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// First, check which files exist
const existingFiles = fs.readdirSync(DOCS_PATH).filter(file => 
  fs.statSync(path.join(DOCS_PATH, file)).isFile()
);

console.log('Existing files:', existingFiles);

// Define file movements for existing files
const fileMovements = [
  // Core documentation stays in root
  { from: 'API.md', to: 'API.md' },
  { from: 'ARCHITECTURE.md', to: 'ARCHITECTURE.md' },
  { from: 'AUTHENTICATION.md', to: 'AUTHENTICATION.md' },
  { from: 'SCHEMA.md', to: 'SCHEMA.md' },

  // Move documentation guides to guides/
  { from: 'DOCUMENTATION_REVIEW.md', to: 'guides/DOCUMENTATION.md' },
  { from: 'DOCUMENT_MANAGEMENT.md', to: 'guides/DOCUMENT_MANAGEMENT.md' },
  { from: 'ISSUES.md', to: 'guides/TROUBLESHOOTING.md' },
  { from: 'USERBOT.md', to: 'guides/TELEGRAM.md' },

  // Structure.md becomes part of documentation guide
  { from: 'STRUCTURE.md', to: 'guides/DOCUMENTATION.md' }
];

// Execute file movements only for existing files
fileMovements.forEach(({ from, to }) => {
  const sourcePath = path.join(DOCS_PATH, from);
  const targetPath = path.join(DOCS_PATH, to);

  if (fs.existsSync(sourcePath)) {
    // Create target directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // If target file exists and it's a merge operation
    if (to === 'guides/DOCUMENTATION.md' && fs.existsSync(targetPath)) {
      // Read both files
      const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
      const targetContent = fs.readFileSync(targetPath, 'utf-8');

      // Append source content to target
      fs.writeFileSync(targetPath, `${targetContent}\n\n${sourceContent}`);
      console.log(`Merged ${from} into ${to}`);

      // Delete source file if it was Structure.md
      if (from === 'STRUCTURE.md') {
        fs.unlinkSync(sourcePath);
      }
    } else {
      // Regular move operation
      fs.renameSync(sourcePath, targetPath);
      console.log(`Moved ${from} to ${to}`);
    }
  } else {
    console.log(`Skipping ${from} - file does not exist`);
  }
});

console.log('Documentation reorganization complete');