#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { docSources, getSourcePath, getTargetPath } from './docs-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const selectedDocs = new Set(args);

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function setupDocs(sourceKey) {
  const source = docSources[sourceKey];
  if (!source) {
    console.error(`Unknown documentation source: ${sourceKey}`);
    return;
  }

  console.log(`Setting up ${source.name} documentation...`);
  
  // Clean and create base directory
  const baseDir = join(rootDir, sourceKey);
  try {
    await fs.rm(baseDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore if directory doesn't exist
  }
  
  await ensureDirectoryExists(baseDir);
  
  // Clone repository
  execSync(
    `git clone --depth 1 ${source.repo} ${sourceKey}/temp`,
    { stdio: 'inherit', cwd: rootDir }
  );

  // Create target directory
  const targetDir = getTargetPath(rootDir, source.setup.targetPath);
  await ensureDirectoryExists(dirname(targetDir));
  
  try {
    // Copy or move the docs
    const sourcePath = getSourcePath(rootDir, sourceKey, source.setup.sourcePath);
    await fs.cp(sourcePath, targetDir, { recursive: true });
  } catch (err) {
    console.error(`Error copying ${source.name} docs:`, err);
    throw err;
  } finally {
    // Clean up temporary clone
    await fs.rm(join(rootDir, sourceKey, 'temp'), { recursive: true, force: true });
  }
  
  console.log(`${source.name} documentation setup complete`);
}

async function main() {
  try {
    // If no docs specified via command line, prompt user
    if (selectedDocs.size === 0) {
      console.log('Available documentation sources:');
      Object.entries(docSources).forEach(([key, source]) => {
        console.log(`  ${key}: ${source.name}`);
      });
      console.log('\nEnter documentation sources to install (space-separated), or "all":');
      const answer = await prompt('> ');
      
      if (answer === 'all') {
        Object.keys(docSources).forEach(key => selectedDocs.add(key));
      } else {
        answer.split(/\s+/).forEach(key => {
          if (key && docSources[key]) selectedDocs.add(key);
        });
      }
    }

    // Validate selected docs
    for (const doc of selectedDocs) {
      if (!docSources[doc]) {
        console.error(`Unknown documentation source: ${doc}`);
        process.exit(1);
      }
    }

    // Setup selected docs
    for (const doc of selectedDocs) {
      await setupDocs(doc);
    }

    if (selectedDocs.size > 0) {
      console.log('Documentation setup completed successfully');
    } else {
      console.log('No documentation sources selected');
    }
  } catch (error) {
    console.error('Error setting up documentation:', error);
    process.exit(1);
  }
}

main();
