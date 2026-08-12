import type { Finding } from './types';

const WEIGHT: Record<Finding['severity'], number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

export function computeGrade(findings: Finding[]): string {
  const score = findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0);

  if (score === 0) return 'A';
  if (score <= 3) return 'B';
  if (score <= 8) return 'C';
  if (score <= 15) return 'D';
  return 'F';
}
