import { listAllFiles } from '../utils/files';
import { ruleRegistry } from '../rules';
import type { Finding } from './types';

export async function runScan(repoPath: string): Promise<Finding[]> {
  const files = await listAllFiles(repoPath);
  const findings: Finding[] = [];

  for (const rule of ruleRegistry) {
    try {
      const result = await rule.check(repoPath, files);
      findings.push(...result);
    } catch (err) {
      // A single rule failing shouldn't abort the whole scan.
      console.error(`Rule "${rule.id}" threw:`, err);
    }
  }

  return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(s: Finding['severity']): number {
  return { critical: 3, high: 2, medium: 1, low: 0 }[s];
}
