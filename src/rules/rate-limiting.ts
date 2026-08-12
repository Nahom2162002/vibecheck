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
const AUTH_PATH_RE = /(login|signup|register|reset-password|forgot-password|otp|verify|token)/i;
const RATE_LIMIT_NAME_RE = /(rate.?limit|limiter|throttle|slowdown)/i;

function argMentionsRateLimit(arg: t.Node, content: string): boolean {
  if (t.isIdentifier(arg)) return RATE_LIMIT_NAME_RE.test(arg.name);
  if (t.isCallExpression(arg) && arg.start != null && arg.end != null) {
    return RATE_LIMIT_NAME_RE.test(content.slice(arg.callee.start ?? arg.start, arg.callee.end ?? arg.end));
  }
  return false;
}

function hasGlobalRateLimiter(ast: t.File): boolean {
  let found = false;
  traverse(ast, {
    CallExpression(path) {
      if (found) return;
      const { callee } = path.node;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      if (!t.isIdentifier(callee.object) || !ROUTER_OBJECT_RE.test(callee.object.name)) return;
      if (!t.isIdentifier(callee.property) || callee.property.name !== 'use') return;

      for (const arg of path.node.arguments) {
        if (t.isIdentifier(arg) && RATE_LIMIT_NAME_RE.test(arg.name)) {
          found = true;
          return;
        }
        if (t.isCallExpression(arg) && t.isIdentifier(arg.callee) && RATE_LIMIT_NAME_RE.test(arg.callee.name)) {
          found = true;
          return;
        }
      }
    },
  });
  return found;
}

export const rateLimitingRule: RuleModule = {
  id: 'rate-limiting',
  description: 'Flags auth-related Express routes with no rate-limiting middleware in their chain.',
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
        // A rate limiter applied globally (app.use(rateLimiter)) covers every
        // route in the file — don't flag individual routes in that case.
        if (hasGlobalRateLimiter(ast)) continue;

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
            const routePath = t.isStringLiteral(routeArg) ? routeArg.value : '';
            if (!AUTH_PATH_RE.test(routePath)) return;

            const handlerArgs = args.slice(1);
            const hasLocalRateLimiter = handlerArgs.some((arg) => argMentionsRateLimit(arg, content));
            if (hasLocalRateLimiter) return;

            findings.push({
              ruleId: 'rate-limiting/auth-endpoint-unprotected',
              severity: 'medium',
              file,
              line: path.node.loc?.start.line ?? 0,
              description: `${method.toUpperCase()} ${routePath} is an auth-related endpoint with no rate-limiting middleware, leaving it open to brute-force/credential-stuffing.`,
              fix: 'Add a rate limiter (e.g. express-rate-limit) to this route or apply one globally with app.use(...) before your routes.',
            });
          },
        });
      } catch {
        // Best-effort AST walk — a file babel partially parsed shouldn't abort the scan.
      }
    }

    return findings;
  },
};
