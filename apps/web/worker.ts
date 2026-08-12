import { Worker, Job } from 'bullmq';
import { cloneRepo, runScan, computeGrade, reviewFindings } from '@vibecheck/engine';
import { getRedis } from './lib/redis';
import { SCAN_QUEUE_NAME, type ScanJobData } from './lib/queue';
import { saveScanResult } from './lib/result-store';
import type { ScanResult } from './lib/types';

const worker = new Worker<ScanJobData>(
  SCAN_QUEUE_NAME,
  async (job: Job<ScanJobData>) => {
    const { repoUrl, llmReview } = job.data;
    await job.updateProgress('cloning');

    const { path: repoPath, cleanup } = await cloneRepo(repoUrl);
    try {
      await job.updateProgress('scanning');
      let findings = await runScan(repoPath);

      const canReview = llmReview && Boolean(process.env.ANTHROPIC_API_KEY);
      if (canReview) {
        await job.updateProgress('reviewing');
        findings = await reviewFindings(repoPath, findings);
      }

      const grade = computeGrade(findings);
      const result: ScanResult = {
        repoUrl,
        findings,
        grade,
        scannedAt: new Date().toISOString(),
        llmReviewRequested: llmReview,
        llmReviewApplied: canReview,
      };
      await saveScanResult(job.id as string, result);
      await job.updateProgress('done');
    } finally {
      cleanup();
    }
  },
  { connection: getRedis().duplicate(), concurrency: 2 }
);

worker.on('completed', (job) => {
  console.log(`[worker] scan ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] scan ${job?.id} failed:`, err);
});

console.log('vibecheck worker listening for scan jobs...');
