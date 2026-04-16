#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { scanners } from './scanner-registry';
import { buildScanResult } from './scoring';
import { formatReport } from './reporter';
import { ScanConfig, CategoryScore, OutputFormat } from './types';

const VERSION = '1.0.0';

async function runScan(repoPath: string, outputFormat: OutputFormat, outputFile: string | undefined, verbose: boolean): Promise<void> {
  const resolvedPath = path.resolve(repoPath);

  // Validate repo path
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Error: Repository path does not exist: ${resolvedPath}`));
    process.exit(1);
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    console.error(chalk.red(`Error: Path is not a directory: ${resolvedPath}`));
    process.exit(1);
  }

  const config: ScanConfig = {
    repoPath: resolvedPath,
    verbose,
    commitDepth: 200,
  };

  if (outputFormat === 'console') {
    console.log(chalk.dim('\n  PRISM D1 Velocity Scanner v' + VERSION));
    console.log(chalk.dim(`  Scanning: ${resolvedPath}\n`));
  }

  const categories: CategoryScore[] = [];
  const startTime = Date.now();

  for (const scanner of scanners) {
    const scanStart = Date.now();
    try {
      if (verbose && outputFormat === 'console') {
        process.stdout.write(chalk.dim(`  Scanning ${scanner.name}...`));
      }
      const result = await scanner.scan(resolvedPath, config);
      categories.push(result);
      const elapsed = Date.now() - scanStart;
      if (verbose && outputFormat === 'console') {
        console.log(chalk.dim(` ${result.earnedPoints}/${result.maxPoints} (${elapsed}ms)`));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (verbose && outputFormat === 'console') {
        console.log(chalk.red(` ERROR: ${errorMsg}`));
      }
      categories.push({
        category: scanner.name,
        maxPoints: 0,
        earnedPoints: 0,
        evidence: [{
          signal: 'Scanner error',
          found: false,
          points: 0,
          detail: `Scanner failed: ${errorMsg}`,
        }],
      });
    }
  }

  const totalElapsed = Date.now() - startTime;

  if (verbose && outputFormat === 'console') {
    console.log(chalk.dim(`\n  Scan completed in ${totalElapsed}ms\n`));
  }

  const scanResult = buildScanResult(resolvedPath, categories);
  const report = formatReport(scanResult, outputFormat);

  if (outputFile) {
    const outPath = path.resolve(outputFile);
    fs.writeFileSync(outPath, report, 'utf-8');
    if (outputFormat === 'console') {
      console.log(report);
      console.log(chalk.dim(`\n  Report also written to: ${outPath}`));
    } else {
      console.log(chalk.dim(`Report written to: ${outPath}`));
    }
  } else {
    console.log(report);
  }
}

const program = new Command();

program
  .name('prism-scan')
  .description('PRISM D1 Velocity — AI-DLC Maturity Scanner. Not a survey, a real score.')
  .version(VERSION)
  .option('-r, --repo <path>', 'Path to the git repository to scan', '.')
  .option('-o, --output <format>', 'Output format: console, json, markdown', 'console')
  .option('-f, --output-file <path>', 'Write report to file')
  .option('-v, --verbose', 'Enable verbose output with detailed evidence', false)
  .action(async (options) => {
    const format = options.output as OutputFormat;
    if (!['console', 'json', 'markdown'].includes(format)) {
      console.error(chalk.red(`Invalid output format: ${format}. Use console, json, or markdown.`));
      process.exit(1);
    }
    await runScan(options.repo, format, options.outputFile, options.verbose);
  });

program.parse(process.argv);
