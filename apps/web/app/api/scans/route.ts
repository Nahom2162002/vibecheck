import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isRemoteUrl } from '@vibecheck/engine';
import { getScanQueue } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const repoUrl = typeof body?.repoUrl === 'string' ? body.repoUrl.trim() : '';

  if (!repoUrl || !isRemoteUrl(repoUrl)) {
    return NextResponse.json({ error: 'Provide a valid git URL (https:// or git@).' }, { status: 400 });
  }

  const scanId = randomUUID();
  await getScanQueue().add('scan', { repoUrl }, { jobId: scanId });

  return NextResponse.json({ scanId });
}
