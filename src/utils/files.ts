import fg from 'fast-glob';
import path from 'path';

const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
];

const CODE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];

export async function listAllFiles(repoPath: string): Promise<string[]> {
  const entries = await fg(['**/*'], {
    cwd: repoPath,
    dot: true,
    ignore: IGNORE,
    onlyFiles: true,
    absolute: false,
  });
  return entries.map((p) => p.split(path.sep).join('/'));
}

export function filterCodeFiles(files: string[]): string[] {
  return files.filter((f) => CODE_EXTENSIONS.includes(f.split('.').pop() ?? ''));
}

export function toAbsolute(repoPath: string, relFile: string): string {
  return path.join(repoPath, relFile);
}
