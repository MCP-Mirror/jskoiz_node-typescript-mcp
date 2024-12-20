import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const Colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

export class Logger {
  private static instance: Logger;
  private readonly logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  private currentLevel: LogLevel = 'info';
  private readonly logFile: string;

  private constructor() {
    // Use environment variable for log file path or fall back to default
    this.logFile = process.env.MCP_LOG_FILE || join(process.cwd(), 'mcp-server.log');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.currentLevel];
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return Colors.blue;
      case 'info': return Colors.green;
      case 'warn': return Colors.yellow;
      case 'error': return Colors.red;
    }
  }

  private formatTime(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  private formatMeta(meta?: any): string {
    if (!meta) return '';
    
    // For errors, only show message unless it's a real Error object with stack
    if (meta.error) {
      if (meta.error instanceof Error || meta.stack) {
        return ` ${meta.error}\n${Colors.dim}${meta.stack}${Colors.reset}`;
      }
      // For JSON parsing errors, just show a brief message
      if (meta.error.includes('JSON')) {
        return ` Invalid JSON input`;
      }
      return ` ${meta.error}`;
    }

    // For normal meta objects, format compactly
    const formatted = JSON.stringify(meta)
      .replace(/"([^"]+)":/g, '$1:') // Remove quotes around keys
      .replace(/[{}"]/g, '')         // Remove braces and quotes
      .trim();
    return formatted ? ` ${formatted}` : '';
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const color = this.getColor(level);
    const time = this.formatTime();
    return `${Colors.dim}${time}${Colors.reset} ${color}${level.padEnd(5)}${Colors.reset} ${message}${this.formatMeta(meta)}`;
  }

  private formatFileMessage(level: LogLevel, message: string, meta?: any): string {
    const time = new Date().toISOString();
    return `[${time}] ${level.toUpperCase()} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`;
  }

  private log(message: string, fileMessage: string): void {
    // Console output with [MCP-LOG] prefix for grep
    console.error(`[MCP-LOG] ${message}`);
    
    // Append to log file
    try {
      appendFileSync(this.logFile, fileMessage);
    } catch (error) {
      console.error(`[MCP-LOG] Error writing to log file: ${error}`);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      const consoleMessage = this.formatMessage('debug', message, meta);
      const fileMessage = this.formatFileMessage('debug', message, meta);
      this.log(consoleMessage, fileMessage);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      const consoleMessage = this.formatMessage('info', message, meta);
      const fileMessage = this.formatFileMessage('info', message, meta);
      this.log(consoleMessage, fileMessage);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      const consoleMessage = this.formatMessage('warn', message, meta);
      const fileMessage = this.formatFileMessage('warn', message, meta);
      this.log(consoleMessage, fileMessage);
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      const consoleMessage = this.formatMessage('error', message, meta);
      const fileMessage = this.formatFileMessage('error', message, meta);
      this.log(consoleMessage, fileMessage);
    }
  }
}
