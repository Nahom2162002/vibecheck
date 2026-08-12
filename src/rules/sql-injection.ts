import fs from 'fs';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { Finding, RuleModule } from '../engine/types';
import { filterCodeFiles, toAbsolute } from '../utils/files';
import { parseSource } from '../utils/ast';

// @babel/traverse's CJS/ESM interop is inconsistent across bundlers/ts-node,
// so fall back to the raw module export if the default import isn't callable.
const traverse: typeof traverseModule =
  typeof traverseModule === 'function' ? traverseModule : (traverseModule as any).default;

const DB_METHOD_NAMES = new Set(['query', 'raw', 'execute']);
const SQL_KEYWORD_RE = /\b(select|insert|update|delete)\b.*\b(from|into|where|set)\b/is;

function isStringy(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) return true;
  if (t.isBinaryExpression(node) && node.operator === '+') {
    return isStringy(node.left) || isStringy(node.right);
  }
  return false;
}

function isUnsafelyBuilt(node: t.Node): boolean {
  if (t.isTemplateLiteral(node)) return node.expressions.length > 0;
  if (t.isBinaryExpression(node) && node.operator === '+') {
    return isStringy(node.left) || isStringy(node.right);
  }
  return false;
}

export const sqlInjectionRule: RuleModule = {
  id: 'sql-injection',
  description:
    'Flags SQL built via string concatenation or template-literal interpolation instead of parameterized queries.',
  check(repoPath, files) {
    const findings: Finding[] = [];

    for (const file of filterCodeFiles(files)) {
      let content: string;
      try {
        content = fs.readFileSync(toAbsolute(repoPath, file), 'utf8');
      } catch {
        continue;
      }

      const ast = parseSource(content, file);
      if (!ast) continue;

      try {
        traverse(ast, {
          CallExpression(path) {
            const callee = path.node.callee;
            let methodName: string | null = null;
            if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
              methodName = callee.property.name;
            } else if (t.isIdentifier(callee)) {
              methodName = callee.name;
            }
            if (!methodName || !DB_METHOD_NAMES.has(methodName)) return;

            const firstArg = path.node.arguments[0];
            if (!firstArg || firstArg.start == null || firstArg.end == null) return;

            // Cut down on flagging unrelated .query()/.execute() calls (e.g.
            // job queues, HTTP clients) by requiring the argument to look
            // like actual SQL.
            const snippet = content.slice(firstArg.start, firstArg.end);
            if (!SQL_KEYWORD_RE.test(snippet)) return;

            if (isUnsafelyBuilt(firstArg)) {
              findings.push({
                ruleId: 'sql-injection/string-built-query',
                severity: 'critical',
                file,
                line: firstArg.loc?.start.line ?? 0,
                description: `SQL query built via ${
                  t.isTemplateLiteral(firstArg) ? 'template-literal interpolation' : 'string concatenation'
                } instead of a parameterized query.`,
                fix: 'Use a parameterized/prepared query (e.g. db.query("...WHERE id = $1", [id])) instead of interpolating values into the SQL string.',
              });
            }
          },
        });
      } catch {
        // Best-effort AST walk — a file babel partially parsed shouldn't abort the scan.
      }
    }

    return findings;
  },
};
