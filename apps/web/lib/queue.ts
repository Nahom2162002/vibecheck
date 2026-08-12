import { Queue } from 'bullmq';
import { getRedis } from './redis';

export const SCAN_QUEUE_NAME = 'vibecheck-scan';

export interface ScanJobData {
  repoUrl: string;
}

let queue: Queue<ScanJobData> | undefined;

export function getScanQueue(): Queue<ScanJobData> {
  if (!queue) {
    queue = new Queue<ScanJobData>(SCAN_QUEUE_NAME, { connection: getRedis() });
  }
  return queue;
}
