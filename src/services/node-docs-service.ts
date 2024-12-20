import * as cheerio from 'cheerio';
import { SearchResult, NodeDocsSearchArgs } from '../types.js';
import { BaseDocsService } from './base-docs-service.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class NodeDocsService extends BaseDocsService<NodeDocsSearchArgs> {
  private static instance: NodeDocsService;

  private constructor() {
    super();
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

  private validateVersion(version?: string): string {
    const validVersion = version || 'latest';
    if (validVersion !== 'latest' && !validVersion.match(/^\d+\.\d+\.\d+$/)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid version format. Must be "latest" or follow semver (e.g., "18.0.0")'
      );
    }
    return validVersion;
  }

  async search(args: NodeDocsSearchArgs): Promise<SearchResult[]> {
    const version = this.validateVersion(args.version);
    const cacheKey = this.getCacheKey({ ...args, version });
    const cachedResults = this.cache.get<SearchResult[]>(cacheKey);
    if (cachedResults) return cachedResults;

    const baseUrl = version === 'latest' 
      ? 'https://nodejs.org/api'
      : `https://nodejs.org/docs/v${version}/api`;

    try {
      this.logger.debug('Fetching Node.js index page', { baseUrl });
      const indexHtml = await this.fetchWithRetry(`${baseUrl}/index.html`);
      const $index = cheerio.load(indexHtml);
      const results: SearchResult[] = [];
      const queryLower = args.query.toLowerCase();

      // Get module links from the navigation
      const moduleLinks = $index('#column2 a[href], nav a[href]')
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

      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}
