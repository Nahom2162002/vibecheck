import fs from 'fs';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { Finding, RuleModule } from '../engine/types';
import { filterCodeFiles, toAbsolute } from '../utils/files';
import { parseSource } from '../utils/ast';

const traverse: typeof traverseModule =
  typeof traverseModule === 'function' ? traverseModule : (traverseModule as any).default;

function getProperty(obj: t.ObjectExpression, name: string): t.Node | undefined {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.key;
    const matches =
      (t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name);
    if (matches) return prop.value as t.Node;
  }
  return undefined;
}

function isWildcardOrReflectAnyOrigin(value: t.Node | undefined): boolean {
  if (!value) return false;
  if (t.isStringLiteral(value)) return value.value === '*';
  if (t.isBooleanLiteral(value)) return value.value === true;
  return false;
}

function isCredentialsTrue(value: t.Node | undefined): boolean {
  return !!value && t.isBooleanLiteral(value) && value.value === true;
}

const RAW_ORIGIN_WILDCARD_RE = /Access-Control-Allow-Origin['"]?\s*,\s*['"]\*['"]/i;
const RAW_CREDENTIALS_TRUE_RE = /Access-Control-Allow-Credentials['"]?\s*,\s*['"]?true['"]?/i;

export const corsRule: RuleModule = {
  id: 'cors',
  description: 'Flags CORS configs that combine a wildcard/reflected origin with credentials.',
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
            const { callee } = path.node;
            if (!t.isIdentifier(callee) || callee.name !== 'cors') return;

            const configArg = path.node.arguments[0];
            if (!configArg || !t.isObjectExpression(configArg)) return;

            const origin = getProperty(configArg, 'origin');
            const credentials = getProperty(configArg, 'credentials');
            if (!isWildcardOrReflectAnyOrigin(origin) || !isCredentialsTrue(credentials)) return;

            findings.push({
              ruleId: 'cors/wildcard-origin-with-credentials',
              severity: 'high',
              file,
              line: path.node.loc?.start.line ?? 0,
              description:
                'cors() is configured with a wildcard/reflect-any origin and credentials: true, letting any site make authenticated requests.',
              fix: 'Set origin to an explicit allowlist of trusted origins when credentials: true is needed — never combine a wildcard/reflected origin with credentials.',
            });
          },
        });
      } catch {
        // Best-effort AST walk — a file babel partially parsed shouldn't abort the scan.
      }

      if (RAW_ORIGIN_WILDCARD_RE.test(content) && RAW_CREDENTIALS_TRUE_RE.test(content)) {
        const match = content.match(RAW_ORIGIN_WILDCARD_RE);
        const idx = match?.index ?? 0;
        const line = content.slice(0, idx).split('\n').length;
        findings.push({
          ruleId: 'cors/raw-header-wildcard-with-credentials',
          severity: 'high',
          file,
          line,
          description:
            'Access-Control-Allow-Origin is set to "*" while Access-Control-Allow-Credentials is set to true in the same file.',
          fix: 'Reflect a validated origin from an allowlist instead of "*" when credentials are involved.',
        });
      }
    }

    return findings;
  },
};
