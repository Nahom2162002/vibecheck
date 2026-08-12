import fs from 'fs';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { Finding, RuleModule } from '../engine/types';
import { filterCodeFiles, toAbsolute } from '../utils/files';
import { parseSource } from '../utils/ast';

const traverse: typeof traverseModule =
  typeof traverseModule === 'function' ? traverseModule : (traverseModule as any).default;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const ROUTER_OBJECT_RE = /^(app|router|server|api)$/i;
const NEXT_HTTP_EXPORT_RE = /^(GET|POST|PUT|PATCH|DELETE)$/;

// Covers ORM-shaped calls (findById, findOne, findByPk, ...) as well as the
// custom repository-style method names ("getOrder", "getUserById", ...)
// that hand-rolled/AI-generated data layers tend to use instead.
const DB_LOOKUP_RE = /\.(find|get)[A-Za-z]*\s*\(|\.query\s*\(/i;
const OWNERSHIP_SIGNAL_RE =
  /req\.(user|session)\b|(userId|ownerId|owner_id|user_id|createdBy|created_by)\s*[!=]==?/i;

function srcOf(content: string, node: { start?: number | null; end?: number | null } | undefined): string {
  if (!node || node.start == null || node.end == null) return '';
  return content.slice(node.start, node.end);
}

function lastSegmentIdParam(routePath: string): string | null {
  const segments = routePath.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;

  let paramName: string | null = null;
  if (last.startsWith(':')) paramName = last.slice(1);
  else if (last.startsWith('[') && last.endsWith(']')) paramName = last.slice(1, -1);

  if (paramName && /id$/i.test(paramName)) return paramName;
  return null;
}

function checkExpressRoutes(ast: t.File, content: string, file: string, findings: Finding[]): void {
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      if (!t.isIdentifier(callee.object) || !ROUTER_OBJECT_RE.test(callee.object.name)) return;
      if (!t.isIdentifier(callee.property)) return;

      const method = callee.property.name.toLowerCase();
      if (!HTTP_METHODS.has(method)) return;

      const args = path.node.arguments;
      const routeArg = args[0];
      if (!t.isStringLiteral(routeArg)) return;

      const idParam = lastSegmentIdParam(routeArg.value);
      if (!idParam) return;

      const handlerArgs = args.slice(1);
      if (handlerArgs.length === 0) return;

      const combinedSrc = handlerArgs.map((a) => srcOf(content, a)).join(' ');
      if (!DB_LOOKUP_RE.test(combinedSrc)) return;
      if (OWNERSHIP_SIGNAL_RE.test(combinedSrc)) return;

      findings.push({
        ruleId: 'idor/missing-ownership-check',
        severity: 'high',
        file,
        line: path.node.loc?.start.line ?? 0,
        description: `${method.toUpperCase()} ${routeArg.value} looks up a record by "${idParam}" but never checks it belongs to the requester (no req.user/req.session or owner-id comparison in the handler).`,
        fix: 'After fetching the record, compare its owner field to the authenticated user (e.g. if (record.userId !== req.user.id) return res.status(403).end()) before returning or modifying it.',
      });
    },
  });
}

function checkNextAppRouterHandlers(ast: t.File, content: string, file: string, findings: Finding[]): void {
  if (!/\/route\.(t|j)sx?$/.test(file) && !/^route\.(t|j)sx?$/.test(file)) return;

  const segments = file.split('/').filter((s) => s !== 'route.ts' && s !== 'route.js' && s !== 'route.tsx' && s !== 'route.jsx');
  const lastDir = segments[segments.length - 1] ?? '';
  let idParam: string | null = null;
  if (lastDir.startsWith('[') && lastDir.endsWith(']')) {
    const name = lastDir.slice(1, -1);
    if (/id$/i.test(name)) idParam = name;
  }
  if (!idParam) return;

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (!decl) return;

      let fnName: string | undefined;
      let bodyNode: t.Node | undefined;

      if (t.isFunctionDeclaration(decl) && decl.id) {
        fnName = decl.id.name;
        bodyNode = decl;
      } else if (t.isVariableDeclaration(decl)) {
        for (const d of decl.declarations) {
          if (t.isIdentifier(d.id) && (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))) {
            fnName = d.id.name;
            bodyNode = d.init;
          }
        }
      }

      if (!fnName || !NEXT_HTTP_EXPORT_RE.test(fnName) || !bodyNode) return;

      const bodySrc = srcOf(content, bodyNode);
      if (!DB_LOOKUP_RE.test(bodySrc)) return;
      if (OWNERSHIP_SIGNAL_RE.test(bodySrc)) return;

      findings.push({
        ruleId: 'idor/missing-ownership-check',
        severity: 'high',
        file,
        line: bodyNode.loc?.start.line ?? 0,
        description: `Route handler "${fnName}" looks up a record by "${idParam}" but never checks it belongs to the requester.`,
        fix: 'After fetching the record, compare its owner field to the authenticated session user before returning or modifying it.',
      });
    },
  });
}

export const idorRule: RuleModule = {
  id: 'idor',
  description:
    'Flags routes that fetch a record by an id-shaped param but never verify it belongs to the requester.',
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
        checkExpressRoutes(ast, content, file, findings);
        checkNextAppRouterHandlers(ast, content, file, findings);
      } catch {
        // Best-effort AST walk — a file babel partially parsed shouldn't abort the scan.
      }
    }

    return findings;
  },
};
