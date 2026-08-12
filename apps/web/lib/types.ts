import type { Finding } from '@vibecheck/engine';

export type ScanStage = 'queued' | 'cloning' | 'scanning' | 'reviewing' | 'done' | 'error';

export interface ScanResult {
  repoUrl: string;
  findings: Finding[];
  grade: string;
  scannedAt: string;
  llmReviewRequested: boolean;
  llmReviewApplied: boolean;
}
