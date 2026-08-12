#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { cloneRepo, isRemoteUrl } from './clone';
import { runScan } from './engine/runner';
import { printReport } from './report/terminal';

const program = new Command();

program
  .name('vibecheck')
  .description('Security scanner for AI-generated ("vibe-coded") apps')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a repo (GitHub URL or local path) and print a findings report')
  .argument('[repoUrl]', 'Git URL of the repo to clone and scan')
  .option('--local <path>', 'Scan a local directory instead of cloning a URL')
  .action(async (repoUrl: string | undefined, opts: { local?: string }) => {
    if (!repoUrl && !opts.local) {
      console.error('Provide a repo URL or --local <path>.');
      process.exitCode = 1;
      return;
    }

    if (opts.local) {
      const target = path.resolve(opts.local);
      const findings = await runScan(target);
      printReport(target, findings);
      return;
    }

    const url = repoUrl!;
    if (!isRemoteUrl(url)) {
      console.error(`"${url}" doesn't look like a git URL. Use --local for a filesystem path.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Cloning ${url}...`);
    const { path: repoPath, cleanup } = await cloneRepo(url);
    try {
      const findings = await runScan(repoPath);
      printReport(url, findings);
    } finally {
      cleanup();
    }
  });

program.parseAsync(process.argv);
