import { promises as fs } from 'fs';
import { join } from 'path';
import { SearchResult } from '../types.js';
import { BaseDocsService, BaseSearchArgs } from './base-docs-service.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { MarkdownProcessor } from './preprocessing/markdown-processor.js';
import { SearchIndexBuilder } from './preprocessing/index-builder.js';

// Define Discord.js specific search arguments
export interface DiscordSearchArgs extends BaseSearchArgs {
  query: string;
  category?: 'preparations' | 'creating-your-bot' | 'slash-commands' | 'interactions' | 'message-components' | 'popular-topics' | 'voice' | 'additional-features' | 'improving-dev-environment' | 'miscellaneous';
}

export class DiscordDocsService extends BaseDocsService<DiscordSearchArgs> {
  private static instance: DiscordDocsService;
  private readonly docsPath: string;
  private readonly processor: MarkdownProcessor;
  private readonly indexBuilder: SearchIndexBuilder;
  
  // Map of category names to their directory paths based on Discord.js guide structure
  private readonly categoryPaths = {
    'preparations': ['preparations'],
    'creating-your-bot': ['creating-your-bot'],
    'slash-commands': ['slash-commands'],
    'interactions': ['interactions'],
    'message-components': ['message-components'],
    'popular-topics': ['popular-topics'],
    'voice': ['voice'],
    'additional-features': ['additional-features'],
    'improving-dev-environment': ['improving-dev-environment'],
    'miscellaneous': ['miscellaneous']
  };

  private constructor() {
    super();
    this.docsPath = join(process.cwd(), 'discord-docs', 'guide');
    this.processor = new MarkdownProcessor(this.docsPath);
    this.indexBuilder = new SearchIndexBuilder(this.docsPath);
    
    // Initialize search index
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize Discord.js docs service:', error);
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
        'Failed to initialize Discord.js documentation search'
      );
    }
  }

  static getInstance(): DiscordDocsService {
    if (!DiscordDocsService.instance) {
      DiscordDocsService.instance = new DiscordDocsService();
    }
    return DiscordDocsService.instance;
  }

  protected getServiceName(): string {
    return 'discord';
  }

  async search(args: DiscordSearchArgs): Promise<SearchResult[]> {
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
          description: result.match,
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
        'Failed to search Discord.js documentation'
      );
    }
  }
}
