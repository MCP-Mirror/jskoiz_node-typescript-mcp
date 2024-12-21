import { join } from 'path';

// Configuration for available documentation sources
export const docSources = {
  typescript: {
    name: 'TypeScript',
    repo: 'https://github.com/microsoft/TypeScript-Website.git',
    setup: {
      sourcePath: ['packages', 'documentation', 'copy', 'en'],
      targetPath: ['ts-docs', 'copy', 'en']
    }
  },
  node: {
    name: 'Node.js',
    repo: 'https://github.com/nodejs/node.git',
    setup: {
      sourcePath: ['doc'],
      targetPath: ['node-docs', 'copy']
    }
  },
  discord: {
    name: 'Discord.js',
    repo: 'https://github.com/discordjs/guide.git',
    setup: {
      sourcePath: ['guide'],
      targetPath: ['discord-docs', 'guide']
    }
  }
};

// Helper to get full paths
export function getSourcePath(rootDir, source, subPath = []) {
  return join(rootDir, source, 'temp', ...subPath);
}

export function getTargetPath(rootDir, subPath = []) {
  return join(rootDir, ...subPath);
}
