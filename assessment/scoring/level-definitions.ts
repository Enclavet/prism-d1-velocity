/**
 * PRISM D1 Velocity -- Level Definitions
 *
 * Detailed definitions for each PRISM D1 maturity level, including
 * observable evidence, expected metric ranges, typical gaps, and
 * recommended PRISM modules.
 */

export interface LevelDefinition {
  level: string;
  name: string;
  blendedScoreRange: [number, number];
  description: string;
  observableEvidence: string[];
  expectedMetrics: Record<string, string>;
  typicalGapsToNextLevel: string[];
  recommendedModules: string[];
}

export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  {
    level: 'L1.0',
    name: 'No AI Adoption',
    blendedScoreRange: [0, 10],
    description:
      'The organization has no meaningful AI tooling in the software development lifecycle. ' +
      'Engineers may be aware of AI tools but have not adopted them in any structured way.',
    observableEvidence: [
      'No AI coding tools (Copilot, Cursor, Amazon Q) in use',
      'No AI-related configuration files in repositories',
      'No AI mentions in CI/CD pipelines or commit history',
      'Engineers may use ChatGPT ad hoc for questions but not for code generation',
      'No exec awareness or sponsorship of AI in engineering',
    ],
    expectedMetrics: {
      aiToolAdoption: '0-10% of engineers',
      aiCommitAttribution: 'None',
      deployFrequency: 'Varies (not AI-related)',
      aiSpecificMetrics: 'None tracked',
    },
    typicalGapsToNextLevel: [
      'No AI tool licenses or budget',
      'No awareness of what AI tools can do for engineering velocity',
      'No champion or advocate for AI adoption',
      'Security concerns unaddressed (blocking adoption)',
      'Leadership does not see AI in engineering as a priority',
    ],
    recommendedModules: [
      'Module 00: AI Engineering Foundations (awareness + first tool deployment)',
    ],
  },

  {
    level: 'L1.5',
    name: 'Early Experimentation',
    blendedScoreRange: [11, 20],
    description:
      'A subset of engineers are experimenting with AI tools, primarily for code completion. ' +
      'Adoption is grassroots, with no standardization or measurement.',
    observableEvidence: [
      'Some engineers have Copilot or similar tools installed (often self-funded)',
      'AI usage is limited to inline code completion',
      'No shared configuration or prompt libraries',
      'No AI-specific CI/CD steps',
      'No metrics on AI tool usage or impact',
      'Occasional AI mentions in Slack/discussions but not in processes',
    ],
    expectedMetrics: {
      aiToolAdoption: '10-30% of engineers (mostly self-selected early adopters)',
      aiCommitAttribution: 'None or rare',
      copilotAcceptanceRate: 'Unknown (not tracked)',
      aiSpecificMetrics: 'None tracked',
    },
    typicalGapsToNextLevel: [
      'No company-wide tool license (engineers paying out of pocket or using free tiers)',
      'No evaluation or approval process for AI tools',
      'No shared configuration or best practices',
      'No measurement of AI tool effectiveness',
      'Adoption depends on individual enthusiasm, not organizational strategy',
    ],
    recommendedModules: [
      'Module 00: AI Engineering Foundations',
      'Module 01: Tool Standardization & Governance',
    ],
  },

  {
    level: 'L2.0',
    name: 'Emerging Standardization',
    blendedScoreRange: [21, 30],
    description:
      'The organization has standardized on primary AI tools and has basic governance. ' +
      'Most engineers use AI for code completion, and some are experimenting with broader use cases.',
    observableEvidence: [
      'Company-wide license for at least one AI coding tool',
      'Basic tool governance (approved tool list, security review)',
      'Some shared configuration (e.g., team-wide Copilot settings)',
      'AI used primarily in coding phase, with some experimentation in testing',
      'Basic awareness of AI code quality but no systematic measurement',
      'Some engineers starting to use AI for PR descriptions or test generation',
    ],
    expectedMetrics: {
      aiToolAdoption: '40-60% weekly active usage',
      copilotAcceptanceRate: '15-25%',
      aiCommitAttribution: 'Rare or inconsistent',
      deployFrequency: 'Weekly to daily (not necessarily AI-driven)',
    },
    typicalGapsToNextLevel: [
      'AI not involved in design/spec phase (only used during coding)',
      'No AI attribution in commits or PRs',
      'No AI-specific validation in CI/CD',
      'No measurement of AI impact on velocity or quality',
      'Specs and design docs not AI-consumable',
    ],
    recommendedModules: [
      'Module 01: Tool Standardization & Governance',
      'Module 02: Spec-Driven Development',
      'Module 03: AI-Augmented CI/CD',
    ],
  },

  {
    level: 'L2.5',
    name: 'Structured Adoption',
    blendedScoreRange: [31, 40],
    description:
      'AI tools are broadly adopted with governance. The organization is starting to use AI ' +
      'beyond code completion -- in spec writing, testing, and PR review. Basic metrics exist.',
    observableEvidence: [
      'Standardized AI toolchain with shared configuration',
      'Some engineers using AI for spec drafting and design exploration',
      'AI-generated tests appearing in PRs',
      'Basic AI attribution in some PRs (manual convention)',
      'Some quality awareness (review extra care for AI code)',
      'Leadership aware of AI adoption, considering budget',
    ],
    expectedMetrics: {
      aiToolAdoption: '60-75% weekly active usage',
      copilotAcceptanceRate: '20-30%',
      aiCommitAttribution: 'Inconsistent (convention exists but not enforced)',
      aiDefectTracking: 'Anecdotal',
    },
    typicalGapsToNextLevel: [
      'Specs not structured enough to be effective AI context',
      'AI attribution not enforced or automated',
      'No eval gates in CI/CD for AI-generated code',
      'Metrics exist but are not AI-dimensioned',
      'No dedicated AI/platform owner',
    ],
    recommendedModules: [
      'Module 02: Spec-Driven Development',
      'Module 03: AI-Augmented CI/CD',
      'Module 04: AI Metrics & Visibility',
    ],
  },

  {
    level: 'L3.0',
    name: 'Integrated AI Workflows',
    blendedScoreRange: [41, 50],
    description:
      'AI is integrated across the development lifecycle -- from specs to deployment. ' +
      'The organization has AI-specific CI/CD steps, tracks AI metrics, and has clear governance.',
    observableEvidence: [
      'Spec-driven development with AI participation in spec phase',
      'Consistent AI attribution in commits and PRs',
      'AI-specific validation steps in CI/CD pipeline',
      'Engineering metrics include AI dimensions (acceptance rate, AI commit ratio)',
      'Documented guardrails and autonomy tiers for AI tools',
      'Dedicated owner or team responsible for AI engineering practices',
      'New engineer onboarding includes AI toolchain setup',
    ],
    expectedMetrics: {
      aiToolAdoption: '75-90% weekly active usage',
      copilotAcceptanceRate: '25-35%',
      aiCommitAttribution: 'Consistent, approaching automated',
      aiDefectRate: 'Tracked, comparable to human code',
      doraMetrics: 'Tracked with AI impact awareness',
    },
    typicalGapsToNextLevel: [
      'Eval gates exist but are basic (not using sophisticated evaluation frameworks)',
      'Metrics tracked but not yet driving decisions',
      'ROI reporting is periodic but not quantified rigorously',
      'Guardrails documented but not all enforced by tooling',
      'AI bug tracking exists but feedback loop to prompt engineering is informal',
    ],
    recommendedModules: [
      'Module 04: AI Metrics & Visibility',
      'Module 05: Eval Gates & Quality',
      'Module 06: Advanced Governance',
    ],
  },

  {
    level: 'L3.5',
    name: 'Measured and Optimized',
    blendedScoreRange: [51, 60],
    description:
      'AI usage is measured and the data drives optimization. The organization can demonstrate ' +
      'AI ROI with data, has sophisticated eval gates, and uses metrics to continuously improve.',
    observableEvidence: [
      'Dashboards showing AI contribution metrics in real time',
      'Eval gates using Bedrock Evaluations or equivalent frameworks',
      'AI defect rates tracked and compared to human code',
      'ROI reporting with quantified metrics delivered to leadership',
      'Feedback loops: AI quality data informs prompt engineering and tooling decisions',
      'AI incident response process documented and tested',
      'AI onboarding includes codebase-specific prompt libraries',
    ],
    expectedMetrics: {
      aiToolAdoption: '85-95% weekly active usage',
      copilotAcceptanceRate: '30-40%',
      aiCommitAttribution: 'Automated',
      aiDefectRate: 'Tracked, trending down, below human rate for common tasks',
      doraMetrics: 'AI-attributed improvements demonstrated',
      aiRoi: 'Quantified and reported quarterly or monthly',
    },
    typicalGapsToNextLevel: [
      'Agentic workflows still limited to coding tasks (not full lifecycle)',
      'AI access governance exists but not fully enforced by infrastructure',
      'Not all teams at the same maturity level (inconsistency)',
      'Advanced evaluation frameworks not yet customized to codebase patterns',
    ],
    recommendedModules: [
      'Module 05: Eval Gates & Quality',
      'Module 06: Advanced Governance',
      'Module 07: AI-Native Architecture',
    ],
  },

  {
    level: 'L4.0',
    name: 'AI-Native Practices',
    blendedScoreRange: [61, 70],
    description:
      'The organization operates with AI-native practices. AI agents handle significant portions ' +
      'of the workflow autonomously within well-defined guardrails. The engineering process is ' +
      'designed around AI capabilities.',
    observableEvidence: [
      'AI agents handle end-to-end task execution (spec to PR) for routine work',
      'Sophisticated autonomy tiers: AI can merge low-risk changes, requires review for high-risk',
      'Codebase designed for AI consumability (structured specs, clear interfaces, AI-friendly docs)',
      'Comprehensive eval gates with custom evaluators for codebase-specific patterns',
      'Full DORA tracking with rigorous AI attribution',
      'AI incident drills conducted periodically',
      'AI access governed by infrastructure (IAM, audit trails, trust boundaries)',
    ],
    expectedMetrics: {
      aiToolAdoption: '90%+ weekly active usage',
      aiAssistedPRRatio: '50-70% of PRs have AI involvement',
      aiDefectRate: 'At or below human baseline',
      deployFrequency: 'Multiple times daily, AI-attributed acceleration',
      leadTime: 'Significant reduction attributed to AI',
    },
    typicalGapsToNextLevel: [
      'AI-native architecture not fully realized (legacy components not AI-friendly)',
      'Cross-team consistency not yet achieved at scale',
      'Some evaluation blind spots for novel or complex tasks',
      'External AI ecosystem integration (partners, vendors) not optimized',
    ],
    recommendedModules: [
      'Module 07: AI-Native Architecture',
      'Module 08: Scaling AI Practices',
    ],
  },

  {
    level: 'L4.5',
    name: 'Advanced AI-Native',
    blendedScoreRange: [71, 80],
    description:
      'AI is deeply embedded in all engineering processes. The organization has AI-native ' +
      'architecture, consistent practices across all teams, and measurable competitive advantage ' +
      'from AI-augmented engineering.',
    observableEvidence: [
      'All routine development tasks have AI agent involvement',
      'Architecture decisions consider AI consumability as a first-class concern',
      'Custom AI evaluation frameworks tuned to the codebase',
      'Cross-functional AI practices (not just engineering -- product, design)',
      'AI engineering practices are a recruiting and retention advantage',
      'Continuous improvement loop with quarterly practice reviews',
    ],
    expectedMetrics: {
      aiAssistedPRRatio: '70-85% of PRs',
      aiDefectRate: 'Below human baseline, trending down',
      velocityGain: '2-3x measured improvement in key workflows',
      aiRoi: 'Quantified ROI exceeds 5x tooling investment',
    },
    typicalGapsToNextLevel: [
      'Not yet contributing back to the broader AI engineering community',
      'Some remaining manual processes that could be AI-automated',
      'AI practices documented internally but not formalized as methodology',
    ],
    recommendedModules: [
      'Module 08: Scaling AI Practices',
      'Module 09: AI-Native Leadership',
    ],
  },

  {
    level: 'L5.0',
    name: 'Industry-Leading AI-Native',
    blendedScoreRange: [81, 100],
    description:
      'The organization is an industry leader in AI-native software development. Their practices ' +
      'set the standard for the industry, and they actively contribute to the AI engineering community.',
    observableEvidence: [
      'AI is the default mode for all engineering work, with human oversight focused on high-judgment tasks',
      'Published or shared AI engineering practices externally',
      'Custom AI tooling built on top of foundation models for codebase-specific tasks',
      'AI practices extend to product decisions, customer feedback analysis, and business operations',
      'Engineering velocity and quality metrics are industry-benchmark-setting',
      'Active contribution to open-source AI engineering tools or frameworks',
    ],
    expectedMetrics: {
      aiAssistedPRRatio: '85%+ of PRs',
      velocityGain: '3x+ measured improvement',
      aiRoi: 'Core competitive advantage, quantified',
      talentImpact: 'Measurable recruiting and retention advantage from AI practices',
    },
    typicalGapsToNextLevel: [
      'This is the highest level. Focus shifts to maintaining the edge and expanding to new domains.',
    ],
    recommendedModules: [
      'Module 09: AI-Native Leadership',
      'Advanced: Custom engagement for industry-leading practices',
    ],
  },
];

/**
 * Look up the level definition for a given level string.
 */
export function getLevelDefinition(level: string): LevelDefinition | undefined {
  return LEVEL_DEFINITIONS.find((def) => def.level === level);
}

/**
 * Get the recommended modules for a given level.
 */
export function getRecommendedModules(level: string): string[] {
  const def = getLevelDefinition(level);
  return def?.recommendedModules ?? [];
}

/**
 * Get the typical gaps that need to be addressed to advance from a given level.
 */
export function getGapsToNextLevel(level: string): string[] {
  const def = getLevelDefinition(level);
  return def?.typicalGapsToNextLevel ?? [];
}
