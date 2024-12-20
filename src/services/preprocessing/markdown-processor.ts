import { promises as fs } from 'fs';
import { join } from 'path';
import { marked, Token } from 'marked';

export interface ProcessedChunk {
  content: string;
  metadata: {
    section: string;
    importance: number;
  };
}

export interface ProcessedDoc {
  id: string;
  title: string;
  content: string;
  chunks: ProcessedChunk[];
  metadata: {
    category: string;
    path: string;
    lastModified: number;
  };
}

export class MarkdownProcessor {
  constructor(private readonly basePath: string) {}

  private async processFile(filePath: string, category: string): Promise<ProcessedDoc> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    // Remove YAML frontmatter
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---/, '').trim();
    
    // Parse markdown
    const tokens = marked.lexer(contentWithoutFrontmatter);
    
    // Extract title from filename
    const title = filePath
      .split('/')
      .pop()!
      .replace('.md', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    // Process chunks
    const chunks: ProcessedChunk[] = [];
    let currentSection = '';
    let buffer: Token[] = [];

    for (const token of tokens) {
      if (token.type === 'heading') {
        // Process previous section if exists
        if (buffer.length > 0) {
          chunks.push({
            content: buffer.map(t => (t as any).text || '').join('\n'),
            metadata: {
              section: currentSection,
              importance: this.calculateImportance(currentSection, buffer)
            }
          });
          buffer = [];
        }
        currentSection = token.text;
      } else {
        buffer.push(token);
      }
    }

    // Add final section
    if (buffer.length > 0) {
      chunks.push({
        content: buffer.map(t => (t as any).text || '').join('\n'),
        metadata: {
          section: currentSection,
          importance: this.calculateImportance(currentSection, buffer)
        }
      });
    }

    return {
      id: Buffer.from(filePath).toString('base64'),
      title,
      content: contentWithoutFrontmatter,
      chunks,
      metadata: {
        category,
        path: filePath,
        lastModified: stats.mtimeMs
      }
    };
  }

  private calculateImportance(section: string, tokens: Token[]): number {
    let importance = 1;

    // Boost sections with key terms
    const keyTerms = ['interface', 'type', 'class', 'function', 'example', 'usage'];
    if (keyTerms.some(term => section.toLowerCase().includes(term))) {
      importance += 1;
    }

    // Boost sections with code blocks
    if (tokens.some(t => t.type === 'code')) {
      importance += 1;
    }

    // Boost sections with lists (often used for key points)
    if (tokens.some(t => t.type === 'list')) {
      importance += 0.5;
    }

    return importance;
  }

  async processDirectory(dirPath: string, category: string): Promise<ProcessedDoc[]> {
    const results: ProcessedDoc[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (['templates', 'diagrams', 'scripts'].includes(entry.name)) {
          continue;
        }
        const subResults = await this.processDirectory(fullPath, category);
        results.push(...subResults);
      } else if (entry.name.endsWith('.md')) {
        const doc = await this.processFile(fullPath, category);
        results.push(doc);
      }
    }

    return results;
  }

  async processAllDocs(categoryPaths: Record<string, string[]>): Promise<ProcessedDoc[]> {
    const allDocs: ProcessedDoc[] = [];

    for (const [category, paths] of Object.entries(categoryPaths)) {
      for (const path of paths) {
        const fullPath = join(this.basePath, path);
        try {
          const docs = await this.processDirectory(fullPath, category);
          allDocs.push(...docs);
        } catch (error) {
          console.error(`Error processing ${fullPath}:`, error);
        }
      }
    }

    return allDocs;
  }
}
