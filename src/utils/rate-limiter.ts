export class RateLimiter {
  private static instance: RateLimiter;
  private readonly RATE_LIMIT_WINDOW = 500; // 500ms between requests
  private lastRequestTime = 0;

  private constructor() {}

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_WINDOW) {
      await new Promise(resolve => 
        setTimeout(resolve, this.RATE_LIMIT_WINDOW - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }
}
