import { promises as fs } from 'fs';
import { join } from 'path';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tokens?: number; // Track token count for efficient API usage
}

interface CacheConfig {
  maxMemoryEntries: number;
  maxDiskSize: number; // in bytes
  memoryCacheDuration: number; // in ms
  diskCacheDuration: number; // in ms
}

export class Cache {
  private static instance: Cache;
  private memoryCache: Map<string, CacheEntry<any>>;
  private diskCachePath: string;
  private config: CacheConfig;

  private constructor() {
    this.memoryCache = new Map();
    this.diskCachePath = join(process.cwd(), 'cache');
    this.config = {
      maxMemoryEntries: 1000,
      maxDiskSize: 100 * 1024 * 1024, // 100MB
      memoryCacheDuration: 1000 * 60 * 60, // 1 hour
      diskCacheDuration: 1000 * 60 * 60 * 24 // 24 hours
    };
    this.initDiskCache().catch(console.error);
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  private async initDiskCache(): Promise<void> {
    try {
      await fs.mkdir(this.diskCachePath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize disk cache:', error);
    }
  }

  private getDiskPath(key: string): string {
    return join(this.diskCachePath, `${Buffer.from(key).toString('base64')}.json`);
  }

  async get<T>(key: string, options: { skipDisk?: boolean } = {}): Promise<T | null> {
    // Try memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached) {
      if (Date.now() - memCached.timestamp > this.config.memoryCacheDuration) {
        this.memoryCache.delete(key);
      } else {
        return memCached.data as T;
      }
    }

    if (options.skipDisk) return null;

    // Try disk cache
    try {
      const diskPath = this.getDiskPath(key);
      const diskData = await fs.readFile(diskPath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(diskData);

      if (Date.now() - entry.timestamp > this.config.diskCacheDuration) {
        await fs.unlink(diskPath);
        return null;
      }

      // Promote to memory cache
      this.setMemoryCache(key, entry.data, entry.tokens);
      return entry.data;
    } catch {
      return null;
    }
  }

  private setMemoryCache<T>(key: string, data: T, tokens?: number): void {
    // Evict oldest entries if at capacity
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      const oldestKey = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      tokens
    });
  }

  async set<T>(key: string, data: T, options: { tokens?: number; memoryOnly?: boolean } = {}): Promise<void> {
    this.setMemoryCache(key, data, options.tokens);

    if (!options.memoryOnly) {
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          tokens: options.tokens
        };

        const diskPath = this.getDiskPath(key);
        await fs.writeFile(diskPath, JSON.stringify(entry));

        // Cleanup old disk cache entries if needed
        this.cleanupDiskCache().catch(console.error);
      } catch (error) {
        console.error('Failed to write to disk cache:', error);
      }
    }
  }

  private async cleanupDiskCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.diskCachePath);
      let totalSize = 0;

      // Get file stats and sort by age
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const path = join(this.diskCachePath, file);
          const stats = await fs.stat(path);
          return { path, stats };
        })
      );

      fileStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      // Remove old files if total size exceeds limit
      for (const { path, stats } of fileStats) {
        totalSize += stats.size;
        if (totalSize > this.config.maxDiskSize) {
          await fs.unlink(path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup disk cache:', error);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await fs.rm(this.diskCachePath, { recursive: true, force: true });
      await this.initDiskCache();
    } catch (error) {
      console.error('Failed to clear disk cache:', error);
    }
  }
}
