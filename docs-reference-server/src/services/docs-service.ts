import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { SearchResult, TypeScriptSearchArgs, NodeDocsSearchArgs } from '../types.js';
import { Logger } from '../utils/logger.js';

// Simple in-memory cache with expiration
interface CacheEntry {
  data: SearchResult[];
  timestamp: number;
}

export class DocsService {
  private static instance: DocsService;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  private readonly RATE_LIMIT_WINDOW = 500; // 500ms between requests
  private lastRequestTime = 0;
  private logger: Logger;

  private constructor() {
    this.cache = new Map();
    this.logger = Logger.getInstance();
  }

  static getInstance(): DocsService {
    if (!DocsService.instance) {
      DocsService.instance = new DocsService();
    }
    return DocsService.instance;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_WINDOW) {
      await new Promise(resolve => 
        setTimeout(resolve, this.RATE_LIMIT_WINDOW - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  private getCacheKey(type: string, query: string, options?: string): string {
    return `${type}:${query}:${options || 'default'}`;
  }

  private getCachedResults(cacheKey: string): SearchResult[] | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedResults(cacheKey: string, results: SearchResult[]): void {
    this.cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<string> {
    await this.rateLimit();
    
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
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
        // Only retry on network errors, timeouts, or 5xx server errors
        if (!error.response || error.code === 'ECONNABORTED' || error.response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchWithRetry(url, retries - 1);
        }
      }
      throw error;
    }
  }

  async searchTypeScriptDocs(args: TypeScriptSearchArgs): Promise<SearchResult[]> {
    const cacheKey = this.getCacheKey('typescript', args.query, args.category);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) return cachedResults;

    const baseUrl = 'https://www.typescriptlang.org/docs/handbook/2';
    const pages = [
      'objects.html',
      'types-from-types.html',
      'classes.html',
      'generics.html',
      'utility-types.html',
      'functions.html',
      'type-manipulation.html'
    ];

    const results: SearchResult[] = [];
    const queryLower = args.query.toLowerCase();

    try {
      for (const page of pages) {
        try {
          const url = `${baseUrl}/${page}`;
          const html = await this.fetchWithRetry(url);
          const $ = cheerio.load(html);
          
          $('#handbook-content').find('h1, h2, h3, h4, p, code, pre').each((_, element) => {
            const $element = $(element);
            const text = $element.text().toLowerCase();
            
            if (text.includes(queryLower)) {
              const $section = $element.closest('section');
              const $heading = $section.find('h1, h2, h3').first();
              const title = $heading.text().trim() || 
                           $element.closest('article').find('h1').first().text().trim();
              const description = $section.find('p').first().text().trim() || 
                                'No description available';
              const id = $heading.attr('id') || 
                        $element.closest('[id]').attr('id') || '';
              
              const fullUrl = id ? `${url}#${id}` : url;
              if (title && !results.some(r => r.url === fullUrl)) {
                const matchIndex = text.indexOf(queryLower);
                results.push({
                  title,
                  url: fullUrl,
                  description,
                  context: text.substring(
                    Math.max(0, matchIndex - 50),
                    Math.min(text.length, matchIndex + queryLower.length + 50)
                  ),
                  category: 'handbook-v2'
                });
              }
            }
          });
        } catch (error) {
          this.logger.error(`Error fetching TypeScript page ${page}:`, error);
          continue;
        }
      }

      this.setCachedResults(cacheKey, results);
      return results;
    } catch (error) {
      if (error instanceof McpError) throw error;
      
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to fetch TypeScript documentation'
      );
    }
  }

  async searchNodeDocs(args: NodeDocsSearchArgs): Promise<SearchResult[]> {
    const version = this.validateNodeVersion(args.version);
    const cacheKey = this.getCacheKey('node', args.query, version);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) return cachedResults;

    const baseUrl = version === 'latest' 
      ? 'https://nodejs.org/api'  // Changed URL to be more reliable
      : `https://nodejs.org/docs/v${version}/api`;

    try {
      this.logger.debug('Fetching Node.js index page', { baseUrl });
      const indexHtml = await this.fetchWithRetry(`${baseUrl}/index.html`);
      const $index = cheerio.load(indexHtml);
      const results: SearchResult[] = [];
      const queryLower = args.query.toLowerCase();

      // Get module links from the navigation
      const moduleLinks = $index('#column2 a[href], nav a[href]')  // Added alternative selector
        .map((_, el) => $index(el).attr('href'))
        .get()
        .filter((href): href is string => 
          typeof href === 'string' && href.endsWith('.html')
        );

      this.logger.debug('Found module links', { count: moduleLinks.length });

      for (const moduleLink of moduleLinks) {
        try {
          const moduleUrl = `${baseUrl}/${moduleLink}`;
          this.logger.debug('Fetching module page', { moduleUrl });
          const moduleHtml = await this.fetchWithRetry(moduleUrl);
          const $ = cheerio.load(moduleHtml);

          $('#apicontent, main').find('section, div.api_stability, pre.api_metadata').each((_, element) => {
            const $element = $(element);
            const text = $element.text().toLowerCase();

            if (text.includes(queryLower)) {
              const $section = $element.closest('section');
              const title = $section.find('h2, h3').first().text().trim() || 
                           moduleLink.replace('.html', '').replace('_', ' ');
              const description = $section.find('p').first().text().trim();
              const id = $element.closest('[id]').attr('id');

              if (title) {
                const matchIndex = text.indexOf(queryLower);
                results.push({
                  title,
                  url: id ? `${moduleUrl}#${id}` : moduleUrl,
                  description: description || `Documentation from ${title} module`,
                  context: text.substring(
                    Math.max(0, matchIndex - 50),
                    Math.min(text.length, matchIndex + queryLower.length + 50)
                  ),
                });
              }
            }
          });
        } catch (error) {
          this.logger.error(`Error fetching Node.js module ${moduleLink}:`, error);
          continue;
        }
      }

      this.setCachedResults(cacheKey, results);
      return results;
    } catch (error) {
      if (error instanceof McpError) throw error;
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Node.js documentation not found for version ${version}. Try using "latest" or a different version.`
          );
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to fetch Node.js documentation: ${error.message}`
        );
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        'An unexpected error occurred while searching Node.js documentation'
      );
    }
  }

  private validateNodeVersion(version?: string): string {
    const validVersion = version || 'latest';
    if (validVersion !== 'latest' && !validVersion.match(/^\d+\.\d+\.\d+$/)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid version format. Must be "latest" or follow semver (e.g., "18.0.0")'
      );
    }
    return validVersion;
  }
}
