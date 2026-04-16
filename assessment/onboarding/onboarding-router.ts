/**
 * PRISM D1 Velocity -- Onboarding Router
 *
 * Deterministic routing logic that takes a completed assessment result
 * and produces a personalized onboarding plan. Same inputs always
 * produce the same track assignment and plan.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Scanner category IDs and their maximum scores (total: 100) */
export type ScannerCategoryId =
  | 'ai_tool_config'
  | 'spec_driven_dev'
  | 'commit_hygiene'
  | 'cicd_integration'
  | 'eval_quality'
  | 'testing_maturity'
  | 'ai_observability'
  | 'governance'
  | 'agent_workflows'
  | 'platform_reuse'
  | 'documentation'
  | 'dependencies';

export interface ScannerCategoryScore {
  id: ScannerCategoryId;
  name: string;
  score: number;
  maxScore: number;
}

export const SCANNER_CATEGORIES: { id: ScannerCategoryId; name: string; maxScore: number }[] = [
  { id: 'ai_tool_config', name: 'AI Tool Config', maxScore: 10 },
  { id: 'spec_driven_dev', name: 'Spec-Driven Dev', maxScore: 10 },
  { id: 'commit_hygiene', name: 'Commit Hygiene', maxScore: 15 },
  { id: 'cicd_integration', name: 'CI/CD Integration', maxScore: 15 },
  { id: 'eval_quality', name: 'Eval & Quality', maxScore: 10 },
  { id: 'testing_maturity', name: 'Testing Maturity', maxScore: 10 },
  { id: 'ai_observability', name: 'AI Observability', maxScore: 10 },
  { id: 'governance', name: 'Governance', maxScore: 5 },
  { id: 'agent_workflows', name: 'Agent Workflows', maxScore: 5 },
  { id: 'platform_reuse', name: 'Platform Reuse', maxScore: 5 },
  { id: 'documentation', name: 'Documentation', maxScore: 3 },
  { id: 'dependencies', name: 'Dependencies', maxScore: 2 },
];

/** Interview section IDs and their maximum scores (total: 100) */
export type InterviewSectionId =
  | 'ai_tooling_landscape'
  | 'dev_workflow_specs'
  | 'cicd_quality'
  | 'metrics_visibility'
  | 'governance_security'
  | 'org_culture';

export interface InterviewSectionScore {
  id: InterviewSectionId;
  name: string;
  score: number;
  maxScore: number;
  keyFindings: string[];
}

export const INTERVIEW_SECTIONS: { id: InterviewSectionId; name: string; maxScore: number }[] = [
  { id: 'ai_tooling_landscape', name: 'AI Tooling Landscape', maxScore: 15 },
  { id: 'dev_workflow_specs', name: 'Development Workflow & Specs', maxScore: 20 },
  { id: 'cicd_quality', name: 'CI/CD & Quality', maxScore: 20 },
  { id: 'metrics_visibility', name: 'Metrics & Visibility', maxScore: 15 },
  { id: 'governance_security', name: 'Governance & Security', maxScore: 15 },
  { id: 'org_culture', name: 'Org & Culture', maxScore: 15 },
];

export interface OrgReadiness {
  executiveSponsor: boolean;       // 4 pts
  dedicatedChampion: boolean;      // 4 pts
  teamWillingness: boolean;        // 4 pts
  budgetApproved: boolean;         // 4 pts
  timelineCommitment: boolean;     // 4 pts
  totalScore: number;              // 0-20
}

export type Verdict = 'READY_FOR_PILOT' | 'NEEDS_FOUNDATIONS' | 'NOT_QUALIFIED';

export interface AssessmentResult {
  scannerScores: ScannerCategoryScore[];
  scannerTotal: number;
  interviewScores: InterviewSectionScore[];
  interviewTotal: number;
  orgReadiness: OrgReadiness;
  blendedScore: number;
  prismLevel: number;
  verdict: Verdict;
  assessmentDate: string;
  saName: string;
  repoAnalyzed: string;
}

export interface CustomerInfo {
  name: string;
  teamSize: number;
  fundingStage: string;
}

