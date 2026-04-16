import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Eval & Quality';
const MAX_POINTS = 10;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  // Eval rubrics or evaluation config files exist (3 pts)
  const evalPatterns = [
    '**/eval*.*',
    '**/evaluation*.*',
    '**/rubric*.*',
    '**/*eval*.{json,yaml,yml,toml}',
    '**/*evaluation*.{json,yaml,yml,toml}',
    '**/evals/**',
    '**/evaluations/**',
  ];
  const evalFiles: string[] = [];
  for (const pattern of evalPatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '**/*.test.*', '**/*.spec.*'],
    }).catch(() => []);
    evalFiles.push(...matches);
  }
  const hasEvalConfigs = evalFiles.length > 0;
  evidence.push({
    signal: 'Eval rubrics or evaluation config files exist',
    found: hasEvalConfigs,
    points: hasEvalConfigs ? 3 : 0,
    detail: hasEvalConfigs
      ? `Found eval configs: ${evalFiles.slice(0, 5).join(', ')}`
      : 'No evaluation configuration or rubric files found',
  });

  // Bedrock Evaluation references in code/config (3 pts)
  const codeFiles = await glob('**/*.{ts,js,py,java,go,yaml,yml,json}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'package-lock.json', 'yarn.lock'],
  }).catch(() => []);

  const bedrockEvalPatterns = [
    /bedrock.*eval/i, /evaluate.*model/i, /model.*evaluat/i,
    /BedrockRuntime/i, /bedrock-evaluation/i,
    /EvaluationJob/i, /CreateEvaluationJob/i,
    /bedrock.*guardrail/i, /ApplyGuardrail/i,
  ];
  let hasBedrockEval = false;
  let bedrockEvalDetail = '';
  for (const file of codeFiles.slice(0, 200)) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      for (const pat of bedrockEvalPatterns) {
        if (pat.test(content)) {
          hasBedrockEval = true;
          bedrockEvalDetail = `${file} contains Bedrock evaluation references`;
          break;
        }
      }
      if (hasBedrockEval) break;
    } catch {
      // skip
    }
  }
  evidence.push({
    signal: 'Bedrock Evaluation references in code/config',
    found: hasBedrockEval,
    points: hasBedrockEval ? 3 : 0,
    detail: hasBedrockEval ? bedrockEvalDetail : 'No Bedrock Evaluation references found',
  });

  // LLM-as-Judge patterns in test code (2 pts)
  const testFiles = await glob('**/*.{test,spec}.{ts,js,py}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);
  const allTestFiles = [
    ...testFiles,
    ...(await glob('**/test*/**/*.{ts,js,py}', {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    }).catch(() => [])),
  ];

  const judgePatterns = [
    /llm.*judge/i, /judge.*llm/i, /ai.*judge/i,
    /model.*grade/i, /grade.*response/i,
    /evaluate.*response/i, /score.*response/i,
    /llm.*eval/i, /gpt.*eval/i, /claude.*eval/i,
    /automated.*review/i, /quality.*score/i,
  ];
  let hasJudge = false;
  let judgeDetail = '';
  for (const file of [...new Set(allTestFiles)].slice(0, 100)) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      for (const pat of judgePatterns) {
        if (pat.test(content)) {
          hasJudge = true;
          judgeDetail = `${file} contains LLM-as-Judge pattern`;
          break;
        }
      }
      if (hasJudge) break;
    } catch {
      // skip
    }
  }
  evidence.push({
    signal: 'LLM-as-Judge patterns in test code',
    found: hasJudge,
    points: hasJudge ? 2 : 0,
    detail: hasJudge ? judgeDetail : 'No LLM-as-Judge patterns found in test code',
  });

  // Eval threshold configuration (2 pts)
  const thresholdPatterns = [
    /threshold/i, /pass[_-]?criteria/i, /fail[_-]?criteria/i,
    /min[_-]?score/i, /quality[_-]?gate/i, /eval[_-]?threshold/i,
    /acceptance[_-]?threshold/i, /confidence[_-]?threshold/i,
  ];
  let hasThreshold = false;
  let thresholdDetail = '';
  for (const file of evalFiles.slice(0, 20)) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      for (const pat of thresholdPatterns) {
        if (pat.test(content)) {
          hasThreshold = true;
          thresholdDetail = `${file} defines evaluation thresholds`;
          break;
        }
      }
      if (hasThreshold) break;
    } catch {
      // skip
    }
  }
  // Also check CI files and general configs
  if (!hasThreshold) {
    for (const file of codeFiles.slice(0, 100)) {
      try {
        const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
        if (/eval.*threshold|quality.*gate|pass.*criteria/i.test(content)) {
          hasThreshold = true;
          thresholdDetail = `${file} contains eval threshold configuration`;
          break;
        }
      } catch {
        // skip
      }
    }
  }
  evidence.push({
    signal: 'Eval threshold configuration (pass/fail criteria)',
    found: hasThreshold,
    points: hasThreshold ? 2 : 0,
    detail: hasThreshold ? thresholdDetail : 'No evaluation threshold or pass/fail criteria found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
