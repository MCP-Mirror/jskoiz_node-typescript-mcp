#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { DocsServiceRegistry } from './services/docs-service-registry.js';
import { Logger } from './utils/logger.js';
import { NoResultsResponse, McpToolResponse, TypeScriptSearchArgs, NodeDocsSearchArgs } from './types.js';

class DocsReferenceServer {
  private server: Server;
  private serviceRegistry: DocsServiceRegistry;
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
    this.serviceRegistry = DocsServiceRegistry.getInstance();
    
    // Set log level from environment variable if provided
    const logLevel = process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
    if (logLevel) {
      this.logger.setLevel(logLevel);
      this.logger.debug('Log level set from environment', { level: logLevel });
    }

    this.logger.debug('Initializing server...');

    this.server = new Server(
      {
        name: 'docs-reference-server',
        version: '1.0.0', // Using semantic versioning
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.logger.error('Server error:', { error: error.message, stack: error.stack });
    };

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection:', { reason });
      process.exit(1);
    });

    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT signal, shutting down...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
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
                enum: [
                  'handbook',
                  'reference',
                  'release-notes',
                  'declaration-files', 
                  'javascript',
                  'configuration',
                  'project-structure',
                  'tooling',
                  'best-practices'
                ],
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
      const { name, arguments: args } = request.params;
      this.logger.debug('→ Received request', { tool: name, args });

      try {
        let result;
        switch (name) {
          case 'search_typescript_docs':
            this.logger.info(`Searching TypeScript docs for "${(args as any).query}"`);
            result = await this.handleTypeScriptDocsSearch(args);
            const tsResults = JSON.parse(result.content[0].text);
            if ('message' in tsResults) {
              this.logger.warn('No TypeScript docs results found');
            } else {
              this.logger.info(`Found ${tsResults.length} TypeScript docs results`);
            }
            return result;
          case 'search_node_docs':
            this.logger.info(`Searching Node.js docs for "${(args as any).query}"`);
            result = await this.handleNodeDocsSearch(args);
            const nodeResults = JSON.parse(result.content[0].text);
            if ('message' in nodeResults) {
              this.logger.warn('No Node.js docs results found');
            } else {
              this.logger.info(`Found ${nodeResults.length} Node.js docs results`);
            }
            return result;
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        this.logger.error('Error handling tool request:', { 
          tool: request.params.name,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  private async handleTypeScriptDocsSearch(args: unknown): Promise<McpToolResponse> {
    if (!this.isValidTypeScriptSearchArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for TypeScript docs search',
        {
          expected: '{ query: string, category?: string }',
          received: JSON.stringify(args),
          validCategories: ['handbook', 'reference', 'release-notes', 'declaration-files', 'javascript', 'configuration', 'project-structure', 'tooling', 'best-practices']
        }
      );
    }

    const results = await this.serviceRegistry.getService<TypeScriptSearchArgs>('typescript').search(args);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: `No results found for "${args.query}" in TypeScript documentation${args.category ? ` (${args.category})` : ''}`,
              suggestion: 'Try a different search term or category',
              context: {
                searchTerm: args.query,
                category: args.category || 'all',
                timestamp: new Date().toISOString()
              }
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
  }

  private async handleNodeDocsSearch(args: unknown): Promise<McpToolResponse> {
    if (!this.isValidNodeDocsSearchArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for Node.js docs search',
        {
          expected: '{ query: string, version?: string }',
          received: JSON.stringify(args),
          note: 'Version defaults to latest if not specified'
        }
      );
    }

    const results = await this.serviceRegistry.getService<NodeDocsSearchArgs>('node').search(args);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: `No results found for "${args.query}" in Node.js ${args.version || 'latest'} documentation`,
              suggestion: 'Try a different search term or version',
              context: {
                searchTerm: args.query,
                version: args.version || 'latest',
                timestamp: new Date().toISOString()
              }
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
  }

  private isValidTypeScriptSearchArgs(args: unknown): args is TypeScriptSearchArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof (args as TypeScriptSearchArgs).query === 'string' &&
      (args as TypeScriptSearchArgs).query.length > 0 &&
      ((args as TypeScriptSearchArgs).category === undefined ||
        ['handbook', 'reference', 'release-notes', 'declaration-files', 'javascript', 'configuration', 'project-structure', 'tooling', 'best-practices'].includes(
          (args as TypeScriptSearchArgs).category!
        ))
    );
  }

  private isValidNodeDocsSearchArgs(args: unknown): args is NodeDocsSearchArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof (args as NodeDocsSearchArgs).query === 'string' &&
      (args as NodeDocsSearchArgs).query.length > 0 &&
      ((args as NodeDocsSearchArgs).version === undefined ||
        typeof (args as NodeDocsSearchArgs).version === 'string')
    );
  }

  async run(): Promise<void> {
    this.logger.debug('Starting server...');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('✓ Docs Reference server ready');
  }
}

const server = new DocsReferenceServer();
server.run().catch((error) => {
  const logger = Logger.getInstance();
  logger.error('Fatal error:', { error: error.message, stack: error.stack });
  process.exit(1);
});
