import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'AI Observability';
const MAX_POINTS = 10;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  const allFiles = await glob('**/*.{ts,js,py,java,go,yaml,yml,json,tf,hcl}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'package-lock.json', 'yarn.lock', 'vendor/**'],
  }).catch(() => []);

  // Build a content cache for up to 200 files
  const contentCache: Map<string, string> = new Map();
  for (const file of allFiles.slice(0, 200)) {
    try {
      contentCache.set(file, fs.readFileSync(path.join(repoPath, file), 'utf-8'));
    } catch {
      // skip
    }
  }

  // CloudWatch, Timestream, or metrics config references (2 pts)
  const metricsPatterns = [
    /cloudwatch/i, /timestream/i, /prometheus/i, /grafana/i,
    /datadog/i, /new[_-]?relic/i, /put[_-]?metric/i,
    /metrics.*config/i, /observability/i, /opentelemetry/i, /otel/i,
  ];
  let hasMetricsRef = false;
  let metricsRefDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of metricsPatterns) {
      if (pat.test(content)) {
        hasMetricsRef = true;
        metricsRefDetail = `${file} references metrics infrastructure (${pat.source})`;
        break;
      }
    }
    if (hasMetricsRef) break;
  }
  evidence.push({
    signal: 'Metrics infrastructure references (CloudWatch, Timestream, etc.)',
    found: hasMetricsRef,
    points: hasMetricsRef ? 2 : 0,
    detail: hasMetricsRef ? metricsRefDetail : 'No metrics infrastructure references found',
  });

  // Custom metrics namespace for AI (3 pts)
  const aiMetricsPatterns = [
    /prism/i, /ai[_-]?metrics/i, /ai[_-]?namespace/i,
    /dora[_-]?metrics/i, /ai[_-]?telemetry/i,
    /llm[_-]?metrics/i, /model[_-]?metrics/i,
    /acceptance[_-]?rate/i, /ai[_-]?throughput/i,
    /token[_-]?usage/i, /token[_-]?count/i,
    /ai[_-]?latency/i, /inference[_-]?latency/i,
  ];
  let hasAiMetrics = false;
  let aiMetricsDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of aiMetricsPatterns) {
      if (pat.test(content)) {
        hasAiMetrics = true;
        aiMetricsDetail = `${file} contains AI-specific metrics (${pat.source})`;
        break;
      }
    }
    if (hasAiMetrics) break;
  }
  evidence.push({
    signal: 'Custom AI metrics namespace (PRISM, AI, DORA)',
    found: hasAiMetrics,
    points: hasAiMetrics ? 3 : 0,
    detail: hasAiMetrics ? aiMetricsDetail : 'No AI-specific metrics namespace found',
  });

  // Dashboard definitions (2 pts)
  const dashboardPatterns = [
    '**/dashboard*.{json,yaml,yml}',
    '**/grafana/**/*.{json,yaml,yml}',
    '**/*-dashboard*.{json,yaml,yml}',
    '**/dashboards/**',
    '**/cloudwatch-dashboard*',
  ];
  const dashboardFiles: string[] = [];
  for (const pattern of dashboardPatterns) {
    const matches = await glob(pattern, {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    }).catch(() => []);
    dashboardFiles.push(...matches);
  }
  const hasDashboards = dashboardFiles.length > 0;
  evidence.push({
    signal: 'Dashboard definitions exist',
    found: hasDashboards,
    points: hasDashboards ? 2 : 0,
    detail: hasDashboards
      ? `Found dashboard definitions: ${dashboardFiles.slice(0, 3).join(', ')}`
      : 'No dashboard definition files found',
  });

  // DORA metric tracking (3 pts)
  const doraPatterns = [
    /dora/i, /cycle[_-]?time/i, /lead[_-]?time/i,
    /deployment[_-]?frequency/i, /change[_-]?failure/i,
    /mttr/i, /mean[_-]?time[_-]?to[_-]?recover/i,
    /four[_-]?keys/i,
  ];
  let hasDora = false;
  let doraDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of doraPatterns) {
      if (pat.test(content)) {
        hasDora = true;
        doraDetail = `${file} references DORA metrics (${pat.source})`;
        break;
      }
    }
    if (hasDora) break;
  }
  evidence.push({
    signal: 'DORA metric tracking',
    found: hasDora,
    points: hasDora ? 3 : 0,
    detail: hasDora ? doraDetail : 'No DORA metric tracking found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
