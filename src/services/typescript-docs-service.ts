import { promises as fs } from 'fs';
import { join } from 'path';
import { SearchResult, TypeScriptSearchArgs } from '../types.js';
import { BaseDocsService } from './base-docs-service.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { MarkdownProcessor } from './preprocessing/markdown-processor.js';
import { SearchIndexBuilder } from './preprocessing/index-builder.js';

export class TypeScriptDocsService extends BaseDocsService<TypeScriptSearchArgs> {
  private static instance: TypeScriptDocsService;
  private readonly docsPath: string;
  private readonly processor: MarkdownProcessor;
  private readonly indexBuilder: SearchIndexBuilder;
  
  // Map of category names to their directory paths
  private readonly categoryPaths = {
    'handbook': ['handbook-v1', 'handbook-v2'],
    'reference': ['reference'],
    'release-notes': ['release-notes'],
    'declaration-files': ['declaration-files'],
    'javascript': ['javascript']
  };

  private constructor() {
    super();
    this.docsPath = join(process.cwd(), 'ts-docs', 'copy', 'en');
    this.processor = new MarkdownProcessor(this.docsPath);
    this.indexBuilder = new SearchIndexBuilder(this.docsPath);
    
    // Initialize search index
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize TypeScript docs service:', error);
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Try to load existing index
      const loaded = await this.indexBuilder.loadIndex();
      if (!loaded) {
        // Build new index if loading fails
        this.logger.info('Building new search index...');
        const docs = await this.processor.processAllDocs(this.categoryPaths);
        await this.indexBuilder.buildIndex(docs);
        this.logger.info('Search index built successfully');
      } else {
        this.logger.info('Search index loaded successfully');
      }
    } catch (error) {
      this.logger.error('Error initializing search index:', error);
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to initialize TypeScript documentation search'
      );
    }
  }

  static getInstance(): TypeScriptDocsService {
    if (!TypeScriptDocsService.instance) {
      TypeScriptDocsService.instance = new TypeScriptDocsService();
    }
    return TypeScriptDocsService.instance;
  }

  protected getServiceName(): string {
    return 'typescript';
  }


  async search(args: TypeScriptSearchArgs): Promise<SearchResult[]> {
    try {
      // Get cached results if available
      const cacheKey = this.getCacheKey(args);
      const cachedResults = await this.cache.get<SearchResult[]>(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const searchResults = this.indexBuilder.search(args.query, {
        category: args.category
      });

      // Convert to minimal SearchResult format
      const results = searchResults.map(result => {
        const storedFields = this.indexBuilder.getStoredFields(result.id);
        
        if (!storedFields.path) {
          throw new McpError(
            ErrorCode.InternalError,
            'Document path not found in search index'
          );
        }

        return {
          title: storedFields.title || 'Untitled',
          url: `file://${join(this.docsPath, storedFields.path)}`,
          description: result.match, // Already truncated in index-builder
          category: storedFields.category || 'uncategorized',
          score: result.score
        };
      });

      // Cache results
      await this.cache.set(cacheKey, results, {
        memoryOnly: true // Keep in memory only to avoid disk I/O
      });
      
      return results;
    } catch (error) {
      this.logger.error('Search failed:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to search TypeScript documentation'
      );
    }
  }
}
