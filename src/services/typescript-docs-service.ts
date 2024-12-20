import * as cheerio from 'cheerio';
import { SearchResult, TypeScriptSearchArgs } from '../types.js';
import { BaseDocsService } from './base-docs-service.js';

export class TypeScriptDocsService extends BaseDocsService<TypeScriptSearchArgs> {
  private static instance: TypeScriptDocsService;
  private readonly baseUrl = 'https://www.typescriptlang.org/docs/handbook/2';
  private readonly pages = [
    'objects.html',
    'types-from-types.html',
    'classes.html',
    'generics.html',
    'utility-types.html',
    'functions.html',
    'type-manipulation.html'
  ];

  private constructor() {
    super();
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
    const cacheKey = this.getCacheKey(args);
    const cachedResults = this.cache.get<SearchResult[]>(cacheKey);
    if (cachedResults) return cachedResults;

    const results: SearchResult[] = [];
    const queryLower = args.query.toLowerCase();

    try {
      for (const page of this.pages) {
        try {
          const url = `${this.baseUrl}/${page}`;
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
                  category: args.category || 'handbook-v2'
                });
              }
            }
          });
        } catch (error) {
          this.logger.error(`Error fetching TypeScript page ${page}:`, error);
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
