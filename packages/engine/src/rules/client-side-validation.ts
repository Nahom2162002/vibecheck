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
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const CLIENT_SIGNAL_RE =
  /<form[\s>]|from\s+['"](react-hook-form|formik|yup|zod)['"]|require\(['"](react-hook-form|formik|yup|zod)['"]\)/i;
const VALIDATION_LIB_RE = /\b(yup|zod|joi|express-validator|celebrate)\b/i;
const MANUAL_GUARD_RE = /if\s*\(\s*!\s*(req\.body|body)\s*\.\s*[A-Za-z_]/;

function srcOf(content: string, node: { start?: number | null; end?: number | null } | undefined): string {
  if (!node || node.start == null || node.end == null) return '';
  return content.slice(node.start, node.end);
}

function hasValidationSignal(text: string): boolean {
  return VALIDATION_LIB_RE.test(text) || MANUAL_GUARD_RE.test(text);
}

function getObjectProperty(obj: t.ObjectExpression, name: string): t.Node | undefined {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.key;
    if ((t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name)) {
      return prop.value as t.Node;
    }
  }
  return undefined;
}

interface ServerRoute {
  path: string;
  method: string;
  hasValidation: boolean;
  line: number;
}

function collectServerRoutes(ast: t.File, content: string): ServerRoute[] {
  const routes: ServerRoute[] = [];
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

      const handlerArgs = args.slice(1);
      if (handlerArgs.length === 0) return;

      const combinedSrc = handlerArgs.map((a) => srcOf(content, a)).join(' ');
      routes.push({
        path: routeArg.value,
        method: method.toUpperCase(),
        hasValidation: hasValidationSignal(combinedSrc),
        line: path.node.loc?.start.line ?? 0,
      });
    },
  });
  return routes;
}

interface ClientCall {
  path: string;
  method: string;
  line: number;
}

function collectClientFetchCalls(ast: t.File): ClientCall[] {
  const calls: ClientCall[] = [];
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      const args = path.node.arguments;

      if (t.isIdentifier(callee) && callee.name === 'fetch') {
        const urlArg = args[0];
        const optsArg = args[1];
        if (t.isStringLiteral(urlArg) && optsArg && t.isObjectExpression(optsArg)) {
          const methodProp = getObjectProperty(optsArg, 'method');
          if (methodProp && t.isStringLiteral(methodProp) && WRITE_METHODS.has(methodProp.value.toUpperCase())) {
            calls.push({
              path: urlArg.value,
              method: methodProp.value.toUpperCase(),
              line: path.node.loc?.start.line ?? 0,
            });
          }
        }
        return;
      }

      if (
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object) &&
        /axios/i.test(callee.object.name) &&
        t.isIdentifier(callee.property)
      ) {
        const method = callee.property.name.toUpperCase();
        const urlArg = args[0];
        if (WRITE_METHODS.has(method) && t.isStringLiteral(urlArg)) {
          calls.push({ path: urlArg.value, method, line: path.node.loc?.start.line ?? 0 });
        }
      }
    },
  });
  return calls;
}

function normalizePathSegments(p: string): string[] {
  return p
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') || (seg.startsWith('[') && seg.endsWith(']')) ? '*' : seg.toLowerCase()));
}

function pathsMatch(a: string, b: string): boolean {
  const na = normalizePathSegments(a);
  const nb = normalizePathSegments(b);
  if (na.length !== nb.length) return false;
  return na.every((seg, i) => seg === '*' || nb[i] === '*' || seg === nb[i]);
}

export const clientSideValidationRule: RuleModule = {
  id: 'client-side-validation',
  description:
    'Best-effort: flags forms that submit to a server handler with no visible server-side validation. Only fires when a matching handler is actually found in the repo.',
  check(repoPath, files) {
    const findings: Finding[] = [];
    const codeFiles = filterCodeFiles(files);
    const parsed = new Map<string, { ast: t.File; content: string }>();

    for (const file of codeFiles) {
      let content: string;
      try {
        content = fs.readFileSync(toAbsolute(repoPath, file), 'utf8');
      } catch {
        continue;
      }
      const ast = parseSource(content, file);
      if (!ast) continue;
      parsed.set(file, { ast, content });
    }

    const allRoutes: (ServerRoute & { file: string })[] = [];
    for (const [file, { ast, content }] of parsed) {
      try {
        for (const route of collectServerRoutes(ast, content)) {
          allRoutes.push({ file, ...route });
        }
      } catch {
        // Best-effort AST walk — skip files babel couldn't fully traverse.
      }
    }

    for (const [file, { ast, content }] of parsed) {
      if (!/\.[jt]sx$/.test(file)) continue; // React component files only
      if (!CLIENT_SIGNAL_RE.test(content)) continue;

      let calls: ClientCall[];
      try {
        calls = collectClientFetchCalls(ast);
      } catch {
        continue;
      }

      for (const call of calls) {
        // Only flag when a matching server handler was actually found —
        // absence of evidence isn't evidence of the bug.
        const match = allRoutes.find((r) => r.method === call.method && pathsMatch(r.path, call.path));
        if (!match || match.hasValidation) continue;

        findings.push({
          ruleId: 'client-side-validation/no-matching-server-validation',
          severity: 'medium',
          file,
          line: call.line,
          description: `Submits to ${call.method} ${call.path}, handled by ${match.file}:${match.line}, which has no visible server-side validation — client-side validation alone can be bypassed.`,
          fix: 'Validate the request body on the server too (e.g. zod/yup/joi/express-validator) — never rely on client-side validation as the only check.',
        });
      }
    }

    return findings;
  },
};
