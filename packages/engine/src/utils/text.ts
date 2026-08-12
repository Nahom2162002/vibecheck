export function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

export function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((sum, count) => {
    const p = count / len;
    return sum - p * Math.log2(p);
  }, 0);
}

const PLACEHOLDER_RE =
  /^(x{3,}|\*{3,}|changeme|your[_-]?(api[_-]?)?key|your[_-]?secret|insert[_-]?key|example|placeholder|dummy|fake|todo|fixme|<.*>|\{\{.*\}\}|\$\{.*\})/i;

export function looksLikePlaceholder(value: string): boolean {
  if (PLACEHOLDER_RE.test(value.trim())) return true;
  if (/^(.)\1+$/.test(value)) return true; // repeated single char, e.g. "xxxxxxxx"
  return false;
}
