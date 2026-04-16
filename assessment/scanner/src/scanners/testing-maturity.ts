import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Testing Maturity';
const MAX_POINTS = 10;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  // Count test files (2 pts)
  const testFilePatterns = [
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/test_*.py',
    '**/*_test.py',
    '**/*_test.go',
    '**/Test*.java',
    '**/*Test.java',
    '**/*Spec.java',
  ];
  const testFilesSet = new Set<string>();
  for (const pattern of testFilePatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**', 'vendor/**'],
    }).catch(() => []);
    matches.forEach((m) => testFilesSet.add(m));
  }
  // Also check test directories
  const testDirFiles = await glob('**/test/**/*.{ts,js,py,go,java}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'vendor/**'],
  }).catch(() => []);
  testDirFiles.forEach((m) => testFilesSet.add(m));

  const testFileCount = testFilesSet.size;
  const hasTests = testFileCount > 0;
  evidence.push({
    signal: 'Test files exist',
    found: hasTests,
    points: hasTests ? 2 : 0,
    detail: hasTests
      ? `Found ${testFileCount} test files`
      : 'No test files found',
  });

  // Test-to-source ratio (6 pts)
  const sourcePatterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
    'app/**/*.{ts,tsx,js,jsx}',
    '**/*.py',
    '**/*.go',
    '**/*.java',
  ];
  const sourceFilesSet = new Set<string>();
  for (const pattern of sourcePatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: [
        'node_modules/**', 'dist/**', '.git/**', 'vendor/**',
        '**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**',
        '**/test_*', '**/*_test.*',
      ],
    }).catch(() => []);
    matches.forEach((m) => sourceFilesSet.add(m));
  }
  const sourceFileCount = sourceFilesSet.size;
  const ratio = sourceFileCount > 0 ? testFileCount / sourceFileCount : 0;
  let ratioPoints = 0;
  if (ratio >= 0.5) ratioPoints = 6;
  else if (ratio >= 0.3) ratioPoints = 4;
  else if (ratio >= 0.1) ratioPoints = 2;

  evidence.push({
    signal: 'Test-to-source ratio',
    found: ratio >= 0.1,
    points: ratioPoints,
    detail: `${testFileCount} test files / ${sourceFileCount} source files = ${ratio.toFixed(2)} ratio`,
  });

  // AI-specific test patterns (2 pts)
  const aiTestPatterns = [
    /eval/i, /hallucination/i, /groundedness/i, /toxicity/i,
    /faithfulness/i, /relevance.*score/i, /model.*quality/i,
    /prompt.*test/i, /llm.*test/i, /ai.*assert/i,
    /response.*quality/i, /generation.*test/i,
  ];
  let hasAiTests = false;
  let aiTestDetail = '';
  for (const file of testFilesSet) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      for (const pat of aiTestPatterns) {
        if (pat.test(content)) {
          hasAiTests = true;
          aiTestDetail = `${file} contains AI-specific test patterns (${pat.source})`;
          break;
        }
      }
      if (hasAiTests) break;
    } catch {
      // skip
    }
  }
  evidence.push({
    signal: 'AI-specific test patterns',
    found: hasAiTests,
    points: hasAiTests ? 2 : 0,
    detail: hasAiTests ? aiTestDetail : 'No AI-specific test patterns (eval, hallucination, groundedness)',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
