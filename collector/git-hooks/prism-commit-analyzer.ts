#!/usr/bin/env ts-node
/**
 * PRISM Commit Analyzer
 *
 * Reads a git commit message (from stdin, file argument, or the latest commit),
 * extracts AI-Origin / AI-Model / Spec-Ref trailers, computes diff stats, and
 * outputs a structured JSON event suitable for EventBridge ingestion.
 *
 * Usage:
 *   echo "<commit-message>" | ts-node prism-commit-analyzer.ts
 *   ts-node prism-commit-analyzer.ts <path-to-commit-msg-file>
 *   ts-node prism-commit-analyzer.ts --last   # analyze most recent commit
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AITrailers {
  origin: 'ai-assisted' | 'ai-generated' | 'human';
  model: string | null;
  tool: string | null;
  specRef: string | null;
}

interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

interface PrismCommitEvent {
  source: 'prism.d1.velocity';
  'detail-type': 'prism.d1.commit';
  detail: {
    team_id: string;
    repo: string;
    timestamp: string;
    prism_level: number | null;
    metric: {
      name: string;
      value: number;
      unit: string;
    };
    ai_context: {
      tool: string;
      model: string | null;
      origin: string;
    };
    dora: {
      deployment_frequency: null;
      lead_time_seconds: null;
      change_failure_rate: null;
      mttr_seconds: null;
    };
    ai_dora: {
      ai_acceptance_rate: null;
      ai_to_merge_ratio: number | null;
      spec_to_code_hours: null;
      post_merge_defect_rate: null;
      eval_gate_pass_rate: null;
      ai_test_coverage_delta: null;
    };
    commit: {
      sha: string;
      message_summary: string;
      trailers: AITrailers;
      diff_stats: DiffStats;
    };
  };
}

// ---------------------------------------------------------------------------
// Trailer Parsing
// ---------------------------------------------------------------------------

const TRAILER_RE = /^([\w-]+):\s*(.+)$/;

function parseTrailers(message: string): AITrailers {
  const lines = message.split('\n');
  const trailers: Record<string, string> = {};

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '') break;
    const m = TRAILER_RE.exec(line);
    if (m) {
      trailers[m[1].toLowerCase()] = m[2].trim();
    }
  }

  let origin: AITrailers['origin'] = 'human';
  const raw = trailers['ai-origin'];
  if (raw === 'ai-assisted' || raw === 'ai-generated' || raw === 'human') {
    origin = raw;
  } else if (raw) {
    origin = 'ai-assisted';
  }

  return {
    origin,
    model: trailers['ai-model'] ?? null,
    tool: trailers['ai-tool'] ?? null,
    specRef: trailers['spec-ref'] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Git Helpers
// ---------------------------------------------------------------------------

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf-8', timeout: 10_000 }).trim();
  } catch (err) {
    console.error(`git command failed: git ${args}`);
    return '';
  }
}

function getLatestCommitMessage(): string {
  return git('log -1 --format=%B');
}

function getLatestCommitSha(): string {
  return git('log -1 --format=%H');
}

function getLatestCommitTimestamp(): string {
  return git('log -1 --format=%aI');
}

function getDiffStats(sha: string): DiffStats {
  const raw = git(`diff --shortstat ${sha}~1 ${sha}`);

  if (!raw) {
    return { filesChanged: 0, insertions: 0, deletions: 0 };
  }

  const filesMatch = raw.match(/(\d+) files? changed/);
  const insertionsMatch = raw.match(/(\d+) insertions?\(\+\)/);
  const deletionsMatch = raw.match(/(\d+) deletions?\(-\)/);

  return {
    filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
    insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
    deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
  };
}

function getRepoName(): string {
  const remote = git('remote get-url origin');
  if (!remote) return 'unknown';

  // Extract owner/repo from various URL formats
  const match = remote.match(/[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  return match ? match[1] : 'unknown';
}

// ---------------------------------------------------------------------------
// Input Handling
// ---------------------------------------------------------------------------

function readCommitMessage(): string {
  const args = process.argv.slice(2);

  if (args.includes('--last')) {
    return getLatestCommitMessage();
  }

  if (args.length > 0 && !args[0].startsWith('-')) {
    try {
      return readFileSync(args[0], 'utf-8');
    } catch (err) {
      console.error(`Failed to read file: ${args[0]}`);
      process.exit(1);
    }
  }

  // Read from stdin if data is available
  try {
    return readFileSync('/dev/stdin', 'utf-8');
  } catch {
    console.error('No commit message provided. Usage:');
    console.error('  echo "msg" | ts-node prism-commit-analyzer.ts');
    console.error('  ts-node prism-commit-analyzer.ts <file>');
    console.error('  ts-node prism-commit-analyzer.ts --last');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const message = readCommitMessage();
  const trailers = parseTrailers(message);

  const sha = getLatestCommitSha();
  const timestamp = getLatestCommitTimestamp() || new Date().toISOString();
  const diffStats = sha ? getDiffStats(sha) : { filesChanged: 0, insertions: 0, deletions: 0 };
  const repo = getRepoName();
  const teamId = process.env.PRISM_TEAM_ID ?? 'default';

  const firstLine = message.split('\n')[0].substring(0, 120);

  const event: PrismCommitEvent = {
    source: 'prism.d1.velocity',
    'detail-type': 'prism.d1.commit',
    detail: {
      team_id: teamId,
      repo,
      timestamp,
      prism_level: null,
      metric: {
        name: 'commit.lines_changed',
        value: diffStats.insertions + diffStats.deletions,
        unit: 'lines',
      },
      ai_context: {
        tool: trailers.tool ?? 'claude-code',
        model: trailers.model,
        origin: trailers.origin,
      },
      dora: {
        deployment_frequency: null,
        lead_time_seconds: null,
        change_failure_rate: null,
        mttr_seconds: null,
      },
      ai_dora: {
        ai_acceptance_rate: null,
        ai_to_merge_ratio: trailers.origin !== 'human' ? 1 : 0,
        spec_to_code_hours: null,
        post_merge_defect_rate: null,
        eval_gate_pass_rate: null,
        ai_test_coverage_delta: null,
      },
      commit: {
        sha,
        message_summary: firstLine,
        trailers,
        diff_stats: diffStats,
      },
    },
  };

  // Output as JSON to stdout — callers can pipe this to EventBridge or log it
  process.stdout.write(JSON.stringify(event, null, 2) + '\n');
}

main();
