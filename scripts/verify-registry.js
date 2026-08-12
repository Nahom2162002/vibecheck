#!/usr/bin/env node
// Guards against the exact bug that's bitten this repo twice: a rule file
// gets added under src/rules/ but never makes it into ruleRegistry (or a
// merge silently drops rules that were already registered). Unlike a
// duplicate-declaration merge conflict, a short registry compiles fine and
// fails silently — so this counts rule source files and compares against
// what's actually registered, post-build.
const fs = require('fs');
const path = require('path');

const RULES_SRC_DIR = path.join(__dirname, '..', 'src', 'rules');
const RULES_DIST_INDEX = path.join(__dirname, '..', 'dist', 'rules', 'index.js');

const ruleFiles = fs
  .readdirSync(RULES_SRC_DIR)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts');

const { ruleRegistry } = require(RULES_DIST_INDEX);

if (ruleRegistry.length !== ruleFiles.length) {
  console.error(
    `verify-registry: src/rules/ has ${ruleFiles.length} rule file(s) [${ruleFiles.join(
      ', '
    )}] but ruleRegistry only has ${ruleRegistry.length} entr${ruleRegistry.length === 1 ? 'y' : 'ies'} [${ruleRegistry
      .map((r) => r.id)
      .join(', ')}]. A rule is missing from src/rules/index.ts.`
  );
  process.exit(1);
}

console.log(`verify-registry: OK — ${ruleRegistry.length} rules registered (${ruleRegistry.map((r) => r.id).join(', ')}).`);
