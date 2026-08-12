#!/usr/bin/env node
// Builds a throwaway local git repo at fixtures/vulnerable-app-history/ with
// a secret committed in one commit and removed in the next, so vibecheck's
// secrets-history rule has real history to scan. This directory is entirely
// untracked (see .gitignore) rather than committed as a nested repo, both
// because git can't track a nested .git as plain file content in an outer
// repo, and so no provider-shaped secret needs to touch the outer repo's
// own history. The secret value is still split across literals as a matter
// of habit/safety, same as fixtures/generate.js.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_DIR = path.join(__dirname, 'vulnerable-app-history');
const awsAccessKeyId = 'AKI' + 'AQWERTYUIOPASDFGH';

function run(cmd) {
  execSync(cmd, { cwd: REPO_DIR, stdio: 'ignore' });
}

fs.rmSync(REPO_DIR, { recursive: true, force: true });
fs.mkdirSync(REPO_DIR, { recursive: true });

run('git init -q');
run('git config user.email "fixture@vibecheck.local"');
run('git config user.name "vibecheck fixture"');

fs.writeFileSync(
  path.join(REPO_DIR, 'config.js'),
  `module.exports = { awsAccessKeyId: '${awsAccessKeyId}' };\n`
);
run('git add config.js');
run('git commit -q -m "add aws config"');

fs.writeFileSync(
  path.join(REPO_DIR, 'config.js'),
  `module.exports = { awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID };\n`
);
run('git add config.js');
run('git commit -q -m "remove hardcoded key, use env var instead"');

console.log('Generated fixtures/vulnerable-app-history/ (secret in history, gone from HEAD)');
