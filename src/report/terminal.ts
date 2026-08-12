import chalk from 'chalk';
import type { Finding, Severity } from '../engine/types';
import { computeGrade } from '../engine/grade';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red.bold,
  medium: chalk.yellow.bold,
  low: chalk.gray,
};

const GRADE_COLOR: Record<string, (s: string) => string> = {
  A: chalk.green.bold,
  B: chalk.greenBright.bold,
  C: chalk.yellow.bold,
  D: chalk.red.bold,
  F: chalk.bgRed.white.bold,
};

export function printReport(target: string, findings: Finding[]): void {
  console.log('');
  console.log(chalk.bold(`vibecheck report — ${target}`));
  console.log(chalk.dim('─'.repeat(60)));

  if (findings.length === 0) {
    console.log(chalk.green('No findings. Nice.'));
  } else {
    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((f) => f.severity === severity);
      if (group.length === 0) continue;

      console.log('');
      console.log(SEVERITY_COLOR[severity](` ${severity.toUpperCase()} (${group.length}) `));
      for (const f of group) {
        console.log(`  ${chalk.cyan(`${f.file}:${f.line}`)}  ${chalk.dim(`[${f.ruleId}]`)}`);
        console.log(`    ${f.description}`);
        console.log(`    ${chalk.dim('fix:')} ${f.fix}`);
      }
    }
  }

  const grade = computeGrade(findings);
  console.log('');
  console.log(chalk.dim('─'.repeat(60)));
  console.log(`Grade: ${GRADE_COLOR[grade](grade)}  ${chalk.dim(`(${findings.length} finding${findings.length === 1 ? '' : 's'})`)}`);
  console.log('');
}
