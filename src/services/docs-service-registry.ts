import { BaseDocsService, BaseSearchArgs } from './base-docs-service.js';
import { TypeScriptDocsService } from './typescript-docs-service.js';
import { NodeDocsService } from './node-docs-service.js';
import { DiscordDocsService } from './discord-docs-service.js';
import { Logger } from '../utils/logger.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class DocsServiceRegistry {
  private static instance: DocsServiceRegistry;
  private services: Map<string, BaseDocsService<any>>;
  private logger: Logger;

  private constructor() {
    this.services = new Map();
    this.logger = Logger.getInstance();
    this.registerDefaultServices();
  }

  static getInstance(): DocsServiceRegistry {
    if (!DocsServiceRegistry.instance) {
      DocsServiceRegistry.instance = new DocsServiceRegistry();
    }
    return DocsServiceRegistry.instance;
  }

  private registerDefaultServices(): void {
    this.register('typescript', TypeScriptDocsService.getInstance());
    this.register('node', NodeDocsService.getInstance());
    this.register('discord', DiscordDocsService.getInstance());
  }

  register(name: string, service: BaseDocsService<BaseSearchArgs>): void {
    this.services.set(name, service);
    this.logger.debug(`Registered documentation service: ${name}`);
  }

  getService<T extends BaseSearchArgs>(name: string): BaseDocsService<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Documentation service not found: ${name}`
      );
    }
    return service as BaseDocsService<T>;
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }
}
