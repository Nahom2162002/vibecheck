import simpleGit from 'simple-git';
import type { Finding, RuleModule } from '../engine/types';
import { KNOWN_PATTERNS } from './secrets';
import { lineNumberAt } from '../utils/text';

// Keeps the number of `cat-file` calls bounded on large repos — only blobs
// whose path looks like it could plausibly hold a secret are fetched.
const INTERESTING_PATH_RE =
  /(^|\/)\.env(\..*)?$|\.(js|jsx|ts|tsx|json|ya?ml|txt|pem|key|cfg|conf|toml)$/i;

interface BlobRef {
  sha: string;
  path: string;
}

function parseRevListObjects(raw: string): BlobRef[] {
  const refs: BlobRef[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) continue; // no path -> commit object, not a blob
    const sha = line.slice(0, spaceIdx);
    const objPath = line.slice(spaceIdx + 1).trim();
    if (!objPath) continue;
    refs.push({ sha, path: objPath });
  }
  return refs;
}

export const secretsHistoryRule: RuleModule = {
  id: 'secrets-history',
  description:
    'Scans git history (not just the working tree) for committed secrets matching known provider formats.',
  async check(repoPath) {
    const findings: Finding[] = [];
    const git = simpleGit(repoPath);

    let isRepo = false;
    try {
      isRepo = await git.checkIsRepo();
    } catch {
      return findings;
    }
    if (!isRepo) return findings;

    let raw: string;
    try {
      raw = await git.raw(['rev-list', '--objects', '--all']);
    } catch {
      return findings; // e.g. a repo with no commits yet
    }

    const candidates = parseRevListObjects(raw).filter((ref) => INTERESTING_PATH_RE.test(ref.path));

    // Blobs are content-addressed, so rev-list already dedupes identical
    // content across commits — this guard is just belt-and-suspenders.
    const seenShas = new Set<string>();

    for (const ref of candidates) {
      if (seenShas.has(ref.sha)) continue;
      seenShas.add(ref.sha);

      let content: string;
      try {
        content = await git.raw(['cat-file', '-p', ref.sha]);
      } catch {
        continue; // not actually a blob, or unreadable — skip
      }

      for (const pattern of KNOWN_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(content))) {
          findings.push({
            ruleId: `secrets-history/${pattern.id.split('/')[1] ?? pattern.id}`,
            severity: pattern.severity,
            file: ref.path,
            line: lineNumberAt(content, match.index),
            description: `${pattern.description} Found in git history (blob ${ref.sha.slice(
              0,
              8
            )}) — may already be gone from the working tree, but still exposed to anyone who clones the repo.`,
            fix: `${pattern.fix} Removing it from the current tree isn't enough — rewrite history (git filter-repo or BFG) and rotate the credential.`,
          });
        }
      }
    }

    return findings;
  },
};
