import { getRedis } from './redis';
import type { ScanResult } from './types';

const RESULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function resultKey(scanId: string): string {
  return `scan:${scanId}:result`;
}

export async function saveScanResult(scanId: string, result: ScanResult): Promise<void> {
  await getRedis().set(resultKey(scanId), JSON.stringify(result), 'EX', RESULT_TTL_SECONDS);
}

export async function getScanResult(scanId: string): Promise<ScanResult | null> {
  const raw = await getRedis().get(resultKey(scanId));
  return raw ? (JSON.parse(raw) as ScanResult) : null;
}
