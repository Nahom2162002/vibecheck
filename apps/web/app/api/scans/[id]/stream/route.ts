import { NextRequest } from 'next/server';
import { QueueEvents } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { getScanQueue, SCAN_QUEUE_NAME } from '@/lib/queue';
import { getScanResult } from '@/lib/result-store';

export const dynamic = 'force-dynamic';

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: scanId } = await params;

  // If the result is already there (client reconnected, or the job finished
  // before this request landed), skip straight to "done" — no need to
  // subscribe to anything.
  const existing = await getScanResult(scanId);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting
        }
      };

      if (existing) {
        send('done', { stage: 'done' });
        finish();
        return;
      }

      const queueEvents = new QueueEvents(SCAN_QUEUE_NAME, { connection: getRedis().duplicate() });
      await queueEvents.waitUntilReady();

      const cleanup = () => {
        queueEvents.close().catch(() => {});
      };

      queueEvents.on('progress', ({ jobId, data }) => {
        if (jobId !== scanId) return;
        send('progress', { stage: data });
      });

      queueEvents.on('completed', ({ jobId }) => {
        if (jobId !== scanId) return;
        send('done', { stage: 'done' });
        cleanup();
        finish();
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        if (jobId !== scanId) return;
        send('scan-error', { stage: 'error', message: failedReason });
        cleanup();
        finish();
      });

      req.signal.addEventListener('abort', () => {
        cleanup();
        finish();
      });

      // Safety net for the race where the job already finished between the
      // getScanResult() check above and the QueueEvents subscription below.
      const job = await getScanQueue().getJob(scanId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          send('done', { stage: 'done' });
          cleanup();
          finish();
          return;
        }
        if (state === 'failed') {
          send('scan-error', { stage: 'error', message: job.failedReason });
          cleanup();
          finish();
          return;
        }
      }

      send('progress', { stage: 'queued' });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
