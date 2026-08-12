import simpleGit from 'simple-git';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function isRemoteUrl(target: string): boolean {
  return /^(https?:\/\/|git@)/.test(target);
}

/**
 * Full-clones a repo to a fresh temp directory. Callers must invoke the
 * returned cleanup() when done. The clone is never executed or installed —
 * only read for static analysis. Full (non-shallow) history is required by
 * the secrets-history rule, which scans past commits for secrets that were
 * later removed from the working tree — a shallow clone would make that
 * check silently useless. This is a real speed tradeoff on large repos.
 */
export async function cloneRepo(url: string): Promise<{ path: string; cleanup: () => void }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecheck-'));
  const git = simpleGit();
  await git.clone(url, dir);
  return {
    path: dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
