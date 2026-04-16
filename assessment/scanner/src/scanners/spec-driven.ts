import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Spec-Driven Dev';
const MAX_POINTS = 10;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  // Check specs/ directory exists (2 pts)
  const specsDirCandidates = ['specs', 'spec', 'specifications', '.kiro/specs'];
  let specsDirFound = false;
  let specsDirPath = '';
  for (const dir of specsDirCandidates) {
    const fullPath = path.join(repoPath, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      specsDirFound = true;
      specsDirPath = dir;
      break;
    }
  }
  evidence.push({
    signal: 'Specs directory exists',
    found: specsDirFound,
    points: specsDirFound ? 2 : 0,
    detail: specsDirFound ? `Found specs directory: ${specsDirPath}/` : 'No specs/ directory found',
  });

  // Count spec files (0=0, 1-3=2, 4-10=4, 10+=6 pts)
  const specPatterns = [
    '**/specs/**/*.{md,yaml,yml,json}',
    '**/spec/**/*.{md,yaml,yml,json}',
    '**/specifications/**/*.{md,yaml,yml,json}',
    '**/.kiro/specs/**/*.{md,yaml,yml,json}',
    '**/*spec*.md',
    '**/*specification*.md',
  ];
  const specFilesSet = new Set<string>();
  for (const pattern of specPatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '**/*.test.*', '**/*.spec.ts', '**/*.spec.js'],
    }).catch(() => []);
    matches.forEach((m) => specFilesSet.add(m));
  }
  const specCount = specFilesSet.size;
  let specCountPoints = 0;
  if (specCount >= 10) specCountPoints = 6;
  else if (specCount >= 4) specCountPoints = 4;
  else if (specCount >= 1) specCountPoints = 2;

  evidence.push({
    signal: 'Spec file count',
    found: specCount > 0,
    points: specCountPoints,
    detail: `Found ${specCount} spec files${specCount > 0 ? `: ${[...specFilesSet].slice(0, 5).join(', ')}${specCount > 5 ? '...' : ''}` : ''}`,
  });

  // Check if specs follow structured format (2 pts)
  let hasStructuredSpecs = false;
  let structuredDetail = '';
  const structuredPatterns = [
    /## requirements/i, /## acceptance criteria/i, /## user stor/i,
    /## given/i, /## when/i, /## then/i,
    /acceptance[_\s-]?criteria/i, /requirements:/i,
    /## scope/i, /## constraints/i, /## success criteria/i,
  ];
  for (const file of specFilesSet) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      const matchCount = structuredPatterns.filter((p) => p.test(content)).length;
      if (matchCount >= 2) {
        hasStructuredSpecs = true;
        structuredDetail = `${file} has structured format (${matchCount} structural elements)`;
        break;
      }
    } catch {
      // skip
    }
  }
  evidence.push({
    signal: 'Specs follow structured format',
    found: hasStructuredSpecs,
    points: hasStructuredSpecs ? 2 : 0,
    detail: hasStructuredSpecs ? structuredDetail : 'No structured spec format detected (requirements, acceptance criteria)',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
