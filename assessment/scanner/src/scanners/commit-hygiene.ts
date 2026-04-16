import { CategoryScore, Evidence, ScanConfig } from '../types';
import simpleGit from 'simple-git';

const CATEGORY = 'Commit Hygiene';
const MAX_POINTS = 15;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];
  const git = simpleGit(repoPath);

  let commits: Array<{ hash: string; message: string; body: string }> = [];
  try {
    const log = await git.log({ maxCount: config.commitDepth || 200, '--format': '%H|||%s|||%b|||%aE' });
    commits = log.all.map((entry) => ({
      hash: entry.hash,
      message: entry.message,
      body: entry.body || '',
    }));
  } catch {
    evidence.push({
      signal: 'Git repository accessible',
      found: false,
      points: 0,
      detail: 'Could not read git log. Is this a git repository?',
    });
    return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints: 0, evidence };
  }

  if (commits.length === 0) {
    evidence.push({
      signal: 'Git commits found',
      found: false,
      points: 0,
      detail: 'No commits found in repository',
    });
    return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints: 0, evidence };
  }

  // Check for AI trailers in commits (12 pts based on percentage)
  const aiTrailerPatterns = [
    /AI-Origin:/i, /AI-Generated:/i, /AI-Assisted:/i,
    /Generated-By:/i, /Assisted-By:/i,
    /Co-Authored-By:.*\b(claude|copilot|gpt|ai|bot|anthropic|amazon\s*q|codewhisperer)\b/i,
    /\[ai[- ]generated\]/i, /\[ai[- ]assisted\]/i,
    /\bagentic\b/i,
    /AI-Tool:/i, /AI-Agent:/i,
  ];

  let aiCommitCount = 0;
  for (const commit of commits) {
    const fullText = `${commit.message}\n${commit.body}`;
    if (aiTrailerPatterns.some((p) => p.test(fullText))) {
      aiCommitCount++;
    }
  }

  const aiPercentage = (aiCommitCount / commits.length) * 100;
  let aiTrailerPoints = 0;
  if (aiPercentage > 50) aiTrailerPoints = 12;
  else if (aiPercentage > 30) aiTrailerPoints = 9;
  else if (aiPercentage > 10) aiTrailerPoints = 6;
  else if (aiPercentage > 0) aiTrailerPoints = 3;

  evidence.push({
    signal: 'AI-Origin trailers in commits',
    found: aiCommitCount > 0,
    points: aiTrailerPoints,
    detail: `${aiCommitCount}/${commits.length} commits (${aiPercentage.toFixed(1)}%) have AI trailers`,
  });

  // Check for AI-Model trailer (3 pts)
  const modelTrailerPatterns = [
    /AI-Model:/i, /Model:/i, /LLM:/i,
    /claude-\d/i, /gpt-4/i, /gpt-3/i,
    /sonnet/i, /opus/i, /haiku/i,
  ];
  let hasModelTrailer = false;
  let modelTrailerDetail = '';
  for (const commit of commits) {
    const fullText = `${commit.message}\n${commit.body}`;
    for (const pattern of modelTrailerPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        hasModelTrailer = true;
        modelTrailerDetail = `Found "${match[0]}" in commit ${commit.hash.slice(0, 8)}`;
        break;
      }
    }
    if (hasModelTrailer) break;
  }
  evidence.push({
    signal: 'AI-Model trailer present (tool awareness)',
    found: hasModelTrailer,
    points: hasModelTrailer ? 3 : 0,
    detail: hasModelTrailer ? modelTrailerDetail : 'No AI-Model trailers found in recent commits',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
