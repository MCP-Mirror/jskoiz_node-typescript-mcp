import { SearchResult } from '../types.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { Cache } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export interface BaseSearchArgs {
  query: string;
}

export abstract class BaseDocsService<T extends BaseSearchArgs> {
  protected cache: Cache;
  protected rateLimiter: RateLimiter;
  protected logger: Logger;

  constructor() {
    this.cache = Cache.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.logger = Logger.getInstance();
  }

  protected abstract getServiceName(): string;

  protected getCacheKey(args: T): string {
    return `${this.getServiceName()}:${JSON.stringify(args)}`;
  }

  protected async fetchWithRetry(url: string, retries = 3): Promise<string> {
    await this.rateLimiter.wait();
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DocsReference/1.0;)'
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Fetch error:', {
        url,
        error: error instanceof Error ? error.message : String(error),
        remainingRetries: retries
      });

      if (retries > 0 && axios.isAxiosError(error)) {
        if (!error.response || error.code === 'ECONNABORTED' || error.response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchWithRetry(url, retries - 1);
        }
      }
      throw error;
    }
  }

  protected handleError(error: unknown): never {
    if (error instanceof McpError) throw error;
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Documentation not found: ${error.message}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch documentation: ${error.message}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      'An unexpected error occurred while searching documentation'
    );
  }

  abstract search(args: T): Promise<SearchResult[]>;
}
