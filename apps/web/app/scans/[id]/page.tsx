'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Finding {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  description: string;
  fix: string;
}

interface ScanResult {
  repoUrl: string;
  findings: Finding[];
  grade: string;
  scannedAt: string;
  llmReviewRequested: boolean;
  llmReviewApplied: boolean;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export default function ScanReportPage() {
  const params = useParams<{ id: string }>();
  const scanId = params.id;

  const [stage, setStage] = useState<string>('loading');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    async function fetchResult(): Promise<boolean> {
      const res = await fetch(`/api/scans/${scanId}`);
      if (res.ok) {
        const data = (await res.json()) as ScanResult;
        if (!cancelled) {
          setResult(data);
          setStage('done');
        }
        return true;
      }
      return false;
    }

    async function run() {
      if (await fetchResult()) return;
      if (cancelled) return;

      setStage('queued');
      es = new EventSource(`/api/scans/${scanId}/stream`);

      es.addEventListener('progress', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        if (!cancelled) setStage(data.stage);
      });

      es.addEventListener('done', () => {
        es?.close();
        fetchResult();
      });

      es.addEventListener('scan-error', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (!cancelled) setError(data.message ?? 'Scan failed.');
        } catch {
          if (!cancelled) setError('Scan failed.');
        }
        es?.close();
      });
    }

    run();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [scanId]);

  if (error) {
    return (
      <main className="container">
        <p className="error">Error: {error}</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="container">
        <h1>Scanning…</h1>
        <p className="stage">{stageLabel(stage)}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>vibecheck report</h1>
      <p className="repo-url">{result.repoUrl}</p>
      <div className={`grade grade-${result.grade}`}>{result.grade}</div>
      {result.llmReviewRequested && (
        <p className="stage">
          {result.llmReviewApplied
            ? 'AI second-pass review applied to ambiguous findings.'
            : 'AI second-pass review was requested but skipped (no ANTHROPIC_API_KEY configured on the server).'}
        </p>
      )}
      {result.findings.length === 0 ? (
        <p>No findings. Nice.</p>
      ) : (
        SEVERITY_ORDER.map((severity) => {
          const group = result.findings.filter((f) => f.severity === severity);
          if (group.length === 0) return null;
          return (
            <section key={severity} className={`severity-group severity-${severity}`}>
              <h2>
                {severity.toUpperCase()} ({group.length})
              </h2>
              {group.map((f, i) => (
                <div key={i} className="finding">
                  <div className="finding-location">
                    {f.file}:{f.line} <span className="rule-id">[{f.ruleId}]</span>
                  </div>
                  <div className="finding-description">{f.description}</div>
                  <div className="finding-fix">fix: {f.fix}</div>
                </div>
              ))}
            </section>
          );
        })
      )}
    </main>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'queued':
      return 'Queued…';
    case 'cloning':
      return 'Cloning repository…';
    case 'scanning':
      return 'Running checks…';
    case 'reviewing':
      return 'Running AI second-pass review…';
    default:
      return 'Working…';
  }
}
