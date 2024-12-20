import { promises as fs } from 'fs';
import { join } from 'path';
import { SearchResult, NodeDocsSearchArgs } from '../types.js';
import { BaseDocsService } from './base-docs-service.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { MarkdownProcessor } from './preprocessing/markdown-processor.js';
import { SearchIndexBuilder } from './preprocessing/index-builder.js';

export class NodeDocsService extends BaseDocsService<NodeDocsSearchArgs> {
  private static instance: NodeDocsService;
  private readonly docsPath: string;
  private readonly processor: MarkdownProcessor;
  private readonly indexBuilder: SearchIndexBuilder;

  // Map of category names to their directory paths
  private readonly categoryPaths = {
    'core': ['.'],  // All Node.js docs are in the root directory
  };

  private constructor() {
    super();
    this.docsPath = join('/Users/jk/Desktop/Cline/MCP', 'node-docs', 'copy');
    this.processor = new MarkdownProcessor(this.docsPath);
    this.indexBuilder = new SearchIndexBuilder(this.docsPath);
    
    // Initialize search index
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize Node.js docs service:', error);
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
        'Failed to initialize Node.js documentation search'
      );
    }
  }

  static getInstance(): NodeDocsService {
    if (!NodeDocsService.instance) {
      NodeDocsService.instance = new NodeDocsService();
    }
    return NodeDocsService.instance;
  }

  protected getServiceName(): string {
    return 'node';
  }

  async search(args: NodeDocsSearchArgs): Promise<SearchResult[]> {
    try {
      // Get cached results if available
      const cacheKey = this.getCacheKey(args);
      const cachedResults = await this.cache.get<SearchResult[]>(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const searchResults = this.indexBuilder.search(args.query);

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
          category: storedFields.category || 'core',
          score: result.score
        };
      });

      // Cache results
      await this.cache.set(cacheKey, results, {
        memoryOnly: true // Keep in memory only to avoid disk I/O
      });
      
      return results;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}
