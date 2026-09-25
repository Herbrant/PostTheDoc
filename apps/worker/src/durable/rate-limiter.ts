/**
 * Exact per-client rate limits: one object per scope and client key, a fixed window kept in its
 * storage. Cloudflare's rate limiting binding turned out never to refuse anything in production.
 */
import { DurableObject } from "cloudflare:workers";

interface Window {
  end: number; // ms since the epoch
  count: number;
}

const WINDOW = "window";

export class RateLimiter extends DurableObject<Env> {
  /**
   * Count one request: false once `limit` were counted in the current window. Refused requests
   * write nothing, so a flood costs storage reads only. The window lives in storage rather than
   * in memory, which is dropped when the idle object hibernates.
   */
  async hit(limit: number, periodSeconds: number): Promise<boolean> {
    const now = Date.now();
    const window = await this.ctx.storage.get<Window>(WINDOW);
    if (window && now < window.end) {
      if (window.count >= limit) return false;
      await this.ctx.storage.put<Window>(WINDOW, { ...window, count: window.count + 1 });
      return true;
    }
    const end = now + periodSeconds * 1000;
    await this.ctx.storage.put<Window>(WINDOW, { end, count: 1 });
    await this.ctx.storage.setAlarm(end);
    return true;
  }

  /** The window is over: leave nothing behind about the client. */
  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
