import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

const CATEGORY = 'CI/CD Integration';
const MAX_POINTS = 15;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  // Check CI config exists (2 pts)
  const ciPatterns = [
    '.github/workflows/*.{yml,yaml}',
    '.gitlab-ci.yml',
    'Jenkinsfile',
    'buildspec.yml',
    'buildspec.yaml',
    '.circleci/config.yml',
    '.travis.yml',
    'azure-pipelines.yml',
    'codepipeline*.{json,yaml,yml}',
    '**/pipeline*.{json,yaml,yml}',
    'cdk.json',
    '.codebuild/**/*.{yml,yaml}',
  ];

  const ciFiles: string[] = [];
  for (const pattern of ciPatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    }).catch(() => []);
    ciFiles.push(...matches);
  }
  const hasCi = ciFiles.length > 0;
  evidence.push({
    signal: 'CI/CD configuration exists',
    found: hasCi,
    points: hasCi ? 2 : 0,
    detail: hasCi ? `Found CI configs: ${ciFiles.slice(0, 5).join(', ')}` : 'No CI/CD configuration found',
  });

  // Read all CI file contents for further analysis
  let ciContents = '';
  for (const file of ciFiles.slice(0, 20)) {
    try {
      ciContents += '\n' + fs.readFileSync(path.join(repoPath, file), 'utf-8');
    } catch {
      // skip
    }
  }

  // CI references Bedrock, AI evaluation, or eval gates (5 pts)
  const aiCiPatterns = [
    /bedrock/i, /invoke[_-]?model/i, /foundation[_-]?model/i,
    /eval[_-]?gate/i, /ai[_-]?eval/i, /llm[_-]?eval/i,
    /model[_-]?eval/i, /anthropic/i, /openai/i,
    /claude/i, /guardrail/i, /ai[_-]?review/i,
    /agent[_-]?eval/i, /prompt[_-]?eval/i,
  ];
  const hasAiCi = aiCiPatterns.some((p) => p.test(ciContents));
  evidence.push({
    signal: 'CI references AI evaluation / Bedrock / eval gates',
    found: hasAiCi,
    points: hasAiCi ? 5 : 0,
    detail: hasAiCi
      ? 'CI configuration contains AI evaluation or Bedrock references'
      : 'No AI evaluation references in CI config',
  });

  // CI emits metrics/events (EventBridge, CloudWatch, etc.) (4 pts)
  const metricsPatterns = [
    /eventbridge/i, /cloudwatch/i, /put[_-]?metric/i,
    /put[_-]?events/i, /datadog/i, /prometheus/i,
    /metrics/i, /telemetry/i, /emit[_-]?event/i,
    /observability/i, /dora/i,
  ];
  const hasMetrics = metricsPatterns.some((p) => p.test(ciContents));
  evidence.push({
    signal: 'CI emits metrics/events',
    found: hasMetrics,
    points: hasMetrics ? 4 : 0,
    detail: hasMetrics
      ? 'CI configuration references metrics or event emission'
      : 'No metrics/event emission found in CI config',
  });

  // CI has AI-specific test steps (2 pts)
  const aiTestPatterns = [
    /ai[_-]?test/i, /eval[_-]?test/i, /llm[_-]?test/i,
    /model[_-]?test/i, /prompt[_-]?test/i,
    /hallucination/i, /groundedness/i, /toxicity/i,
    /ai[_-]?quality/i, /regression[_-]?eval/i,
  ];
  const hasAiTests = aiTestPatterns.some((p) => p.test(ciContents));
  evidence.push({
    signal: 'CI has AI-specific test steps',
    found: hasAiTests,
    points: hasAiTests ? 2 : 0,
    detail: hasAiTests
      ? 'CI includes AI-specific testing steps'
      : 'No AI-specific test steps in CI config',
  });

  // Deployment frequency from git tags/releases (2 pts)
  let hasDeployFreq = false;
  let deployDetail = '';
  try {
    const git = simpleGit(repoPath);
    const tags = await git.tags();
    const tagCount = tags.all.length;
    if (tagCount >= 3) {
      hasDeployFreq = true;
      deployDetail = `Found ${tagCount} git tags (deployment frequency derivable)`;
    } else {
      deployDetail = `Only ${tagCount} git tags found (need 3+ for frequency analysis)`;
    }
  } catch {
    deployDetail = 'Could not read git tags';
  }
  evidence.push({
    signal: 'Deployment frequency derivable from tags/releases',
    found: hasDeployFreq,
    points: hasDeployFreq ? 2 : 0,
    detail: deployDetail,
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
