import type { Finding } from '@vibecheck/engine';

export type ScanStage = 'queued' | 'cloning' | 'scanning' | 'done' | 'error';

export interface ScanResult {
  repoUrl: string;
  findings: Finding[];
  grade: string;
  scannedAt: string;
}
