import chalk from 'chalk';
import { ScanResult, CategoryScore, OutputFormat } from './types';

// ── Console Reporter ──────────────────────────────────────────────

function bar(earned: number, max: number, width: number = 10): string {
  const filled = max > 0 ? Math.round((earned / max) * width) : 0;
  const empty = width - filled;
  return chalk.green('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

function levelColor(level: string): string {
  if (level.startsWith('L5') || level.startsWith('L4')) return chalk.magenta(level);
  if (level.startsWith('L3')) return chalk.cyan(level);
  if (level.startsWith('L2')) return chalk.yellow(level);
  return chalk.red(level);
}

const BOX_WIDTH = 58;

function boxLine(content: string): string {
  // Strip ANSI for length calculation
  const stripped = content.replace(/\u001b\[[0-9;]*m/g, '');
  const padding = BOX_WIDTH - 2 - stripped.length;
  const pad = padding > 0 ? ' '.repeat(padding) : '';
  return `\u2551  ${content}${pad}\u2551`;
}

function boxTop(): string {
  return '\u2554' + '\u2550'.repeat(BOX_WIDTH) + '\u2557';
}

function boxBottom(): string {
  return '\u255a' + '\u2550'.repeat(BOX_WIDTH) + '\u255d';
}

function boxDivider(): string {
  return '\u2560' + '\u2550'.repeat(BOX_WIDTH) + '\u2563';
}

function boxEmpty(): string {
  return '\u2551' + ' '.repeat(BOX_WIDTH) + '\u2551';
}

export function formatConsole(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(boxTop());
  lines.push(boxLine(chalk.bold.white('PRISM D1: Velocity Assessment')));
  lines.push(boxLine(`Repository: ${chalk.cyan(result.repoName)}`));
  lines.push(boxLine(`Date: ${result.scanDate}`));
  lines.push(boxDivider());
  lines.push(boxEmpty());

  // Overall score bar
  const scoreFilled = Math.round((result.totalScore / result.maxScore) * 20);
  const scoreEmpty = 20 - scoreFilled;
  const scoreBar = chalk.green('\u2588'.repeat(scoreFilled)) + chalk.gray('\u2591'.repeat(scoreEmpty));
  lines.push(boxLine(
    `PRISM Level: ${levelColor(result.prismLevel.level)}  ${scoreBar} (${result.totalScore}/${result.maxScore})`
  ));
  lines.push(boxLine(chalk.dim(result.prismLevel.description)));
  lines.push(boxEmpty());

  // Category breakdown
  for (const cat of result.categories) {
    const name = padRight(cat.category, 20);
    const b = bar(cat.earnedPoints, cat.maxPoints);
    const score = padLeft(`${cat.earnedPoints}/${cat.maxPoints}`, 6);
    lines.push(boxLine(`${name}${b}  ${score}`));
  }

  lines.push(boxEmpty());

  // Strengths
  if (result.strengths.length > 0) {
    lines.push(boxLine(chalk.bold.green('TOP STRENGTHS')));
    result.strengths.forEach((s, i) => {
      lines.push(boxLine(chalk.green(`  ${i + 1}. ${s}`)));
    });
    lines.push(boxEmpty());
  }

  // Gaps
  if (result.gaps.length > 0) {
    lines.push(boxLine(chalk.bold.red('TOP GAPS')));
    result.gaps.forEach((g, i) => {
      lines.push(boxLine(chalk.red(`  ${i + 1}. ${g}`)));
    });
    lines.push(boxEmpty());
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push(boxLine(chalk.bold.yellow('RECOMMENDED ACTIONS')));
    result.recommendations.forEach((r) => {
      lines.push(boxLine(chalk.yellow(`  \u2192 ${r}`)));
    });
    lines.push(boxEmpty());
  }

  lines.push(boxBottom());
  return lines.join('\n');
}

// ── JSON Reporter ─────────────────────────────────────────────────

export function formatJSON(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

// ── Markdown Reporter ─────────────────────────────────────────────

function mdBar(earned: number, max: number): string {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  return `${'█'.repeat(Math.round(pct / 10))}${'░'.repeat(10 - Math.round(pct / 10))}`;
}

export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('# PRISM D1: Velocity Assessment');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Repository** | \`${result.repoName}\` |`);
  lines.push(`| **Path** | \`${result.repoPath}\` |`);
  lines.push(`| **Date** | ${result.scanDate} |`);
  lines.push(`| **PRISM Level** | **${result.prismLevel.level}** (${result.prismLevel.label}) |`);
  lines.push(`| **Score** | **${result.totalScore}/${result.maxScore}** |`);
  lines.push('');

  lines.push('## Category Breakdown');
  lines.push('');
  lines.push('| Category | Score | Bar |');
  lines.push('|----------|-------|-----|');
  for (const cat of result.categories) {
    lines.push(`| ${cat.category} | ${cat.earnedPoints}/${cat.maxPoints} | \`${mdBar(cat.earnedPoints, cat.maxPoints)}\` |`);
  }
  lines.push('');

  lines.push('## Evidence Detail');
  lines.push('');
  for (const cat of result.categories) {
    lines.push(`### ${cat.category} (${cat.earnedPoints}/${cat.maxPoints})`);
    lines.push('');
    for (const ev of cat.evidence) {
      const icon = ev.found ? '✅' : '❌';
      lines.push(`- ${icon} **${ev.signal}** (${ev.points} pts) — ${ev.detail}`);
    }
    lines.push('');
  }

  if (result.strengths.length > 0) {
    lines.push('## Top Strengths');
    lines.push('');
    result.strengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  if (result.gaps.length > 0) {
    lines.push('## Top Gaps');
    lines.push('');
    result.gaps.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
    lines.push('');
  }

  if (result.recommendations.length > 0) {
    lines.push('## Recommended Actions');
    lines.push('');
    result.recommendations.forEach((r) => lines.push(`- ${r}`));
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by PRISM D1 Velocity Scanner*');
  return lines.join('\n');
}

// ── Dispatcher ────────────────────────────────────────────────────

export function formatReport(result: ScanResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJSON(result);
    case 'markdown':
      return formatMarkdown(result);
    case 'console':
    default:
      return formatConsole(result);
  }
}
