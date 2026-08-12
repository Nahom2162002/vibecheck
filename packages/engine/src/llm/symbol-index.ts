import fs from 'fs';
import { filterCodeFiles, toAbsolute } from '../utils/files';

export interface SymbolRef {
  name: string;
  file: string;
  line: number;
}

const MAX_SYMBOLS = 300;

// Deliberately shallow: a single regex pass over common declaration/export
// shapes, not real symbol resolution. Good enough to tell the LLM "a
// function named requireAuth exists at middleware/auth.js:12" without
// building a real cross-file analyzer.
const DECLARATION_PATTERNS: RegExp[] = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,
  /\bmodule\.exports\.([A-Za-z_$][\w$]*)\s*=/g,
  /\bexports\.([A-Za-z_$][\w$]*)\s*=/g,
  /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/g,
];

function lineAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

export function buildSymbolIndex(repoPath: string, files: string[]): SymbolRef[] {
  const symbols: SymbolRef[] = [];

  for (const file of filterCodeFiles(files)) {
    if (symbols.length >= MAX_SYMBOLS) break;

    let content: string;
    try {
      content = fs.readFileSync(toAbsolute(repoPath, file), 'utf8');
    } catch {
      continue;
    }

    for (const pattern of DECLARATION_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) && symbols.length < MAX_SYMBOLS) {
        symbols.push({ name: match[1], file, line: lineAt(content, match.index) });
      }
    }
  }

  return symbols;
}
