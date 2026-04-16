import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Documentation';
const MAX_POINTS = 3;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  const docFiles = await glob('**/*.md', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'vendor/**', 'CHANGELOG.md'],
  }).catch(() => []);

  const contentCache: Map<string, string> = new Map();
  for (const file of docFiles.slice(0, 100)) {
    try {
      contentCache.set(file, fs.readFileSync(path.join(repoPath, file), 'utf-8'));
    } catch {
      // skip
    }
  }

  // AI development guidelines documented (1 pt)
  const guidelinePatterns = [
    /ai.*guideline/i, /ai.*development.*guide/i,
    /ai.*coding.*standard/i, /ai.*best.*practice/i,
    /llm.*guideline/i, /prompt.*engineering.*guide/i,
    /ai.*workflow.*guide/i, /ai.*usage.*guide/i,
    /ai.*development.*standard/i,
  ];
  let hasGuidelines = false;
  let guidelineDetail = '';

  // Check doc file names first
  for (const file of docFiles) {
    if (/ai.*guide|ai.*standard|prompt.*guide|llm.*guide/i.test(file)) {
      hasGuidelines = true;
      guidelineDetail = `Found AI guideline doc: ${file}`;
      break;
    }
  }
  if (!hasGuidelines) {
    for (const [file, content] of contentCache) {
      for (const pat of guidelinePatterns) {
        if (pat.test(content)) {
          hasGuidelines = true;
          guidelineDetail = `${file} contains AI development guidelines`;
          break;
        }
      }
      if (hasGuidelines) break;
    }
  }
  evidence.push({
    signal: 'AI development guidelines documented',
    found: hasGuidelines,
    points: hasGuidelines ? 1 : 0,
    detail: hasGuidelines ? guidelineDetail : 'No AI development guidelines found in documentation',
  });

  // Architecture decision records mentioning AI (1 pt)
  const adrFiles = await glob('**/{adr,ADR,decisions,architecture-decisions}/**/*.md', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);

  let hasAiAdr = false;
  let adrDetail = '';

  if (adrFiles.length > 0) {
    for (const file of adrFiles) {
      try {
        const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
        if (/\bai\b|llm|machine learning|bedrock|model|agent/i.test(content)) {
          hasAiAdr = true;
          adrDetail = `ADR mentions AI: ${file}`;
          break;
        }
      } catch {
        // skip
      }
    }
    if (!hasAiAdr) {
      adrDetail = `Found ${adrFiles.length} ADRs but none mention AI`;
    }
  } else {
    // Check for inline ADR-like content
    for (const [file, content] of contentCache) {
      if (/architecture.*decision|decision.*record|ADR/i.test(content) && /\bai\b|llm|bedrock|agent/i.test(content)) {
        hasAiAdr = true;
        adrDetail = `${file} contains architecture decisions mentioning AI`;
        break;
      }
    }
  }
  evidence.push({
    signal: 'Architecture decision records mentioning AI',
    found: hasAiAdr,
    points: hasAiAdr ? 1 : 0,
    detail: hasAiAdr ? adrDetail : 'No ADRs mentioning AI found',
  });

  // Onboarding docs reference AI tooling (1 pt)
  const onboardingPatterns = [
    /onboard/i, /getting[_-]?started/i, /setup.*guide/i,
    /contributing/i, /developer.*guide/i, /new.*developer/i,
  ];
  let hasAiOnboarding = false;
  let onboardingDetail = '';
  for (const [file, content] of contentCache) {
    const isOnboardingDoc = onboardingPatterns.some((p) => p.test(file) || p.test(content.slice(0, 500)));
    if (isOnboardingDoc) {
      const aiRef = /\bai\b|claude|copilot|amazon\s*q|cursor|llm|bedrock|ai.*tool/i.test(content);
      if (aiRef) {
        hasAiOnboarding = true;
        onboardingDetail = `${file} is an onboarding doc that references AI tooling`;
        break;
      }
    }
  }
  evidence.push({
    signal: 'Onboarding docs reference AI tooling',
    found: hasAiOnboarding,
    points: hasAiOnboarding ? 1 : 0,
    detail: hasAiOnboarding ? onboardingDetail : 'No onboarding docs reference AI tooling',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
