import fs from 'fs';
import type { Finding, RuleModule } from '../engine/types';
import { filterSecretScannableFiles, toAbsolute } from '../utils/files';
import { lineNumberAt, shannonEntropy, looksLikePlaceholder } from '../utils/text';

export interface KnownPattern {
  id: string;
  regex: RegExp;
  severity: Finding['severity'];
  description: string;
  fix: string;
}

export const KNOWN_PATTERNS: KnownPattern[] = [
  {
    id: 'secrets/aws-access-key-id',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'critical',
    description: 'Hardcoded AWS access key ID.',
    fix: 'Revoke this key in IAM, then load credentials from environment variables or a secrets manager (never commit them).',
  },
  {
    id: 'secrets/stripe-live-key',
    regex: /\bsk_live_[0-9a-zA-Z]{16,}\b/g,
    severity: 'critical',
    description: 'Hardcoded Stripe live secret key.',
    fix: 'Roll this key in the Stripe dashboard immediately and load it from an environment variable.',
  },
  {
    id: 'secrets/stripe-test-key',
    regex: /\bsk_test_[0-9a-zA-Z]{16,}\b/g,
    severity: 'medium',
    description: 'Hardcoded Stripe test secret key.',
    fix: 'Move test keys to environment variables too — they still leak account/config details and are easy to mistake for live keys.',
  },
  {
    id: 'secrets/github-token',
    regex: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/g,
    severity: 'critical',
    description: 'Hardcoded GitHub personal access / OAuth token.',
    fix: 'Revoke the token on GitHub, then use a secrets manager or CI-provided environment variable.',
  },
  {
    id: 'secrets/slack-token',
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    severity: 'high',
    description: 'Hardcoded Slack token.',
    fix: 'Revoke the token in Slack app settings and load it from an environment variable.',
  },
  {
    id: 'secrets/private-key-block',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'Private key material committed to the repo.',
    fix: 'Remove the key file, rotate the key pair, and load private keys from a secrets manager or mounted secret at deploy time.',
  },
];

// name = key/secret/token/password assigned to a quoted string literal.
const GENERIC_ASSIGNMENT_RE =
  /\b[A-Za-z_][A-Za-z0-9_]{0,40}(api[_-]?key|secret|token|password|passwd|pwd)[A-Za-z0-9_]{0,10}\s*[:=]\s*['"]([^'"\n]{6,100})['"]/gi;

function scanKnownPatterns(content: string, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const pattern of KNOWN_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content))) {
      findings.push({
        ruleId: pattern.id,
        severity: pattern.severity,
        file,
        line: lineNumberAt(content, match.index),
        description: pattern.description,
        fix: pattern.fix,
      });
    }
  }
  return findings;
}

function scanGenericAssignments(content: string, file: string): Finding[] {
  const findings: Finding[] = [];
  GENERIC_ASSIGNMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GENERIC_ASSIGNMENT_RE.exec(content))) {
    const value = match[2];
    if (looksLikePlaceholder(value)) continue;
    if (/^process\.env\./.test(value)) continue;

    const entropy = shannonEntropy(value);
    const looksStructured = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
    if (entropy < 3.0 && !looksStructured) continue;

    findings.push({
      ruleId: 'secrets/generic-credential-assignment',
      severity: entropy >= 4.0 ? 'high' : 'medium',
      file,
      line: lineNumberAt(content, match.index),
      description: `Possible hardcoded credential assigned to "${match[0].split(/[:=]/)[0].trim()}".`,
      fix: 'Move this value to an environment variable (.env, not committed) or a secrets manager.',
    });
  }
  return findings;
}

function scanEnvFile(content: string, file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!value || value.length < 6 || looksLikePlaceholder(value)) return;

    findings.push({
      ruleId: 'secrets/env-file-committed-value',
      severity: shannonEntropy(value) >= 3.5 ? 'high' : 'medium',
      file,
      line: idx + 1,
      description: `.env file with a real-looking value for "${trimmed.slice(0, eq).trim()}" appears to be committed.`,
      fix: 'Add .env to .gitignore, commit only .env.example with placeholder values, and rotate any values already pushed.',
    });
  });
  return findings;
}

export const secretsRule: RuleModule = {
  id: 'secrets',
  description: 'Detects hardcoded API keys/secrets and committed .env values.',
  check(repoPath, files) {
    const findings: Finding[] = [];
    const scannable = filterSecretScannableFiles(files);

    for (const file of scannable) {
      let content: string;
      try {
        content = fs.readFileSync(toAbsolute(repoPath, file), 'utf8');
      } catch {
        continue; // binary or unreadable — skip rather than crash the scan
      }

      findings.push(...scanKnownPatterns(content, file));

      const basename = file.split('/').pop() ?? file;
      if (basename === '.env' || basename.startsWith('.env.')) {
        findings.push(...scanEnvFile(content, file));
      } else {
        findings.push(...scanGenericAssignments(content, file));
      }
    }

    return findings;
  },
};
