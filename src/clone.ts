import simpleGit from 'simple-git';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function isRemoteUrl(target: string): boolean {
  return /^(https?:\/\/|git@)/.test(target);
}

/**
 * Shallow-clones a repo to a fresh temp directory. Callers must invoke the
 * returned cleanup() when done. The clone is never executed or installed —
 * only read for static analysis.
 */
export async function cloneRepo(url: string): Promise<{ path: string; cleanup: () => void }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecheck-'));
  const git = simpleGit();
  await git.clone(url, dir, ['--depth', '1']);
  return {
    path: dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
