/**
 * PRISM D1 Velocity -- Scoring Model
 *
 * Computes the blended PRISM D1 level from three inputs:
 *   - Automated scanner score (0-100)
 *   - SA interview score (0-100)
 *   - Org readiness (5 binary criteria, 4 pts each, 0-20)
 *
 * Weights: 40% scanner + 40% interview + 20% org readiness
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgReadinessInputs {
  /** Executive sponsor identified for AI transformation */
  executiveSponsor: boolean;
  /** Budget explicitly allocated for AI tooling */
  budgetAllocated: boolean;
  /** Dedicated AI/platform team or named owner */
  dedicatedOwner: boolean;
  /** Existing AWS commitment or relationship */
  awsRelationship: boolean;
  /** Team size is in the target range (20-200 engineers) */
  appropriateTeamSize: boolean;
}

export interface AssessmentInput {
  /** Automated repo scanner score, 0-100 */
  scannerScore: number;
  /** SA interview score, 0-100 */
  interviewScore: number;
  /** Org readiness binary inputs */
  orgReadiness: OrgReadinessInputs;
}

export type Verdict = 'READY_FOR_PILOT' | 'NEEDS_FOUNDATIONS' | 'NOT_QUALIFIED';

export type Level =
  | 'L1.0'
  | 'L1.5'
  | 'L2.0'
  | 'L2.5'
  | 'L3.0'
  | 'L3.5'
  | 'L4.0'
  | 'L4.5'
  | 'L5.0';

export interface ScoringDimension {
  name: string;
  score: number;
  maxScore: number;
}

export interface AssessmentResult {
  /** Raw scanner score */
  scannerScore: number;
  /** Raw interview score */
  interviewScore: number;
  /** Org readiness raw score (0-20) */
  orgReadinessScore: number;
  /** Weighted blended score (0-100) */
  blendedScore: number;
  /** PRISM D1 level */
  level: Level;
  /** Qualification verdict */
  verdict: Verdict;
  /** The dimension with the lowest relative score */
  limitingDimension: ScoringDimension;
  /** All dimensions with their scores for reporting */
  dimensions: ScoringDimension[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCANNER_WEIGHT = 0.4;
const INTERVIEW_WEIGHT = 0.4;
const ORG_READINESS_WEIGHT = 0.2;
const ORG_READINESS_POINTS_PER_CRITERION = 4;
const ORG_READINESS_MAX = 20;

/** Level boundaries: [minScore, level] sorted ascending */
const LEVEL_THRESHOLDS: Array<[number, Level]> = [
  [0, 'L1.0'],
  [11, 'L1.5'],
  [21, 'L2.0'],
  [31, 'L2.5'],
  [41, 'L3.0'],
  [51, 'L3.5'],
  [61, 'L4.0'],
  [71, 'L4.5'],
  [81, 'L5.0'],
];

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Compute the org readiness raw score (0-20) from 5 binary inputs.
 */
export function computeOrgReadiness(inputs: OrgReadinessInputs): number {
  let score = 0;
  if (inputs.executiveSponsor) score += ORG_READINESS_POINTS_PER_CRITERION;
  if (inputs.budgetAllocated) score += ORG_READINESS_POINTS_PER_CRITERION;
  if (inputs.dedicatedOwner) score += ORG_READINESS_POINTS_PER_CRITERION;
  if (inputs.awsRelationship) score += ORG_READINESS_POINTS_PER_CRITERION;
  if (inputs.appropriateTeamSize) score += ORG_READINESS_POINTS_PER_CRITERION;
  return score;
}

/**
 * Compute the weighted blended score (0-100).
 *
 * Org readiness (0-20) is scaled to 0-100 before weighting so all three
 * inputs contribute proportionally.
 */
export function computeBlendedScore(
  scannerScore: number,
  interviewScore: number,
  orgReadinessRaw: number,
): number {
  const orgReadinessScaled = (orgReadinessRaw / ORG_READINESS_MAX) * 100;
  const blended =
    scannerScore * SCANNER_WEIGHT +
    interviewScore * INTERVIEW_WEIGHT +
    orgReadinessScaled * ORG_READINESS_WEIGHT;
  return Math.round(blended * 100) / 100; // 2 decimal places
}

/**
 * Map a blended score (0-100) to a PRISM D1 level.
 */
export function scoreToLevel(blendedScore: number): Level {
  let level: Level = 'L1.0';
  for (const [threshold, lvl] of LEVEL_THRESHOLDS) {
    if (blendedScore >= threshold) {
      level = lvl;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Determine the readiness verdict based on blended score and org readiness.
 */
export function determineVerdict(
  blendedScore: number,
  orgReadinessRaw: number,
): Verdict {
  // READY_FOR_PILOT: >= L2.0 (blended >= 21) AND org readiness >= 12
  if (blendedScore >= 21 && orgReadinessRaw >= 12) {
    return 'READY_FOR_PILOT';
  }
  // NEEDS_FOUNDATIONS: >= L1.5 (blended >= 11) AND org readiness >= 8
  if (blendedScore >= 11 && orgReadinessRaw >= 8) {
    return 'NEEDS_FOUNDATIONS';
  }
  return 'NOT_QUALIFIED';
}

/**
 * Identify the limiting dimension -- the one with the lowest percentage score.
 * This tells the customer where their biggest gap is.
 */
export function findLimitingDimension(
  dimensions: ScoringDimension[],
): ScoringDimension {
  let lowest: ScoringDimension = dimensions[0];
  let lowestPct = lowest.score / lowest.maxScore;

  for (const dim of dimensions) {
    const pct = dim.score / dim.maxScore;
    if (pct < lowestPct) {
      lowest = dim;
      lowestPct = pct;
    }
  }
  return lowest;
}

/**
 * Build the list of scoring dimensions from scanner + interview section
 * breakdown. The interview score is broken into 6 sections by convention,
 * but for the limiting dimension calculation we use the three top-level
 * inputs: scanner, interview, and org readiness.
 */
function buildDimensions(
  scannerScore: number,
  interviewScore: number,
  orgReadinessRaw: number,
): ScoringDimension[] {
  return [
    { name: 'Automated Scanner', score: scannerScore, maxScore: 100 },
    { name: 'SA Interview', score: interviewScore, maxScore: 100 },
    { name: 'Org Readiness', score: orgReadinessRaw, maxScore: ORG_READINESS_MAX },
  ];
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Compute the full PRISM D1 Velocity assessment from all inputs.
 */
export function computeAssessment(input: AssessmentInput): AssessmentResult {
  // Validate inputs
  if (input.scannerScore < 0 || input.scannerScore > 100) {
    throw new Error(`Scanner score must be 0-100, got ${input.scannerScore}`);
  }
  if (input.interviewScore < 0 || input.interviewScore > 100) {
    throw new Error(`Interview score must be 0-100, got ${input.interviewScore}`);
  }

  const orgReadinessScore = computeOrgReadiness(input.orgReadiness);
  const blendedScore = computeBlendedScore(
    input.scannerScore,
    input.interviewScore,
    orgReadinessScore,
  );
  const level = scoreToLevel(blendedScore);
  const verdict = determineVerdict(blendedScore, orgReadinessScore);
  const dimensions = buildDimensions(
    input.scannerScore,
    input.interviewScore,
    orgReadinessScore,
  );
  const limitingDimension = findLimitingDimension(dimensions);

  return {
    scannerScore: input.scannerScore,
    interviewScore: input.interviewScore,
    orgReadinessScore,
    blendedScore,
    level,
    verdict,
    limitingDimension,
    dimensions,
  };
}
