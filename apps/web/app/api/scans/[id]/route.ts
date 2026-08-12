import { NextRequest, NextResponse } from 'next/server';
import { getScanResult } from '@/lib/result-store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getScanResult(id);

  if (!result) {
    return NextResponse.json(
      { error: 'Not found — the scan may still be running, or its result has expired.' },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
