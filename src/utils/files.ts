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

const SKIP_FILENAMES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
const SKIP_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot',
  'pdf', 'zip', 'map', 'lock',
]);

export function filterSecretScannableFiles(files: string[]): string[] {
  return files.filter((f) => {
    const name = f.split('/').pop() ?? f;
    if (SKIP_FILENAMES.has(name)) return false;
    const ext = name.split('.').pop() ?? '';
    if (SKIP_EXTENSIONS.has(ext)) return false;
    return true;
  });
}

export function toAbsolute(repoPath: string, relFile: string): string {
  return path.join(repoPath, relFile);
}
