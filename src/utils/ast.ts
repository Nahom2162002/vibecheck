import { parse } from '@babel/parser';
import type { File } from '@babel/types';

export function parseSource(source: string, file: string): File | null {
  try {
    return parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return null;
  }
}