export interface WorkshopModule {
  id: string;
  name: string;
  included: boolean;
  reason: string;
}

export interface PreWorkItem {
  task: string;
  deadline: string;
  owner: string;
}

export interface BootstrapperComponent {
  component: string;
  priority: 'immediate' | 'week1' | 'week2' | 'pilot';
}

export interface GapRemediation {
  gap: string;
  category: string;
  score: string;
  action: string;
}

export interface SuccessMetric {
  metric: string;
  target: string;
  measureBy: string;
}

export interface Milestone {
  week: number;
  milestone: string;
  measurable: string;
}

export interface SaTouchpoint {
  week: number;
  type: string;
  duration: string;
  agenda: string;
}

export interface OnboardingPlan {
  track: 'A' | 'B' | 'C' | 'D';
  trackName: string;
  customer: { name: string; teamSize: number; fundingStage: string };
  prismLevel: number;
  verdict: string;
  workshopModules: WorkshopModule[];
  preWork: PreWorkItem[];
  bootstrapperComponents: BootstrapperComponent[];
  gapRemediation: GapRemediation[];
  successMetrics: SuccessMetric[];
  milestones: Milestone[];
  saTouchpoints: SaTouchpoint[];
}

// ---------------------------------------------------------------------------
// Workshop module definitions
// ---------------------------------------------------------------------------

