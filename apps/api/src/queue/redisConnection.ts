import type { ConnectionOptions } from 'bullmq';

export function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : undefined,
    maxRetriesPerRequest: null
  };
}

