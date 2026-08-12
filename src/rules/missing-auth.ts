import fs from 'fs';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { Finding, RuleModule } from '../engine/types';
import { filterCodeFiles, toAbsolute } from '../utils/files';
import { parseSource } from '../utils/ast';

const traverse: typeof traverseModule =
  typeof traverseModule === 'function' ? traverseModule : (traverseModule as any).default;

const AUTH_NAME_RE =
  /(requireAuth|isAuthenticated|verifyToken|verifyJwt|checkAuth|ensureAuth|authMiddleware|authenticate|passport|getServerSession|getSession|withAuth|protectRoute|jwtCheck|decodeToken|auth\()/i;

const PUBLIC_PATH_RE =
  /(login|signup|register|logout|health|status|public|webhook|callback|forgot-password|reset-password)/i;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const ROUTER_OBJECT_RE = /^(app|router|server|api)$/i;
const NEXT_HTTP_EXPORT_RE = /^(GET|POST|PUT|PATCH|DELETE)$/;

function srcOf(content: string, node: { start?: number | null; end?: number | null }): string {
  if (node.start == null || node.end == null) return '';
  return content.slice(node.start, node.end);
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
      const routePath = t.isStringLiteral(routeArg) ? routeArg.value : '<dynamic path>';
      if (PUBLIC_PATH_RE.test(routePath)) return;

      const handlerArgs = args.slice(1);
      if (handlerArgs.length === 0) return;

      const hasNamedAuthMiddleware = handlerArgs.some((arg) => {
        if (t.isIdentifier(arg)) return AUTH_NAME_RE.test(arg.name);
        if (t.isCallExpression(arg)) return AUTH_NAME_RE.test(srcOf(content, arg.callee));
        return false;
      });
      if (hasNamedAuthMiddleware) return;

      const lastArg = handlerArgs[handlerArgs.length - 1];
      if (AUTH_NAME_RE.test(srcOf(content, lastArg))) return;

      findings.push({
        ruleId: 'missing-auth/express-route',
        severity: 'high',
        file,
        line: path.node.loc?.start.line ?? 0,
        description: `${method.toUpperCase()} ${routePath} has no auth check in its middleware chain or handler body.`,
        fix: 'Add an auth middleware (e.g. requireAuth) before the handler, or verify the session/JWT at the top of the handler before touching data.',
      });
    },
  });
}

function checkNextAppRouterHandlers(ast: t.File, content: string, file: string, findings: Finding[]): void {
  if (!/\/route\.(t|j)sx?$/.test(file) && !/^route\.(t|j)sx?$/.test(file)) return;
  if (!/(^|\/)api(\/|$)/.test(file)) return;

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
      if (PUBLIC_PATH_RE.test(file)) return;
      if (AUTH_NAME_RE.test(srcOf(content, bodyNode))) return;

      findings.push({
        ruleId: 'missing-auth/nextjs-route-handler',
        severity: 'high',
        file,
        line: bodyNode.loc?.start.line ?? 0,
        description: `Next.js route handler "${fnName}" has no auth check before accessing data.`,
        fix: 'Call getServerSession()/auth() (or your auth helper) at the top of the handler and return 401 before touching data if there is no valid session.',
      });
    },
  });
}

function checkNextPagesApiHandler(ast: t.File, content: string, file: string, findings: Finding[]): void {
  if (!/(^|\/)pages\/api\//.test(file)) return;

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      const bodyNode: t.Node | undefined =
        t.isFunctionDeclaration(decl) || t.isArrowFunctionExpression(decl) || t.isFunctionExpression(decl)
          ? decl
          : undefined;
      if (!bodyNode) return;
      if (PUBLIC_PATH_RE.test(file)) return;
      if (AUTH_NAME_RE.test(srcOf(content, bodyNode))) return;

      findings.push({
        ruleId: 'missing-auth/nextjs-pages-api',
        severity: 'high',
        file,
        line: bodyNode.loc?.start.line ?? 0,
        description: 'Next.js pages/api handler has no auth check before accessing data.',
        fix: 'Verify the session/JWT (e.g. getServerSession(req, res, ...)) at the top of the handler and return 401 before touching data if unauthenticated.',
      });
    },
  });
}

export const missingAuthRule: RuleModule = {
  id: 'missing-auth',
  description:
    'Flags Express/Next.js route handlers that have no auth middleware or auth check reachable in the handler.',
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
        checkNextPagesApiHandler(ast, content, file, findings);
      } catch {
        // Best-effort AST walk — a file babel partially parsed shouldn't abort the scan.
      }
    }

    return findings;
  },
};