const ALL_MODULES: { id: string; name: string }[] = [
  { id: 'M00', name: 'Environment Setup' },
  { id: 'M01', name: 'CLAUDE.md & Standards' },
  { id: 'M02', name: 'Spec-Driven Development' },
  { id: 'M03', name: 'CI/CD & Eval Gates' },
  { id: 'M04', name: 'Metrics & Dashboards' },
  { id: 'M05', name: 'Governance & Scaling' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine track letter from PRISM level and verdict. */
function determineTrack(
  prismLevel: number,
  verdict: Verdict,
): 'A' | 'B' | 'C' | 'D' | null {
  if (verdict === 'NOT_QUALIFIED') return null;
  if (verdict === 'NEEDS_FOUNDATIONS') return 'A';

  // READY_FOR_PILOT
  if (prismLevel < 2.0) return 'A';
  if (prismLevel < 3.0) return 'B';
  if (prismLevel < 4.0) return 'C';
  return 'D';
}

const TRACK_NAMES: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Foundations',
  B: 'Full Workshop',
  C: 'Accelerated',
  D: 'Advanced Optimization',
};

/** Which modules are included per track, with reasons when excluded. */
function modulesForTrack(track: 'A' | 'B' | 'C' | 'D'): WorkshopModule[] {
  const configs: Record<'A' | 'B' | 'C' | 'D', Record<string, { included: boolean; reason: string }>> = {
    A: {
      M00: { included: true, reason: 'Foundation for everything else' },
      M01: { included: true, reason: 'Standardize AI tool configuration' },
      M02: { included: true, reason: 'Introduce structured AI workflows' },
      M03: { included: false, reason: 'Too early -- no baseline to gate against' },
      M04: { included: false, reason: 'Too early -- need data flowing first' },
      M05: { included: false, reason: 'Too early -- need adoption first' },
    },
    B: {
      M00: { included: true, reason: 'Verify and upgrade existing setup' },
      M01: { included: true, reason: 'Align existing config to PRISM standards' },
      M02: { included: true, reason: 'Formalize and standardize spec workflows' },
      M03: { included: true, reason: 'Instrument pipeline with eval gates' },
      M04: { included: true, reason: 'Deploy Timestream + QuickSight dashboards' },
      M05: { included: true, reason: 'Establish governance model for scaling' },
    },
    C: {
      M00: { included: false, reason: 'Already have a working setup' },
      M01: { included: false, reason: 'Already adopted standards' },
      M02: { included: false, reason: 'Already practicing spec-driven dev' },
      M03: { included: true, reason: 'Close eval and quality gaps' },
      M04: { included: true, reason: 'Deploy advanced observability' },
      M05: { included: true, reason: 'Formalize governance for scale' },
    },
    D: {
      M00: { included: false, reason: 'Custom engagement -- foundations already mastered' },
      M01: { included: false, reason: 'Custom engagement -- standards already in place' },
      M02: { included: false, reason: 'Custom engagement -- spec-driven dev mature' },
      M03: { included: false, reason: 'Custom engagement -- CI/CD mature, focus on optimization' },
      M04: { included: false, reason: 'Custom engagement -- advanced dashboards via architecture review' },
      M05: { included: false, reason: 'Custom engagement -- governance addressed via architecture review' },
    },
  };

  return ALL_MODULES.map((mod) => ({
    id: mod.id,
    name: mod.name,
    included: configs[track][mod.id].included,
    reason: configs[track][mod.id].reason,
  }));
}

/** Identify the top-N gaps across scanner + interview scores. */
function identifyGaps(
  scannerScores: ScannerCategoryScore[],
  interviewScores: InterviewSectionScore[],
  count: number,
): { name: string; category: 'scanner' | 'interview'; score: number; maxScore: number; percentage: number }[] {
  const combined: { name: string; category: 'scanner' | 'interview'; score: number; maxScore: number; percentage: number }[] = [];

  for (const s of scannerScores) {
    combined.push({
      name: s.name,
      category: 'scanner',
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 100,
    });
  }

  for (const s of interviewScores) {
    combined.push({
      name: s.name,
      category: 'interview',
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 100,
    });
  }

  combined.sort((a, b) => a.percentage - b.percentage);
  return combined.slice(0, count);
}

/** Gap-specific remediation actions. */
function remediationForGap(gapName: string, percentage: number): string {
  const actions: Record<string, string> = {
    'AI Tool Config': 'Deploy CLAUDE.md to all repos, standardize Bedrock configuration, enable Claude Code for the full team.',
    'Spec-Driven Dev': 'Adopt feature/bug/refactor spec templates. Require specs before starting any AI-assisted work.',
    'Commit Hygiene': 'Enable git hooks for AI-Origin and AI-Confidence trailers. Train team on commit conventions.',
    'CI/CD Integration': 'Instrument primary pipeline with eval gates. Add Bedrock Evaluation step to PR workflow.',
    'Eval & Quality': 'Define quality rubrics for AI output. Implement automated eval scoring in CI.',
    'Testing Maturity': 'Increase test coverage requirements. Add AI-generated test review to PR checklist.',
    'AI Observability': 'Deploy metrics pipeline (EventBridge -> Timestream). Enable token tracking and cost attribution.',
    'Governance': 'Document AI usage policies. Implement approval workflows for agent-level autonomy.',
    'Agent Workflows': 'Identify first candidate for multi-step agent workflow. Start with low-risk automation.',
    'Platform Reuse': 'Catalog reusable AI components. Create shared prompt library and tool configurations.',
    'Documentation': 'Generate AI-assisted documentation for key modules. Add doc quality to review checklist.',
    'Dependencies': 'Audit AI-related dependencies. Pin versions, document update policy.',
    'AI Tooling Landscape': 'Standardize on approved AI tools. Eliminate shadow AI usage with clear alternatives.',
    'Development Workflow & Specs': 'Formalize the spec-driven development workflow. Map AI touchpoints in the SDLC.',
    'CI/CD & Quality': 'Add eval gates to CI/CD. Define pass/fail thresholds for AI-generated code quality.',
    'Metrics & Visibility': 'Deploy executive dashboard. Establish weekly metrics review cadence.',
    'Governance & Security': 'Create AI governance charter. Define data handling policies for AI tools.',
    'Org & Culture': 'Run team enablement sessions. Celebrate early AI-assisted wins publicly.',
  };

  const action = actions[gapName];
  if (action) return action;

  if (percentage < 25) return 'Critical gap -- needs immediate, focused remediation in the first two weeks.';
  if (percentage < 50) return 'Significant gap -- prioritize in the first month of the engagement.';
  return 'Moderate gap -- address during the pilot period.';
}

// ---------------------------------------------------------------------------
// Pre-work generators
// ---------------------------------------------------------------------------

function preWorkForTrack(track: 'A' | 'B' | 'C' | 'D'): PreWorkItem[] {
  const basePreWork: PreWorkItem[] = [
    { task: 'Install Claude Code and configure for AWS Bedrock', deadline: 'Before workshop', owner: 'Each developer' },
    { task: 'Install Kiro IDE', deadline: 'Before workshop', owner: 'Each developer' },
    { task: 'Run verify-setup.sh and confirm green output', deadline: 'Before workshop', owner: 'Team lead' },
  ];

  switch (track) {
    case 'A':
      return [
        ...basePreWork,
        { task: 'Read "Why Spec-Driven Development" (Module 02 primer)', deadline: '1 week before workshop', owner: 'Each developer' },
        { task: 'Identify 2 features the team will build during the workshop', deadline: '3 days before workshop', owner: 'Team lead' },
      ];

    case 'B':
      return [
        ...basePreWork,
        { task: 'Read "Why Spec-Driven Development" (Module 02 primer)', deadline: '1 week before workshop', owner: 'Each developer' },
        { task: 'Identify 2 features the team will build during the workshop', deadline: '3 days before workshop', owner: 'Team lead' },
        { task: 'Ensure AWS account has EventBridge, Timestream, and CloudWatch access', deadline: '1 week before workshop', owner: 'Platform/DevOps lead' },
        { task: 'Identify the primary CI/CD pipeline to instrument', deadline: '1 week before workshop', owner: 'Team lead' },
        { task: 'Get approval for GitHub webhook integration', deadline: '1 week before workshop', owner: 'Engineering manager' },
        { task: 'Designate an executive sponsor for the weekly readout', deadline: '1 week before workshop', owner: 'Engineering manager' },
      ];

    case 'C':
      return [
        { task: 'Review assessment report and gap analysis in detail', deadline: '3 days before workshop', owner: 'Team lead' },
        { task: 'Prepare access to CI/CD pipeline for eval gate integration', deadline: 'Before workshop', owner: 'Platform/DevOps lead' },
        { task: 'Identify the production endpoint for Bedrock Evaluation', deadline: 'Before workshop', owner: 'Platform/DevOps lead' },
        { task: 'Schedule executive readout for Week 2 of the pilot', deadline: 'Before workshop', owner: 'Engineering manager' },
      ];

    case 'D':
      return [
        { task: 'Prepare architecture diagrams for current AI integration points', deadline: '1 week before review', owner: 'Staff/Principal engineer' },
        { task: 'Compile AI cost data for the past 3 months (Bedrock usage)', deadline: '1 week before review', owner: 'Platform/DevOps lead' },
        { task: 'Document current multi-agent or automation workflows', deadline: '1 week before review', owner: 'Team lead' },
        { task: 'Identify top-3 cross-team reuse opportunities', deadline: '1 week before review', owner: 'Staff/Principal engineer' },
        { task: 'Schedule cross-pillar stakeholder meeting', deadline: '1 week before review', owner: 'Engineering manager' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Bootstrapper component generators
// ---------------------------------------------------------------------------

function bootstrapperComponentsForTrack(track: 'A' | 'B' | 'C' | 'D'): BootstrapperComponent[] {
  switch (track) {
    case 'A':
      return [
        { component: 'CLAUDE.md configuration file', priority: 'immediate' },
        { component: 'Git hooks for AI-origin trailers', priority: 'immediate' },
        { component: 'Spec templates (feature, bug, refactor)', priority: 'week1' },
        { component: '.kiro/settings for Kiro IDE', priority: 'week1' },
      ];

    case 'B':
      return [
        { component: 'CLAUDE.md configuration file', priority: 'immediate' },
        { component: 'Git hooks for AI-origin trailers', priority: 'immediate' },
        { component: 'Spec templates (feature, bug, refactor)', priority: 'immediate' },
        { component: '.kiro/settings for Kiro IDE', priority: 'immediate' },
        { component: 'EventBridge metrics pipeline (CDK stack)', priority: 'week1' },
        { component: 'Timestream database and tables', priority: 'week1' },
        { component: 'CI/CD eval gate integration', priority: 'week2' },
        { component: 'QuickSight dashboard deployment', priority: 'week2' },
        { component: 'Executive readout template', priority: 'pilot' },
      ];

    case 'C':
      return [
        { component: 'CI/CD eval gate integration', priority: 'immediate' },
        { component: 'Advanced metrics pipeline upgrades', priority: 'immediate' },
        { component: 'Governance policy documentation', priority: 'week1' },
        { component: 'Advanced QuickSight dashboard views', priority: 'week1' },
        { component: 'Agent workflow automation templates', priority: 'week2' },
      ];

    case 'D':
      return [
        { component: 'Multi-agent governance framework', priority: 'week1' },
        { component: 'AI FinOps cost attribution dashboard', priority: 'week1' },
        { component: 'Cross-team shared component catalog', priority: 'week2' },
        { component: 'D2/D3/D4 readiness assessment tooling', priority: 'pilot' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Success metrics generators
// ---------------------------------------------------------------------------

function successMetricsForTrack(track: 'A' | 'B' | 'C' | 'D'): SuccessMetric[] {
  switch (track) {
    case 'A':
      return [
        { metric: 'AI-origin commit trailers', target: '30%+ of commits', measureBy: '2 weeks post-workshop' },
        { metric: 'CLAUDE.md deployment', target: '100% of active repos', measureBy: '1 week post-workshop' },
        { metric: 'Spec adoption', target: '2+ specs per developer', measureBy: '2 weeks post-workshop' },
        { metric: 'Team tool satisfaction', target: '7+ NPS score', measureBy: '2 weeks post-workshop' },
      ];

    case 'B':
      return [
        { metric: 'AI acceptance rate', target: '30%+', measureBy: 'Week 4 checkpoint' },
        { metric: 'Eval gate active in CI', target: 'At least 1 pipeline', measureBy: 'Week 2 of pilot' },
        { metric: 'Weekly executive readout', target: 'Active and reviewed', measureBy: 'Week 3 of pilot' },
        { metric: 'PRISM D1 level improvement', target: '+0.5 levels', measureBy: 'Week 8 of pilot' },
        { metric: 'Dashboard data freshness', target: 'Within 1 hour', measureBy: 'Week 2 of pilot' },
      ];

    case 'C':
      return [
        { metric: 'Top-3 gap category scores', target: '50%+ improvement', measureBy: 'Week 4' },
        { metric: 'PRISM D1 level', target: 'Reach L3.5+', measureBy: 'Week 8' },
        { metric: 'Governance model', target: 'Documented and adopted', measureBy: 'Week 2' },
        { metric: 'Advanced dashboards', target: 'Live with trend data', measureBy: 'Week 4' },
      ];

    case 'D':
      return [
        { metric: 'Cost per AI-assisted commit', target: '20%+ reduction', measureBy: '8 weeks' },
        { metric: 'Cross-team pattern reuse', target: '3+ shared components', measureBy: '8 weeks' },
        { metric: 'Multi-agent workflow', target: '1+ in production', measureBy: '4 weeks' },
        { metric: 'D2/D3/D4 readiness assessment', target: 'Scheduled', measureBy: '8 weeks' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Milestone generators
// ---------------------------------------------------------------------------

function milestonesForTrack(track: 'A' | 'B' | 'C' | 'D'): Milestone[] {
  switch (track) {
    case 'A':
      return [
        { week: 1, milestone: 'CLAUDE.md deployed, hooks active', measurable: '100% of repos have CLAUDE.md' },
        { week: 2, milestone: 'First spec-driven features completed', measurable: '2+ features built via spec workflow' },
        { week: 3, milestone: 'Commit trailer adoption steady', measurable: '30%+ of commits have AI-origin trailers' },
        { week: 4, milestone: 'Re-assessment complete', measurable: 'Scanner re-run, L2.0+ achieved for Track B upgrade' },
        { week: 8, milestone: 'Track B started or extended coaching', measurable: 'Full workshop scheduled or coaching plan in place' },
        { week: 12, milestone: 'L2.5+ achieved', measurable: 'Blended assessment score confirms L2.5+' },
      ];

    case 'B':
      return [
        { week: 1, milestone: 'Bootstrapper fully deployed', measurable: 'All components live, first metrics flowing' },
        { week: 2, milestone: 'Eval gate in CI, dashboards active', measurable: 'PR pipeline includes eval step, QuickSight live' },
        { week: 4, milestone: 'Midpoint checkpoint passed', measurable: 'AI acceptance rate 30%+, exec readout active' },
        { week: 6, milestone: 'Governance model documented', measurable: 'Policy document published to team wiki' },
        { week: 8, milestone: 'Pilot readout delivered', measurable: 'L3.0+ achieved, Track C eligible' },
        { week: 12, milestone: '90-day sustained adoption', measurable: 'Metrics stable, no regression below L2.5' },
      ];

    case 'C':
      return [
        { week: 1, milestone: 'Gap remediation started', measurable: 'Top-3 gaps have action plans in progress' },
        { week: 2, milestone: 'Advanced dashboards deployed', measurable: 'Custom views live with trend analysis' },
        { week: 4, milestone: 'Midpoint checkpoint passed', measurable: 'Top-3 gaps improved 50%+' },
        { week: 8, milestone: 'L3.5+ achieved, pilot complete', measurable: 'Re-assessment confirms L3.5+' },
        { week: 12, milestone: 'L4 transition ready', measurable: 'Track D architecture review scheduled' },
      ];

    case 'D':
      return [
        { week: 2, milestone: 'Architecture review complete', measurable: 'Recommendations document delivered' },
        { week: 4, milestone: 'Multi-agent workflow in production', measurable: '1+ workflow live with governance' },
        { week: 8, milestone: 'AI FinOps optimization measured', measurable: '20%+ cost reduction per AI commit' },
        { week: 12, milestone: 'Cross-pillar assessment scheduled', measurable: 'D2/D3/D4 assessment dates confirmed' },
      ];
  }
}

// ---------------------------------------------------------------------------
// SA touchpoint generators
// ---------------------------------------------------------------------------

function saTouchpointsForTrack(track: 'A' | 'B' | 'C' | 'D'): SaTouchpoint[] {
  switch (track) {
    case 'A':
      return [
        { week: -2, type: 'Pre-work kick-off call', duration: '30 min', agenda: 'Walk through pre-work checklist, answer setup questions, confirm workshop date' },
        { week: 0, type: 'Workshop delivery', duration: '4 hr', agenda: 'Deliver Modules 00-02, hands-on exercises, first spec-driven build' },
        { week: 1, type: 'Async check-in', duration: '15 min (Slack)', agenda: 'Review commit trailer adoption rates, troubleshoot blockers' },
        { week: 2, type: 'Video call', duration: '30 min', agenda: 'Review first 2-week metrics, adjust approach if needed' },
        { week: 4, type: 'Re-assessment session', duration: '1 hr', agenda: 'Re-run scanner, conduct brief interview, determine Track B readiness' },
      ];

    case 'B':
      return [
        { week: -1, type: 'Pre-work kick-off call', duration: '30 min', agenda: 'Review pre-work checklist, confirm AWS access, workshop logistics' },
        { week: 0, type: 'Workshop delivery', duration: '4 hr', agenda: 'Deliver all 6 modules, hands-on exercises, bootstrapper deployment' },
        { week: 1, type: 'Video call', duration: '45 min', agenda: 'Verify bootstrapper deployment, review first metrics, troubleshoot' },
        { week: 2, type: 'Async check-in', duration: '15 min (Slack)', agenda: 'Review dashboard data quality, flag any pipeline issues' },
        { week: 4, type: 'Checkpoint call', duration: '1 hr', agenda: 'Midpoint review, acceptance rate check, adjust pilot targets' },
        { week: 6, type: 'Async check-in', duration: '15 min (Slack)', agenda: 'Review progress toward 8-week goals, flag risks' },
        { week: 8, type: 'Pilot readout call', duration: '1 hr', agenda: 'Final pilot metrics, L3 readiness determination, next steps' },
      ];

    case 'C':
      return [
        { week: -1, type: 'Async prep', duration: '15 min (Slack)', agenda: 'Share gap analysis, confirm workshop focus areas' },
        { week: 0, type: 'Targeted workshop', duration: '2 hr', agenda: 'Deliver Modules 03-05 with gap-specific exercises' },
        { week: 2, type: 'Video call', duration: '30 min', agenda: 'Verify gap remediation progress, review dashboards' },
        { week: 4, type: 'Checkpoint call', duration: '45 min', agenda: 'Midpoint review, gap score improvements, adjust plan' },
        { week: 8, type: 'Pilot readout call', duration: '1 hr', agenda: 'Final readout, L3.5+ confirmation, L4 transition plan' },
      ];

    case 'D':
      return [
        { week: -1, type: 'Architecture review prep', duration: '30 min', agenda: 'Confirm materials, schedule stakeholders, set review agenda' },
        { week: 0, type: 'Architecture review', duration: '3 hr', agenda: 'Deep-dive current architecture, identify optimization opportunities' },
        { week: 2, type: 'Video call', duration: '1 hr', agenda: 'Review recommendations, prioritize implementation order' },
        { week: 4, type: 'Video call', duration: '1 hr', agenda: 'Progress review, multi-agent workflow status, cost data' },
        { week: 8, type: 'Readout call', duration: '1 hr', agenda: 'Final readout, D2/D3/D4 transition plan, cross-pillar roadmap' },
        { week: 12, type: 'Monthly check-in', duration: '30 min', agenda: 'Strategic alignment, cross-pillar assessment scheduling' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

/**
 * Route a completed assessment into a personalized onboarding plan.
 * This function is deterministic: identical inputs always produce the same output.
 *
 * @throws Error if the verdict is NOT_QUALIFIED (no track assignment possible).
 */
export function routeOnboarding(
  assessment: AssessmentResult,
  customer: CustomerInfo,
): OnboardingPlan {
  const track = determineTrack(assessment.prismLevel, assessment.verdict);

  if (track === null) {
    throw new Error(
      `Customer "${customer.name}" received NOT_QUALIFIED verdict (PRISM Level ${assessment.prismLevel}). ` +
      'Cannot assign an onboarding track. Provide a written recommendation document instead.',
    );
  }

  const gaps = identifyGaps(assessment.scannerScores, assessment.interviewScores, 5);
  const topGaps = gaps.slice(0, 3);

  const gapRemediation: GapRemediation[] = topGaps.map((g) => ({
    gap: `#${gaps.indexOf(g) + 1}`,
    category: `${g.name} (${g.category})`,
    score: `${g.score}/${g.maxScore} (${Math.round(g.percentage)}%)`,
    action: remediationForGap(g.name, g.percentage),
  }));

  return {
    track,
    trackName: TRACK_NAMES[track],
    customer,
    prismLevel: assessment.prismLevel,
    verdict: assessment.verdict,
    workshopModules: modulesForTrack(track),
    preWork: preWorkForTrack(track),
    bootstrapperComponents: bootstrapperComponentsForTrack(track),
    gapRemediation,
    successMetrics: successMetricsForTrack(track),
    milestones: milestonesForTrack(track),
    saTouchpoints: saTouchpointsForTrack(track),
  };
}

/**
 * Compute the blended score from raw inputs.
 * Utility function for callers that have raw scores but not the blended result.
 */
export function computeBlendedScore(
  scannerTotal: number,
  interviewTotal: number,
  orgReadinessTotal: number,
): { blendedScore: number; prismLevel: number; verdict: Verdict } {
  // Normalize org readiness from 0-20 to 0-100 scale for blending
  const orgNormalized = (orgReadinessTotal / 20) * 100;
  const blendedScore = 0.4 * scannerTotal + 0.4 * interviewTotal + 0.2 * orgNormalized;

  // Map blended score to PRISM level (each 20 points = 1 level)
  const prismLevel = Math.round((blendedScore / 20) * 10) / 10;
  const clampedLevel = Math.max(1.0, Math.min(5.0, prismLevel));

  let verdict: Verdict;
  if (blendedScore < 25) {
    verdict = 'NOT_QUALIFIED';
  } else if (blendedScore < 40) {
    verdict = 'NEEDS_FOUNDATIONS';
  } else {
    verdict = 'READY_FOR_PILOT';
  }

  return { blendedScore, prismLevel: clampedLevel, verdict };
}
