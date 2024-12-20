#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  url: string,
  description: string;
  context?: string;
  category?: string;
}

interface TypeScriptSearchArgs {
  query: string;
  category?: 'handbook' | 'reference' | 'release-notes' | 'declaration-files' | 'javascript';
}

interface NodeDocsSearchArgs {
  query: string;
  version?: string;
}

interface NoResultsResponse {
  message: string;
  suggestion: string;
}

class DocsReferenceServer {
  private server: Server;
  private typescriptBaseUrl = 'https://www.typescriptlang.org/docs/handbook/2';
  private nodeBaseUrl = 'https://nodejs.org/docs/latest/api';

  constructor() {
    this.server = new Server(
      {
        name: 'docs-reference-server',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_typescript_docs',
          description: 'Search TypeScript documentation for specific topics or concepts',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "interfaces", "generics", "type guards")',
              },
              category: {
                type: 'string',
                description: 'Optional category to filter results',
                enum: ['handbook', 'reference', 'release-notes', 'declaration-files', 'javascript'],
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'search_node_docs',
          description: 'Search Node.js documentation for specific modules or concepts',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "fs", "http", "buffer")',
              },
              version: {
                type: 'string',
                description: 'Optional Node.js version (defaults to latest)',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_typescript_docs':
          return await this.handleTypeScriptDocsSearch(request.params.arguments);
        case 'search_node_docs':
          return await this.handleNodeDocsSearch(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleTypeScriptDocsSearch(args: any): Promise<{ content: { type: string; text: string; }[] }> {
    if (!this.isValidTypeScriptSearchArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments. Expected: { query: string, category?: "handbook" | "reference" | "release-notes" | "declaration-files" | "javascript" }'
      );
    }

    try {
      // TypeScript v2 handbook pages
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

      // Search through each page
      for (const page of pages) {
        try {
          const url = `${this.typescriptBaseUrl}/${page}`;
          const response = await axios.get(url);
          const $ = cheerio.load(response.data);
          
          // Search through main content
          $('#handbook-content').find('h1, h2, h3, h4, p, code, pre').each((_, element) => {
            const $element = $(element);
            const text = $element.text().toLowerCase();
            
            if (text.includes(queryLower)) {
              const $section = $element.closest('section');
              const $heading = $section.find('h1, h2, h3').first();
              const title = $heading.text().trim() || $element.closest('article').find('h1').first().text().trim();
              const description = $section.find('p').first().text().trim() || 'No description available';
              const id = $heading.attr('id') || $element.closest('[id]').attr('id') || '';
              
              // Only add if we haven't already added this section
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
          console.error(`Error fetching page ${page}:`, error);
          // Continue with other pages even if one fails
          continue;
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `No results found for "${args.query}" in TypeScript documentation${args.category ? ` (${args.category})` : ''}`,
                suggestion: 'Try a different search term or category'
              } as NoResultsResponse, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      console.error('Error fetching TypeScript documentation:', error);
      throw new McpError(ErrorCode.InternalError, 'Failed to fetch TypeScript documentation');
    }
  }

  private isValidTypeScriptSearchArgs(args: any): args is TypeScriptSearchArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.query === 'string' &&
      args.query.length > 0 &&
      (args.category === undefined ||
        ['handbook', 'reference', 'release-notes', 'declaration-files', 'javascript'].includes(args.category))
    );
  }

  private isValidNodeDocsSearchArgs(args: any): args is NodeDocsSearchArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.query === 'string' &&
      args.query.length > 0 &&
      (args.version === undefined || typeof args.version === 'string')
    );
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

  private async fetchNodeDocs(version: string, query: string): Promise<SearchResult[]> {
    const baseUrl = version === 'latest' 
      ? 'https://nodejs.org/docs/latest/api'
      : `https://nodejs.org/docs/v${version}/api`;

    try {
      // First get the index page to find all module pages
      const indexResponse = await axios.get(`${baseUrl}/index.html`);
      const $index = cheerio.load(indexResponse.data);
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      // Get all module links from the navigation
      const moduleLinks = $index('#column2 a[href]')
        .map((_, el) => $index(el).attr('href'))
        .get()
        .filter(href => href.endsWith('.html'));

      // Search through each module page
      for (const moduleLink of moduleLinks) {
        try {
          const moduleUrl = `${baseUrl}/${moduleLink}`;
          const moduleResponse = await axios.get(moduleUrl);
          const $ = cheerio.load(moduleResponse.data);

          $('#apicontent').find('section, div.api_stability, pre.api_metadata').each((_: number, element) => {
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
          console.error(`Error fetching module ${moduleLink}:`, error);
          // Continue with other modules even if one fails
          continue;
        }
      }

      return results;
    } catch (error) {
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
      throw error;
    }
  }

  private async handleNodeDocsSearch(args: any): Promise<{ content: { type: string; text: string; }[] }> {
    if (!this.isValidNodeDocsSearchArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments. Expected: { query: string, version?: string }'
      );
    }

    const version = this.validateNodeVersion(args.version);
    
    try {
      const results = await this.fetchNodeDocs(version, args.query);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `No results found for "${args.query}" in Node.js ${version} documentation`,
                suggestion: 'Try a different search term or version'
              } as NoResultsResponse, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      console.error('Error searching Node.js documentation:', error);
      throw new McpError(
        ErrorCode.InternalError,
        'An unexpected error occurred while searching Node.js documentation'
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Docs Reference MCP server running on stdio');
  }
}

const server = new DocsReferenceServer();
server.run().catch(console.error);
