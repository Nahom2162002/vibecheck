import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Finding } from '../engine/types';
import { listAllFiles, toAbsolute } from '../utils/files';
import { buildSymbolIndex } from './symbol-index';

// Only the checks that already describe themselves as heuristic and can't
// see cross-file context get a second opinion. secrets/sql-injection/
// secrets-history are deterministic pattern/AST matches — re-reviewing
// those mostly adds cost for little signal.
const REVIEWABLE_RULES = new Set(['missing-auth', 'idor', 'rate-limiting', 'client-side-validation', 'cors']);

function ruleFamily(ruleId: string): string {
  return ruleId.split('/')[0];
}

const SNIPPET_CONTEXT_LINES = 15;

function snippetAround(content: string, line: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 1 - SNIPPET_CONTEXT_LINES);
  const end = Math.min(lines.length, line - 1 + SNIPPET_CONTEXT_LINES);
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1}: ${l}`)
    .join('\n');
}

const VerdictSchema = z.object({
  reviews: z.array(
    z.object({
      index: z.number().describe('The finding index from the prompt, echoed back.'),
      verdict: z.enum(['confirmed', 'false_positive', 'uncertain']),
      reasoning: z.string().describe('One or two sentences explaining the verdict.'),
    })
  ),
});

export interface ReviewOptions {
  apiKey?: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are a second-pass reviewer for a static-analysis security scanner. Each finding below was flagged by a local heuristic rule (regex/AST) that can only see one snippet at a time and cannot trace calls across files.

You are also given a "symbol index": a shallow, regex-derived list of function/const/export names found elsewhere in the repo (name, file, line). It is NOT a real call graph — it only tells you a symbol with that name exists somewhere; it does not tell you whether the flagged code actually calls it.

For each finding, decide:
- "confirmed" — the snippet shows the flaw is real.
- "false_positive" — the snippet itself clearly shows a mitigation (e.g. an auth check, an ownership comparison) that the heuristic missed.
- "uncertain" — you cannot tell from the given context, e.g. the symbol index suggests a plausibly-relevant function exists elsewhere but you can't confirm it's actually called on this path.

Be conservative. When in doubt, return "uncertain" rather than guessing "false_positive" — a missed real vulnerability is worse than an extra flagged finding.`;

export async function reviewFindings(
  repoPath: string,
  findings: Finding[],
  opts: ReviewOptions = {}
): Promise<Finding[]> {
  const reviewable = findings
    .map((finding, index) => ({ finding, index }))
    .filter(({ finding }) => REVIEWABLE_RULES.has(ruleFamily(finding.ruleId)));

  if (reviewable.length === 0) return findings;

  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? 'claude-opus-5';

  const files = await listAllFiles(repoPath);
  const symbolIndex = buildSymbolIndex(repoPath, files);
  const symbolIndexText =
    symbolIndex.length > 0
      ? symbolIndex.map((s) => `${s.name} — ${s.file}:${s.line}`).join('\n')
      : '(none found)';

  const findingsText = reviewable
    .map(({ finding, index }) => {
      let snippet: string;
      try {
        snippet = snippetAround(fs.readFileSync(toAbsolute(repoPath, finding.file), 'utf8'), finding.line);
      } catch {
        snippet = '(unable to read source)';
      }
      return [
        `--- Finding ${index} ---`,
        `Rule: ${finding.ruleId}`,
        `Location: ${finding.file}:${finding.line}`,
        `Description: ${finding.description}`,
        `Code:\n${snippet}`,
      ].join('\n');
    })
    .join('\n\n');

  const userContent = [
    `## Symbol index (repo-wide, shallow)\n${symbolIndexText}`,
    `## Findings to review\n${findingsText}`,
  ].join('\n\n');

  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    output_config: { format: zodOutputFormat(VerdictSchema) },
  });

  const verdicts = response.parsed_output?.reviews ?? [];
  const verdictByIndex = new Map(verdicts.map((v) => [v.index, v]));

  return findings.map((finding, index) => {
    const verdict = verdictByIndex.get(index);
    if (!verdict || verdict.verdict === 'confirmed') return finding;

    if (verdict.verdict === 'false_positive') {
      return {
        ...finding,
        severity: 'low' as const,
        description: `[AI second pass: likely false positive — ${verdict.reasoning}] ${finding.description}`,
      };
    }

    return {
      ...finding,
      description: `${finding.description} (AI second pass: uncertain — ${verdict.reasoning})`,
    };
  });
}
