import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let client: Redis | undefined;

// A shared connection for plain get/set. BullMQ's Queue/Worker/QueueEvents
// each need their own dedicated connection (they use blocking Redis
// commands internally) — callers needing one should call .duplicate() on
// this rather than share it directly.
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return client;
}
