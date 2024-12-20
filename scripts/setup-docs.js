#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function setupTypescriptDocs() {
  console.log('Setting up TypeScript documentation...');
  const tsDocsDir = join(rootDir, 'ts-docs');
  
  // Clean existing docs
  try {
    await fs.rm(tsDocsDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore if directory doesn't exist
  }
  
  await ensureDirectoryExists(tsDocsDir);
  
  // Clone TypeScript docs
  execSync(
    'git clone --depth 1 https://github.com/microsoft/TypeScript-Website.git ts-docs/copy',
    { stdio: 'inherit', cwd: rootDir }
  );
  
  console.log('TypeScript documentation setup complete');
}

async function setupNodeDocs() {
  console.log('Setting up Node.js documentation...');
  const nodeDocsDir = join(rootDir, 'node-docs');
  
  // Clean existing docs
  try {
    await fs.rm(nodeDocsDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore if directory doesn't exist
  }
  
  await ensureDirectoryExists(nodeDocsDir);
  
  // Clone Node.js docs
  execSync(
    'git clone --depth 1 https://github.com/nodejs/node.git node-docs/temp',
    { stdio: 'inherit', cwd: rootDir }
  );
  
  // Move only the docs directory
  await fs.rename(
    join(rootDir, 'node-docs/temp/doc'),
    join(rootDir, 'node-docs/copy')
  );
  
  // Clean up temporary clone
  await fs.rm(join(rootDir, 'node-docs/temp'), { recursive: true });
  
  console.log('Node.js documentation setup complete');
}

async function main() {
  try {
    await setupTypescriptDocs();
    await setupNodeDocs();
    console.log('Documentation setup completed successfully');
  } catch (error) {
    console.error('Error setting up documentation:', error);
    process.exit(1);
  }
}

main();
