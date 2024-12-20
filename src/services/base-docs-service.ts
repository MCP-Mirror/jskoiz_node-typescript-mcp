import { SearchResult } from '../types.js';
import { Cache } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface BaseSearchArgs {
  query: string;
}

export abstract class BaseDocsService<T extends BaseSearchArgs> {
  protected cache: Cache;
  protected logger: Logger;

  constructor() {
    this.cache = Cache.getInstance();
    this.logger = Logger.getInstance();
  }

  protected abstract getServiceName(): string;

  protected getCacheKey(args: T): string {
    return `${this.getServiceName()}:${JSON.stringify(args)}`;
  }

  protected handleError(error: unknown): never {
    if (error instanceof McpError) throw error;
    
    throw new McpError(
      ErrorCode.InternalError,
      'An unexpected error occurred while searching documentation'
    );
  }

  abstract search(args: T): Promise<SearchResult[]>;
}
