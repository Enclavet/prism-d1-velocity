import { CategoryScore, PRISMLevel, PRISMLevelInfo, ScanResult } from './types';
import * as path from 'path';

const LEVEL_MAP: Array<{ threshold: number; level: PRISMLevel; label: string; description: string }> = [
  { threshold: 96, level: 'L5.0', label: 'Autonomous', description: 'Agents contributing to architecture. >20% autonomous deployments.' },
  { threshold: 91, level: 'L4.5', label: 'Orchestrated+', description: 'Near-autonomous. Multi-agent governance mature.' },
  { threshold: 81, level: 'L4.0', label: 'Orchestrated', description: 'Multi-agent governance. Autonomy tiering. AI FinOps.' },
  { threshold: 71, level: 'L3.5', label: 'Integrated+', description: 'Strong integration with emerging orchestration patterns.' },
  { threshold: 56, level: 'L3.0', label: 'Integrated', description: 'Eval gates in CI/CD. First agentic workflow. AI SRE practices.' },
  { threshold: 41, level: 'L2.5', label: 'Structured+', description: 'Structured with emerging integration patterns.' },
  { threshold: 26, level: 'L2.0', label: 'Structured', description: 'AI tooling standardized. Spec-driven dev. Acceptance rate tracked.' },
  { threshold: 16, level: 'L1.5', label: 'Experimental+', description: 'Some AI tooling adoption, but not yet structured.' },
  { threshold: 0, level: 'L1.0', label: 'Experimental', description: 'Ad hoc AI use. No metrics. No shared tooling. Vibe coding.' },
];

export function computeLevel(totalScore: number): PRISMLevelInfo {
  for (const entry of LEVEL_MAP) {
    if (totalScore >= entry.threshold) {
      return { level: entry.level, label: entry.label, description: entry.description };
    }
  }
  return LEVEL_MAP[LEVEL_MAP.length - 1];
}

export function identifyStrengths(categories: CategoryScore[]): string[] {
  return categories
    .filter((c) => c.earnedPoints > 0)
    .sort((a, b) => {
      const ratioA = a.earnedPoints / a.maxPoints;
      const ratioB = b.earnedPoints / b.maxPoints;
      return ratioB - ratioA;
    })
    .slice(0, 3)
    .map((c) => `${c.category} (${c.earnedPoints}/${c.maxPoints})`);
}

export function identifyGaps(categories: CategoryScore[]): string[] {
  return categories
    .sort((a, b) => {
      const gapA = a.maxPoints - a.earnedPoints;
      const gapB = b.maxPoints - b.earnedPoints;
      if (gapB !== gapA) return gapB - gapA;
      // Tie-break: higher max points = bigger opportunity
      return b.maxPoints - a.maxPoints;
    })
    .filter((c) => c.earnedPoints < c.maxPoints)
    .slice(0, 3)
    .map((c) => {
      const pct = Math.round((c.earnedPoints / c.maxPoints) * 100);
      if (c.earnedPoints === 0) return `No ${c.category.toLowerCase()} signals detected (0/${c.maxPoints})`;
      return `Limited ${c.category.toLowerCase()} (${c.earnedPoints}/${c.maxPoints}, ${pct}%)`;
    });
}

const RECOMMENDATIONS: Record<string, string[]> = {
  'AI Tool Config': [
    'Add a CLAUDE.md file with spec-first enforcement rules',
    'Configure Kiro or other AI IDE tooling for the team',
  ],
  'Spec-Driven Dev': [
    'Create a specs/ directory and adopt spec templates from the PRISM bootstrapper',
    'Start PRISM Workshop Module 02 (Spec-Driven Development)',
  ],
  'Commit Hygiene': [
    'Add AI-Origin and AI-Model trailers to commit conventions',
    'Configure git hooks to enforce AI commit metadata',
  ],
  'CI/CD Integration': [
    'Add AI evaluation steps to your CI pipeline',
    'Deploy metrics emission (EventBridge/CloudWatch) from CI',
  ],
  'Eval & Quality': [
    'Start PRISM Workshop Module 04 (Eval Gates)',
    'Set up Bedrock Evaluation or promptfoo for automated eval',
  ],
  'Testing Maturity': [
    'Increase test coverage — aim for 0.3+ test-to-source ratio',
    'Add AI-specific test patterns (hallucination, groundedness checks)',
  ],
  'AI Observability': [
    'Deploy the PRISM metrics pipeline (CDK in infra/)',
    'Implement DORA metric tracking with AI-specific dimensions',
  ],
  'Governance': [
    'Configure Bedrock Guardrails for content filtering',
    'Define autonomy tiers for agent workflows',
  ],
  'Agent Workflows': [
    'Define your first agentic workflow with Bedrock Agents or Strands SDK',
    'Set up an MCP server for tool registration (@modelcontextprotocol)',
    'Deploy agents via AgentCore for managed runtime and scaling',
    'Add agent test suites and eval rubrics alongside unit tests',
    'Emit agent invocation metrics to the PRISM event bus (prism.d1.agent.*)',
  ],
  'Platform & Reuse': [
    'Create a shared prompt library for team reuse',
    'Set up a model gateway for centralized AI access',
  ],
  'Documentation': [
    'Document AI development guidelines for the team',
    'Create ADRs for AI-related architecture decisions',
  ],
  'Dependencies': [
    'Add AI SDKs (@anthropic-ai/sdk, @aws-sdk/client-bedrock-runtime)',
    'Evaluate additional AI tooling for your stack',
  ],
};

export function generateRecommendations(categories: CategoryScore[]): string[] {
  const gaps = categories
    .sort((a, b) => {
      const gapA = a.maxPoints - a.earnedPoints;
      const gapB = b.maxPoints - b.earnedPoints;
      return gapB - gapA;
    })
    .filter((c) => c.earnedPoints < c.maxPoints);

  const recs: string[] = [];
  for (const gap of gaps.slice(0, 3)) {
    const categoryRecs = RECOMMENDATIONS[gap.category];
    if (categoryRecs) {
      recs.push(categoryRecs[0]);
    }
  }
  return recs;
}

export function buildScanResult(repoPath: string, categories: CategoryScore[]): ScanResult {
  const totalScore = categories.reduce((sum, c) => sum + c.earnedPoints, 0);
  const maxScore = categories.reduce((sum, c) => sum + c.maxPoints, 0);
  const repoName = path.basename(path.resolve(repoPath));

  return {
    repoPath: path.resolve(repoPath),
    repoName,
    scanDate: new Date().toISOString().split('T')[0],
    totalScore,
    maxScore,
    prismLevel: computeLevel(totalScore),
    categories,
    strengths: identifyStrengths(categories),
    gaps: identifyGaps(categories),
    recommendations: generateRecommendations(categories),
  };
}
