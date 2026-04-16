import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'AI Tool Config';
const MAX_POINTS = 10;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  // Check CLAUDE.md exists (3 pts)
  const claudeMdPath = path.join(repoPath, 'CLAUDE.md');
  const claudeMdExists = fs.existsSync(claudeMdPath);
  evidence.push({
    signal: 'CLAUDE.md exists',
    found: claudeMdExists,
    points: claudeMdExists ? 3 : 0,
    detail: claudeMdExists ? `Found at ${claudeMdPath}` : 'No CLAUDE.md found in repo root',
  });

  // Check CLAUDE.md has spec-first enforcement rules (2 pts)
  let hasSpecRules = false;
  if (claudeMdExists) {
    try {
      const content = fs.readFileSync(claudeMdPath, 'utf-8').toLowerCase();
      const specPatterns = [
        'spec', 'specification', 'spec-first', 'spec-driven',
        'acceptance criteria', 'requirements', 'before coding',
        'write a spec', 'create a spec', 'design doc',
      ];
      hasSpecRules = specPatterns.some((p) => content.includes(p));
    } catch {
      // ignore read errors
    }
  }
  evidence.push({
    signal: 'CLAUDE.md has spec-first enforcement',
    found: hasSpecRules,
    points: hasSpecRules ? 2 : 0,
    detail: hasSpecRules
      ? 'CLAUDE.md references spec-driven or specification patterns'
      : 'No spec-first enforcement rules detected in CLAUDE.md',
  });

  // Check .kiro/ or kiro config (2 pts)
  const kiroDir = path.join(repoPath, '.kiro');
  const kiroDirExists = fs.existsSync(kiroDir);
  const kiroFiles = await glob('**/.kiro*', { cwd: repoPath, nodir: false, dot: true, ignore: ['node_modules/**'] }).catch(() => []);
  const hasKiro = kiroDirExists || kiroFiles.length > 0;
  evidence.push({
    signal: 'Kiro configuration exists',
    found: hasKiro,
    points: hasKiro ? 2 : 0,
    detail: hasKiro
      ? `Kiro config found: ${kiroDirExists ? '.kiro/' : kiroFiles[0]}`
      : 'No .kiro directory or kiro configuration found',
  });

  // Check AI IDE config (Copilot, Amazon Q, etc.) (1 pt)
  const ideConfigPatterns = [
    '**/.github/copilot*',
    '**/.copilot*',
    '**/.amazonq*',
    '**/.amazon-q*',
    '**/amazonq*',
    '**/.codewhisperer*',
    '**/.cursor*',
    '**/.continue*',
    '**/.aider*',
  ];
  let ideConfigFound = false;
  let ideConfigDetail = '';
  for (const pattern of ideConfigPatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true, ignore: ['node_modules/**', 'dist/**', '.git/**'],
    }).catch(() => []);
    if (matches.length > 0) {
      ideConfigFound = true;
      ideConfigDetail = matches[0];
      break;
    }
  }
  evidence.push({
    signal: 'AI IDE config exists (Copilot/Amazon Q/Cursor/etc.)',
    found: ideConfigFound,
    points: ideConfigFound ? 1 : 0,
    detail: ideConfigFound
      ? `Found AI IDE config: ${ideConfigDetail}`
      : 'No AI IDE configuration files found',
  });

  // Check references to Bedrock or specific models (2 pts)
  let hasModelRefs = false;
  let modelRefDetail = '';
  const configFiles = await glob('**/*.{json,yaml,yml,toml,md}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'package-lock.json', 'yarn.lock'],
  }).catch(() => []);

  const modelPatterns = [
    /bedrock/i, /anthropic\.claude/i, /claude-\d/i, /claude-sonnet/i,
    /claude-opus/i, /claude-haiku/i, /gpt-4/i, /gpt-3\.5/i,
    /amazon\.titan/i, /ai21/i, /cohere/i, /meta\.llama/i,
    /model[_-]?id/i,
  ];

  for (const file of configFiles.slice(0, 100)) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      for (const pat of modelPatterns) {
        if (pat.test(content)) {
          hasModelRefs = true;
          modelRefDetail = `${file} references ${pat.source}`;
          break;
        }
      }
      if (hasModelRefs) break;
    } catch {
      // skip unreadable
    }
  }
  evidence.push({
    signal: 'AI tool config references Bedrock or specific models',
    found: hasModelRefs,
    points: hasModelRefs ? 2 : 0,
    detail: hasModelRefs ? modelRefDetail : 'No Bedrock or model references found in config files',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
