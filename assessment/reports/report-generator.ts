/**
 * PRISM D1 Velocity -- Assessment Report Generator
 *
 * Generates customer-facing assessment reports in Markdown, JSON, and HTML.
 * Works standalone with no CDK or infrastructure dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  AssessmentResult,
  CustomerInfo,
  OnboardingPlan,
  ScannerCategoryScore,
  InterviewSectionScore,
} from '../onboarding/onboarding-router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatusColor = 'green' | 'amber' | 'red';

export interface CategoryStatus {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: StatusColor;
}

export interface GapEntry {
  rank: number;
  name: string;
  source: 'scanner' | 'interview';
  score: number;
  maxScore: number;
  percentage: number;
  remediation: string;
}

export interface StrengthEntry {
  rank: number;
  name: string;
  source: 'scanner' | 'interview';
  score: number;
  maxScore: number;
  percentage: number;
}

export interface ReportData {
  customer: CustomerInfo;
  assessmentDate: string;
  saName: string;
  repoAnalyzed: string;
  prismLevel: number;
  verdict: string;
  blendedScore: number;
  scannerTotal: number;
  interviewTotal: number;
  orgReadinessTotal: number;
  executiveSummary: string;
  scannerCategories: CategoryStatus[];
  interviewSections: (CategoryStatus & { keyFindings: string[] })[];
  gaps: GapEntry[];
  strengths: StrengthEntry[];
  onboardingPlan: OnboardingPlan;
}

export interface GeneratedReport {
  markdown: string;
  json: ReportData;
  html: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(percentage: number): StatusColor {
  if (percentage >= 70) return 'green';
  if (percentage >= 40) return 'amber';
  return 'red';
}

function statusEmoji(status: StatusColor): string {
  switch (status) {
    case 'green': return '[GREEN]';
    case 'amber': return '[AMBER]';
    case 'red': return '[RED]';
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'READY_FOR_PILOT': return 'Ready for Pilot';
    case 'NEEDS_FOUNDATIONS': return 'Needs Foundations';
    case 'NOT_QUALIFIED': return 'Not Qualified';
    default: return verdict;
  }
}

function levelBand(level: number): string {
  if (level < 2.0) return 'Emerging';
  if (level < 3.0) return 'Developing';
  if (level < 4.0) return 'Established';
  if (level < 5.0) return 'Advanced';
  return 'Optimized';
}

function generateNarrative(
  customer: CustomerInfo,
  level: number,
  verdict: string,
  gaps: GapEntry[],
  strengths: StrengthEntry[],
): string {
  const band = levelBand(level);
  const topGap = gaps[0]?.name ?? 'no specific area';
  const topStrength = strengths[0]?.name ?? 'general engineering practices';

  if (verdict === 'NEEDS_FOUNDATIONS') {
    return (
      `${customer.name} is in the early stages of AI-assisted development adoption, ` +
      `scoring at PRISM D1 Level ${level.toFixed(1)} (${band}). ` +
      `The team shows promise in ${topStrength}, but significant gaps remain in ` +
      `${topGap} and related areas. The recommended path is a Foundations engagement ` +
      `to establish standardized AI tooling, spec-driven workflows, and commit conventions ` +
      `before attempting a full pilot.`
    );
  }

  if (verdict === 'NOT_QUALIFIED') {
    return (
      `${customer.name} does not yet meet the prerequisites for a PRISM D1 engagement, ` +
      `scoring at Level ${level.toFixed(1)} (${band}). Fundamental engineering practices ` +
      `need to be established before AI-assisted development can be meaningfully measured ` +
      `and improved. A written recommendation document with prerequisites and a ` +
      `re-assessment timeline is provided below.`
    );
  }

  // READY_FOR_PILOT
  if (level >= 4.0) {
    return (
      `${customer.name} demonstrates mature AI-assisted development practices, ` +
      `scoring at PRISM D1 Level ${level.toFixed(1)} (${band}). ` +
      `Strong performance in ${topStrength} provides a solid base. ` +
      `Remaining opportunities for optimization center on ${topGap}. ` +
      `The team is well-positioned for an Advanced Optimization engagement focused on ` +
      `multi-agent governance, AI FinOps, and cross-pillar expansion.`
    );
  }

  if (level >= 3.0) {
    return (
      `${customer.name} has established solid AI-assisted development practices, ` +
      `scoring at PRISM D1 Level ${level.toFixed(1)} (${band}). ` +
      `The team excels in ${topStrength} but has specific gaps in ${topGap} ` +
      `that are holding back further progress. An Accelerated engagement targeting ` +
      `these gaps should move the team to L3.5+ within 8 weeks.`
    );
  }

  return (
    `${customer.name} has developing AI-assisted development practices, ` +
    `scoring at PRISM D1 Level ${level.toFixed(1)} (${band}). ` +
    `The team has a foundation in ${topStrength}, which provides a strong starting ` +
    `point. Key areas for improvement include ${topGap}. ` +
    `A Full Workshop engagement with all six modules plus an 8-week pilot ` +
    `is recommended to reach L3.0+.`
  );
}

const REMEDIATION_MAP: Record<string, string> = {
  'AI Tool Config': 'Deploy standardized CLAUDE.md across all repositories. Configure Bedrock access for every developer. Establish tool version pinning policy.',
  'Spec-Driven Dev': 'Adopt the three spec types (feature, bug fix, refactor) as mandatory pre-work for AI-assisted tasks. Train the team on spec authoring.',
  'Commit Hygiene': 'Deploy git hooks for AI-Origin and AI-Confidence trailers. Establish commit message conventions. Run retroactive trailer analysis.',
  'CI/CD Integration': 'Add Bedrock Evaluation step to the primary PR pipeline. Define pass/fail quality thresholds. Enable automated eval reporting.',
  'Eval & Quality': 'Define quality rubrics for AI-generated code. Implement automated scoring. Establish minimum acceptance thresholds.',
  'Testing Maturity': 'Increase test coverage targets for AI-generated code. Add test quality review to PR checklist. Implement mutation testing.',
  'AI Observability': 'Deploy the EventBridge-Timestream metrics pipeline. Enable token tracking, cost attribution, and latency monitoring.',
  'Governance': 'Create an AI usage governance charter. Define approval workflows for agent autonomy levels. Document data handling policies.',
  'Agent Workflows': 'Identify the first candidate for a multi-step agent workflow. Start with a low-risk internal automation. Document the workflow pattern.',
  'Platform Reuse': 'Audit for reusable AI components. Create a shared prompt library. Establish a pattern catalog for common AI-assisted tasks.',
  'Documentation': 'Add AI-assisted documentation generation to the build process. Define doc quality standards. Review existing docs for AI coverage.',
  'Dependencies': 'Audit AI-related dependencies for version pinning and license compliance. Document the update policy. Remove unused packages.',
  'AI Tooling Landscape': 'Standardize on an approved tool set. Create an onboarding guide for AI tools. Eliminate shadow AI usage with sanctioned alternatives.',
  'Development Workflow & Specs': 'Map AI touchpoints across the SDLC. Formalize the spec-driven workflow. Ensure every AI-assisted task starts with a spec.',
  'CI/CD & Quality': 'Integrate eval gates into all active pipelines. Define quality baselines. Establish trend monitoring for pass rates.',
  'Metrics & Visibility': 'Deploy the executive dashboard. Define key metrics (acceptance rate, cost per commit, eval pass rate). Establish weekly review cadence.',
  'Governance & Security': 'Draft an AI governance charter. Address data residency and PII concerns. Define security review requirements for AI-generated code.',
  'Org & Culture': 'Run team enablement workshops. Create an internal AI champions program. Celebrate and publicize early wins.',
};

function remediationFor(name: string): string {
  return REMEDIATION_MAP[name] ?? 'Develop a targeted improvement plan with your SA during the onboarding workshop.';
}

// ---------------------------------------------------------------------------
// Report data builder
// ---------------------------------------------------------------------------

function buildReportData(
  assessment: AssessmentResult,
  customer: CustomerInfo,
  plan: OnboardingPlan,
): ReportData {
  const scannerCategories: CategoryStatus[] = assessment.scannerScores.map((s) => {
    const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 100;
    return { id: s.id, name: s.name, score: s.score, maxScore: s.maxScore, percentage: pct, status: statusColor(pct) };
  });

  const interviewSections = assessment.interviewScores.map((s) => {
    const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 100;
    return {
      id: s.id, name: s.name, score: s.score, maxScore: s.maxScore,
      percentage: pct, status: statusColor(pct), keyFindings: s.keyFindings,
    };
  });

  // Build combined list for gap/strength analysis
  const combined: { name: string; source: 'scanner' | 'interview'; score: number; maxScore: number; percentage: number }[] = [];
  for (const s of scannerCategories) combined.push({ name: s.name, source: 'scanner', score: s.score, maxScore: s.maxScore, percentage: s.percentage });
  for (const s of interviewSections) combined.push({ name: s.name, source: 'interview', score: s.score, maxScore: s.maxScore, percentage: s.percentage });

  const sorted = [...combined].sort((a, b) => a.percentage - b.percentage);
  const gaps: GapEntry[] = sorted.slice(0, 5).map((g, i) => ({
    rank: i + 1, name: g.name, source: g.source, score: g.score,
    maxScore: g.maxScore, percentage: g.percentage, remediation: remediationFor(g.name),
  }));

  const strengthsSorted = [...combined].sort((a, b) => b.percentage - a.percentage);
  const strengths: StrengthEntry[] = strengthsSorted.slice(0, 3).map((s, i) => ({
    rank: i + 1, name: s.name, source: s.source, score: s.score,
    maxScore: s.maxScore, percentage: s.percentage,
  }));

  const narrative = generateNarrative(customer, assessment.prismLevel, assessment.verdict, gaps, strengths);

  return {
    customer,
    assessmentDate: assessment.assessmentDate,
    saName: assessment.saName,
    repoAnalyzed: assessment.repoAnalyzed,
    prismLevel: assessment.prismLevel,
    verdict: assessment.verdict,
    blendedScore: assessment.blendedScore,
    scannerTotal: assessment.scannerTotal,
    interviewTotal: assessment.interviewTotal,
    orgReadinessTotal: assessment.orgReadiness.totalScore,
    executiveSummary: narrative,
    scannerCategories,
    interviewSections,
    gaps,
    strengths,
    onboardingPlan: plan,
  };
}

// ---------------------------------------------------------------------------
// ASCII radar chart
// ---------------------------------------------------------------------------

function asciiRadarChart(categories: CategoryStatus[]): string {
  const maxWidth = 30;
  const lines: string[] = ['```'];
  lines.push('PRISM D1 Scanner -- Category Scores');
  lines.push('=' .repeat(55));

  for (const cat of categories) {
    const barLen = Math.round((cat.percentage / 100) * maxWidth);
    const bar = '#'.repeat(barLen) + '.'.repeat(maxWidth - barLen);
    const label = cat.name.padEnd(20);
    const pctStr = `${cat.percentage}%`.padStart(4);
    const indicator = cat.status === 'green' ? '+' : cat.status === 'amber' ? '~' : '!';
    lines.push(`${label} [${bar}] ${pctStr} ${indicator}`);
  }

  lines.push('=' .repeat(55));
  lines.push('+ = Green (70%+)  ~ = Amber (40-69%)  ! = Red (<40%)');
  lines.push('```');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SVG radar chart
// ---------------------------------------------------------------------------

function svgRadarChart(categories: CategoryStatus[]): string {
  const cx = 200;
  const cy = 200;
  const maxR = 160;
  const n = categories.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid circles
  const gridCircles = [0.25, 0.5, 0.75, 1.0]
    .map((r) => `<circle cx="${cx}" cy="${cy}" r="${Math.round(maxR * r)}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`)
    .join('\n    ');

  // Grid labels
  const gridLabels = [25, 50, 75, 100]
    .map((v, i) => {
      const r = maxR * ((i + 1) / 4);
      return `<text x="${cx + 4}" y="${cy - r + 4}" font-size="10" fill="#94a3b8">${v}%</text>`;
    })
    .join('\n    ');

  // Axis lines and labels
  const axes: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x2 = cx + maxR * Math.cos(angle);
    const y2 = cy + maxR * Math.sin(angle);
    axes.push(`<line x1="${cx}" y1="${cy}" x2="${Math.round(x2)}" y2="${Math.round(y2)}" stroke="#e2e8f0" stroke-width="1"/>`);

    const lx = cx + (maxR + 30) * Math.cos(angle);
    const ly = cy + (maxR + 30) * Math.sin(angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    labels.push(`<text x="${Math.round(lx)}" y="${Math.round(ly)}" font-size="11" fill="#334155" text-anchor="${anchor}" dominant-baseline="middle">${categories[i].name}</text>`);
  }

  // Data polygon
  const points = categories.map((cat, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (cat.percentage / 100) * maxR;
    return `${Math.round(cx + r * Math.cos(angle))},${Math.round(cy + r * Math.sin(angle))}`;
  }).join(' ');

  // Data dots
  const dots = categories.map((cat, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (cat.percentage / 100) * maxR;
    const x = Math.round(cx + r * Math.cos(angle));
    const y = Math.round(cy + r * Math.sin(angle));
    const color = cat.status === 'green' ? '#22c55e' : cat.status === 'amber' ? '#f59e0b' : '#ef4444';
    return `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  }).join('\n    ');

  return `<svg viewBox="0 0 460 460" xmlns="http://www.w3.org/2000/svg" style="max-width:460px;width:100%">
    <rect width="460" height="460" fill="#fafbfc" rx="8"/>
    ${gridCircles}
    ${gridLabels}
    ${axes.join('\n    ')}
    <polygon points="${points}" fill="rgba(0,102,255,0.15)" stroke="#0066ff" stroke-width="2"/>
    ${dots}
    ${labels.join('\n    ')}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Markdown generator
// ---------------------------------------------------------------------------

function generateMarkdown(data: ReportData): string {
  const {
    customer, assessmentDate, saName, repoAnalyzed, prismLevel, verdict,
    blendedScore, scannerTotal, interviewTotal, orgReadinessTotal,
    executiveSummary, scannerCategories, interviewSections, gaps, strengths,
    onboardingPlan,
  } = data;

  const lines: string[] = [];

  // Header
  lines.push(`# PRISM D1 Velocity Assessment Report`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Customer | ${customer.name} |`);
  lines.push(`| Team Size | ${customer.teamSize} |`);
  lines.push(`| Funding Stage | ${customer.fundingStage} |`);
  lines.push(`| Assessment Date | ${assessmentDate} |`);
  lines.push(`| Solutions Architect | ${saName} |`);
  lines.push(`| Repository Analyzed | \`${repoAnalyzed}\` |`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`**PRISM D1 Level: ${prismLevel.toFixed(1)} (${levelBand(prismLevel)})**`);
  lines.push(`**Verdict: ${verdictLabel(verdict)}**`);
  lines.push('');
  lines.push(executiveSummary);
  lines.push('');

  lines.push('| Component | Score | Weight |');
  lines.push('|-----------|-------|--------|');
  lines.push(`| Scanner (automated) | ${scannerTotal}/100 | 40% |`);
  lines.push(`| Interview (structured) | ${interviewTotal}/100 | 40% |`);
  lines.push(`| Org Readiness | ${orgReadinessTotal}/20 | 20% |`);
  lines.push(`| **Blended Score** | **${blendedScore.toFixed(1)}** | |`);
  lines.push('');

  // Radar chart
  lines.push('## Scanner Category Breakdown');
  lines.push('');
  lines.push(asciiRadarChart(scannerCategories));
  lines.push('');

  lines.push('| Category | Score | Max | Pct | Status |');
  lines.push('|----------|-------|-----|-----|--------|');
  for (const cat of scannerCategories) {
    lines.push(`| ${cat.name} | ${cat.score} | ${cat.maxScore} | ${cat.percentage}% | ${statusEmoji(cat.status)} |`);
  }
  lines.push('');

  // Interview summary
  lines.push('## Interview Summary');
  lines.push('');
  lines.push('| Section | Score | Max | Pct | Status |');
  lines.push('|---------|-------|-----|-----|--------|');
  for (const sec of interviewSections) {
    lines.push(`| ${sec.name} | ${sec.score} | ${sec.maxScore} | ${sec.percentage}% | ${statusEmoji(sec.status)} |`);
  }
  lines.push('');

  for (const sec of interviewSections) {
    lines.push(`<details>`);
    lines.push(`<summary><strong>${sec.name}</strong> (${sec.score}/${sec.maxScore})</summary>`);
    lines.push('');
    for (const finding of sec.keyFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Gap Analysis
  lines.push('## Gap Analysis');
  lines.push('');
  lines.push('The following areas represent the largest opportunities for improvement:');
  lines.push('');
  lines.push('| Rank | Area | Source | Score | Remediation |');
  lines.push('|------|------|--------|-------|-------------|');
  for (const gap of gaps) {
    lines.push(`| ${gap.rank} | ${gap.name} | ${gap.source} | ${gap.score}/${gap.maxScore} (${gap.percentage}%) | ${gap.remediation.split('.')[0]}. |`);
  }
  lines.push('');

  // Strengths
  lines.push('## Strengths');
  lines.push('');
  lines.push('Build on these existing capabilities:');
  lines.push('');
  for (const s of strengths) {
    lines.push(`${s.rank}. **${s.name}** (${s.source}) -- ${s.score}/${s.maxScore} (${s.percentage}%)`);
  }
  lines.push('');

  // Onboarding Recommendation
  lines.push('## Onboarding Recommendation');
  lines.push('');
  lines.push(`**Track ${onboardingPlan.track}: ${onboardingPlan.trackName}**`);
  lines.push('');
  lines.push('### Workshop Modules');
  lines.push('');
  lines.push('| Module | Included | Reason |');
  lines.push('|--------|----------|--------|');
  for (const mod of onboardingPlan.workshopModules) {
    lines.push(`| ${mod.id} -- ${mod.name} | ${mod.included ? 'Yes' : 'No'} | ${mod.reason} |`);
  }
  lines.push('');

  // 90-Day Roadmap
  lines.push('## 90-Day Roadmap');
  lines.push('');
  lines.push('| Week | Milestone | Measurable |');
  lines.push('|------|-----------|------------|');
  for (const m of onboardingPlan.milestones) {
    lines.push(`| ${m.week} | ${m.milestone} | ${m.measurable} |`);
  }
  lines.push('');

  // Success Metrics
  lines.push('## Success Metrics');
  lines.push('');
  lines.push('| Metric | Target | Measure By |');
  lines.push('|--------|--------|------------|');
  for (const sm of onboardingPlan.successMetrics) {
    lines.push(`| ${sm.metric} | ${sm.target} | ${sm.measureBy} |`);
  }
  lines.push('');

  // Appendix
  lines.push('## Appendix: Scanner Evidence');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand full scanner evidence</summary>');
  lines.push('');
  lines.push('| Category | Score | Details |');
  lines.push('|----------|-------|---------|');
  for (const cat of scannerCategories) {
    lines.push(`| ${cat.name} | ${cat.score}/${cat.maxScore} | Automated analysis of repository artifacts |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  lines.push('---');
  lines.push(`*Report generated by PRISM D1 Velocity Assessment Engine on ${assessmentDate}.*`);
  lines.push(`*Solutions Architect: ${saName}*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTML generator
// ---------------------------------------------------------------------------

function generateHtml(data: ReportData): string {
  const {
    customer, assessmentDate, saName, repoAnalyzed, prismLevel, verdict,
    blendedScore, scannerTotal, interviewTotal, orgReadinessTotal,
    executiveSummary, scannerCategories, interviewSections, gaps, strengths,
    onboardingPlan,
  } = data;

  const svgChart = svgRadarChart(scannerCategories);

  const statusBadge = (status: StatusColor): string => {
    const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
    return `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colors[status]};margin-right:6px;vertical-align:middle;"></span>`;
  };

  const verdictBadgeColor = verdict === 'READY_FOR_PILOT' ? '#22c55e' : verdict === 'NEEDS_FOUNDATIONS' ? '#f59e0b' : '#ef4444';

  const scannerRows = scannerCategories.map((cat) =>
    `<tr>
      <td>${statusBadge(cat.status)}${cat.name}</td>
      <td style="text-align:center">${cat.score}</td>
      <td style="text-align:center">${cat.maxScore}</td>
      <td style="text-align:center">${cat.percentage}%</td>
      <td><div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%"><div style="background:${cat.status === 'green' ? '#22c55e' : cat.status === 'amber' ? '#f59e0b' : '#ef4444'};border-radius:4px;height:8px;width:${cat.percentage}%"></div></div></td>
    </tr>`
  ).join('\n');

  const interviewRows = interviewSections.map((sec) =>
    `<tr>
      <td>${statusBadge(sec.status)}${sec.name}</td>
      <td style="text-align:center">${sec.score}</td>
      <td style="text-align:center">${sec.maxScore}</td>
      <td style="text-align:center">${sec.percentage}%</td>
      <td><ul style="margin:4px 0;padding-left:18px;font-size:13px;color:#475569">${sec.keyFindings.map((f) => `<li>${f}</li>`).join('')}</ul></td>
    </tr>`
  ).join('\n');

  const gapRows = gaps.map((g) =>
    `<tr>
      <td style="text-align:center;font-weight:600">${g.rank}</td>
      <td>${g.name}</td>
      <td style="text-align:center;text-transform:capitalize">${g.source}</td>
      <td style="text-align:center">${g.score}/${g.maxScore} (${g.percentage}%)</td>
      <td style="font-size:13px">${g.remediation}</td>
    </tr>`
  ).join('\n');

  const strengthRows = strengths.map((s) =>
    `<tr>
      <td style="text-align:center;font-weight:600">${s.rank}</td>
      <td>${s.name}</td>
      <td style="text-align:center;text-transform:capitalize">${s.source}</td>
      <td style="text-align:center">${s.score}/${s.maxScore} (${s.percentage}%)</td>
    </tr>`
  ).join('\n');

  const moduleRows = onboardingPlan.workshopModules.map((mod) =>
    `<tr>
      <td><code>${mod.id}</code></td>
      <td>${mod.name}</td>
      <td style="text-align:center">${mod.included ? '<span style="color:#22c55e;font-weight:700">Yes</span>' : '<span style="color:#94a3b8">No</span>'}</td>
      <td style="font-size:13px">${mod.reason}</td>
    </tr>`
  ).join('\n');

  const milestoneRows = onboardingPlan.milestones.map((m) =>
    `<tr>
      <td style="text-align:center;font-weight:600">Week ${m.week}</td>
      <td>${m.milestone}</td>
      <td style="font-size:13px">${m.measurable}</td>
    </tr>`
  ).join('\n');

  const metricsRows = onboardingPlan.successMetrics.map((sm) =>
    `<tr>
      <td>${sm.metric}</td>
      <td style="font-weight:600">${sm.target}</td>
      <td>${sm.measureBy}</td>
    </tr>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRISM D1 Assessment -- ${customer.name}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
  .header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: #fff;
    padding: 48px 40px;
    border-radius: 12px;
    margin-bottom: 32px;
  }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .header .subtitle { font-size: 15px; color: #94a3b8; margin-bottom: 24px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; font-size: 14px; }
  .header-grid .label { color: #94a3b8; }
  .header-grid .value { color: #e2e8f0; font-weight: 500; }
  .card {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    padding: 32px;
    margin-bottom: 24px;
  }
  .card h2 {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e2e8f0;
  }
  .level-display {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 20px;
  }
  .level-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    color: #fff;
    font-size: 28px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .verdict-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: ${verdictBadgeColor};
  }
  .scores-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 20px;
  }
  .score-card {
    background: #f8fafc;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .score-card .score-value { font-size: 32px; font-weight: 800; color: #0066ff; }
  .score-card .score-max { font-size: 14px; color: #94a3b8; }
  .score-card .score-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th {
    background: #f1f5f9;
    color: #475569;
    font-weight: 600;
    text-align: left;
    padding: 10px 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .radar-container { text-align: center; margin: 20px 0; }
  .narrative { font-size: 15px; color: #334155; line-height: 1.7; }
  .track-badge {
    display: inline-block;
    padding: 6px 18px;
    border-radius: 6px;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
  }
  .footer {
    text-align: center;
    padding: 24px;
    color: #94a3b8;
    font-size: 13px;
  }
  @media print {
    body { background: #fff; }
    .page { padding: 0; max-width: 100%; }
    .header { border-radius: 0; margin-bottom: 20px; padding: 24px 32px; }
    .card { box-shadow: none; border: 1px solid #e2e8f0; break-inside: avoid; margin-bottom: 16px; padding: 20px; }
    .card h2 { font-size: 16px; }
    table { font-size: 12px; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1>PRISM D1 Velocity Assessment</h1>
    <div class="subtitle">AI-Assisted Development Maturity Report</div>
    <div class="header-grid">
      <div><span class="label">Customer</span></div><div><span class="value">${customer.name}</span></div>
      <div><span class="label">Team Size</span></div><div><span class="value">${customer.teamSize} engineers</span></div>
      <div><span class="label">Funding Stage</span></div><div><span class="value">${customer.fundingStage}</span></div>
      <div><span class="label">Assessment Date</span></div><div><span class="value">${assessmentDate}</span></div>
      <div><span class="label">Solutions Architect</span></div><div><span class="value">${saName}</span></div>
      <div><span class="label">Repository</span></div><div><span class="value" style="font-family:monospace;font-size:13px">${repoAnalyzed}</span></div>
    </div>
  </div>

  <div class="card">
    <h2>Executive Summary</h2>
    <div class="level-display">
      <div class="level-badge">L${prismLevel.toFixed(1)}</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:#1a1a2e">PRISM D1 Level ${prismLevel.toFixed(1)}</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:6px">${levelBand(prismLevel)}</div>
        <span class="verdict-badge">${verdictLabel(verdict)}</span>
      </div>
    </div>
    <p class="narrative">${executiveSummary}</p>
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-value">${scannerTotal}</div>
        <div class="score-max">/ 100</div>
        <div class="score-label">Scanner Score (40%)</div>
      </div>
      <div class="score-card">
        <div class="score-value">${interviewTotal}</div>
        <div class="score-max">/ 100</div>
        <div class="score-label">Interview Score (40%)</div>
      </div>
      <div class="score-card">
        <div class="score-value">${orgReadinessTotal}</div>
        <div class="score-max">/ 20</div>
        <div class="score-label">Org Readiness (20%)</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Scanner Category Breakdown</h2>
    <div class="radar-container">
      ${svgChart}
    </div>
    <table>
      <thead><tr><th>Category</th><th style="text-align:center">Score</th><th style="text-align:center">Max</th><th style="text-align:center">Pct</th><th>Progress</th></tr></thead>
      <tbody>${scannerRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Interview Summary</h2>
    <table>
      <thead><tr><th>Section</th><th style="text-align:center">Score</th><th style="text-align:center">Max</th><th style="text-align:center">Pct</th><th>Key Findings</th></tr></thead>
      <tbody>${interviewRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Gap Analysis</h2>
    <p style="color:#64748b;font-size:14px;margin-bottom:16px">Top 5 areas with the largest opportunity for improvement:</p>
    <table>
      <thead><tr><th style="text-align:center">Rank</th><th>Area</th><th style="text-align:center">Source</th><th style="text-align:center">Score</th><th>Recommended Action</th></tr></thead>
      <tbody>${gapRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Strengths</h2>
    <p style="color:#64748b;font-size:14px;margin-bottom:16px">Top 3 capabilities to build on:</p>
    <table>
      <thead><tr><th style="text-align:center">Rank</th><th>Area</th><th style="text-align:center">Source</th><th style="text-align:center">Score</th></tr></thead>
      <tbody>${strengthRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Onboarding Recommendation</h2>
    <div style="margin-bottom:20px">
      <span class="track-badge">Track ${onboardingPlan.track}: ${onboardingPlan.trackName}</span>
    </div>
    <h3 style="font-size:16px;margin-bottom:12px;color:#1a1a2e">Workshop Modules</h3>
    <table>
      <thead><tr><th>Module</th><th>Name</th><th style="text-align:center">Included</th><th>Reason</th></tr></thead>
      <tbody>${moduleRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>90-Day Roadmap</h2>
    <table>
      <thead><tr><th style="text-align:center">When</th><th>Milestone</th><th>Measurable Outcome</th></tr></thead>
      <tbody>${milestoneRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Success Metrics</h2>
    <table>
      <thead><tr><th>Metric</th><th>Target</th><th>Measure By</th></tr></thead>
      <tbody>${metricsRows}</tbody>
    </table>
  </div>

  <div class="footer">
    <p>PRISM D1 Velocity Assessment Report &mdash; Generated ${assessmentDate}</p>
    <p>Solutions Architect: ${saName}</p>
  </div>

</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template-based generators (read template files and substitute placeholders)
// ---------------------------------------------------------------------------

function applyTemplate(template: string, data: ReportData): string {
  const replacements: Record<string, string> = {
    '{{CUSTOMER_NAME}}': data.customer.name,
    '{{TEAM_SIZE}}': String(data.customer.teamSize),
    '{{FUNDING_STAGE}}': data.customer.fundingStage,
    '{{ASSESSMENT_DATE}}': data.assessmentDate,
    '{{SA_NAME}}': data.saName,
    '{{REPO_ANALYZED}}': data.repoAnalyzed,
    '{{PRISM_LEVEL}}': data.prismLevel.toFixed(1),
    '{{LEVEL_BAND}}': levelBand(data.prismLevel),
    '{{VERDICT}}': verdictLabel(data.verdict),
    '{{VERDICT_RAW}}': data.verdict,
    '{{BLENDED_SCORE}}': data.blendedScore.toFixed(1),
    '{{SCANNER_TOTAL}}': String(data.scannerTotal),
    '{{INTERVIEW_TOTAL}}': String(data.interviewTotal),
    '{{ORG_READINESS_TOTAL}}': String(data.orgReadinessTotal),
    '{{EXECUTIVE_SUMMARY}}': data.executiveSummary,
    '{{TRACK_LETTER}}': data.onboardingPlan.track,
    '{{TRACK_NAME}}': data.onboardingPlan.trackName,
    '{{RADAR_CHART_ASCII}}': asciiRadarChart(data.scannerCategories),
    '{{RADAR_CHART_SVG}}': svgRadarChart(data.scannerCategories),
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete assessment report in all three formats.
 */
export function generateReport(
  assessment: AssessmentResult,
  customer: CustomerInfo,
  plan: OnboardingPlan,
): GeneratedReport {
  const data = buildReportData(assessment, customer, plan);

  // Try to load templates; fall back to programmatic generation
  let markdown: string;
  let html: string;

  const mdTemplatePath = path.join(__dirname, 'templates', 'assessment-report.md');
  const htmlTemplatePath = path.join(__dirname, 'templates', 'assessment-report.html');

  try {
    const mdTemplate = fs.readFileSync(mdTemplatePath, 'utf-8');
    markdown = applyTemplate(mdTemplate, data);
  } catch {
    markdown = generateMarkdown(data);
  }

  try {
    const htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf-8');
    html = applyTemplate(htmlTemplate, data);
  } catch {
    html = generateHtml(data);
  }

  return {
    markdown,
    json: data,
    html,
  };
}

/**
 * Generate reports using only programmatic generation (no template files needed).
 */
export function generateReportDirect(
  assessment: AssessmentResult,
  customer: CustomerInfo,
  plan: OnboardingPlan,
): GeneratedReport {
  const data = buildReportData(assessment, customer, plan);

  return {
    markdown: generateMarkdown(data),
    json: data,
    html: generateHtml(data),
  };
}
