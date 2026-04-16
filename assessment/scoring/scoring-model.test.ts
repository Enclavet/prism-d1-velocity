import {
  computeAssessment,
  computeOrgReadiness,
  computeBlendedScore,
  scoreToLevel,
  determineVerdict,
  findLimitingDimension,
  type AssessmentInput,
  type OrgReadinessInputs,
  type ScoringDimension,
} from './scoring-model';

// ---------------------------------------------------------------------------
// Helper: default org readiness with all false
// ---------------------------------------------------------------------------

const NO_ORG_READINESS: OrgReadinessInputs = {
  executiveSponsor: false,
  budgetAllocated: false,
  dedicatedOwner: false,
  awsRelationship: false,
  appropriateTeamSize: false,
};

const FULL_ORG_READINESS: OrgReadinessInputs = {
  executiveSponsor: true,
  budgetAllocated: true,
  dedicatedOwner: true,
  awsRelationship: true,
  appropriateTeamSize: true,
};

// ---------------------------------------------------------------------------
// computeOrgReadiness
// ---------------------------------------------------------------------------

describe('computeOrgReadiness', () => {
  it('returns 0 when all inputs are false', () => {
    expect(computeOrgReadiness(NO_ORG_READINESS)).toBe(0);
  });

  it('returns 20 when all inputs are true', () => {
    expect(computeOrgReadiness(FULL_ORG_READINESS)).toBe(20);
  });

  it('returns 4 per true criterion', () => {
    expect(
      computeOrgReadiness({ ...NO_ORG_READINESS, executiveSponsor: true }),
    ).toBe(4);
    expect(
      computeOrgReadiness({
        ...NO_ORG_READINESS,
        executiveSponsor: true,
        budgetAllocated: true,
      }),
    ).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeBlendedScore
// ---------------------------------------------------------------------------

describe('computeBlendedScore', () => {
  it('returns 0 when all inputs are 0', () => {
    expect(computeBlendedScore(0, 0, 0)).toBe(0);
  });

  it('returns 100 when all inputs are max', () => {
    // scanner=100*0.4 + interview=100*0.4 + orgReadiness=(20/20)*100*0.2
    // = 40 + 40 + 20 = 100
    expect(computeBlendedScore(100, 100, 20)).toBe(100);
  });

  it('correctly weights the three inputs', () => {
    // scanner=50*0.4=20, interview=50*0.4=20, org=(10/20)*100*0.2=10
    expect(computeBlendedScore(50, 50, 10)).toBe(50);
  });

  it('handles asymmetric scores', () => {
    // scanner=80*0.4=32, interview=20*0.4=8, org=(12/20)*100*0.2=12
    expect(computeBlendedScore(80, 20, 12)).toBe(52);
  });
});

// ---------------------------------------------------------------------------
// scoreToLevel
// ---------------------------------------------------------------------------

describe('scoreToLevel', () => {
  it('maps 0 to L1.0', () => {
    expect(scoreToLevel(0)).toBe('L1.0');
  });

  it('maps 10 to L1.0', () => {
    expect(scoreToLevel(10)).toBe('L1.0');
  });

  it('maps 11 to L1.5', () => {
    expect(scoreToLevel(11)).toBe('L1.5');
  });

  it('maps 21 to L2.0', () => {
    expect(scoreToLevel(21)).toBe('L2.0');
  });

  it('maps 50 to L3.0', () => {
    expect(scoreToLevel(50)).toBe('L3.0');
  });

  it('maps 81 to L5.0', () => {
    expect(scoreToLevel(81)).toBe('L5.0');
  });

  it('maps 100 to L5.0', () => {
    expect(scoreToLevel(100)).toBe('L5.0');
  });

  it('maps boundary values correctly', () => {
    expect(scoreToLevel(20)).toBe('L1.5');
    expect(scoreToLevel(30)).toBe('L2.0');
    expect(scoreToLevel(31)).toBe('L2.5');
    expect(scoreToLevel(40)).toBe('L2.5');
    expect(scoreToLevel(41)).toBe('L3.0');
    expect(scoreToLevel(60)).toBe('L3.5');
    expect(scoreToLevel(61)).toBe('L4.0');
    expect(scoreToLevel(70)).toBe('L4.0');
    expect(scoreToLevel(71)).toBe('L4.5');
    expect(scoreToLevel(80)).toBe('L4.5');
  });
});

// ---------------------------------------------------------------------------
// determineVerdict
// ---------------------------------------------------------------------------

describe('determineVerdict', () => {
  it('returns NOT_QUALIFIED for low blended + low org', () => {
    expect(determineVerdict(10, 4)).toBe('NOT_QUALIFIED');
  });

  it('returns NOT_QUALIFIED for decent blended but low org', () => {
    expect(determineVerdict(25, 4)).toBe('NOT_QUALIFIED');
  });

  it('returns NEEDS_FOUNDATIONS at threshold', () => {
    expect(determineVerdict(11, 8)).toBe('NEEDS_FOUNDATIONS');
  });

  it('returns NEEDS_FOUNDATIONS for moderate blended + moderate org', () => {
    expect(determineVerdict(20, 8)).toBe('NEEDS_FOUNDATIONS');
  });

  it('returns READY_FOR_PILOT at threshold', () => {
    expect(determineVerdict(21, 12)).toBe('READY_FOR_PILOT');
  });

  it('returns READY_FOR_PILOT for high blended + good org', () => {
    expect(determineVerdict(60, 16)).toBe('READY_FOR_PILOT');
  });

  it('returns NEEDS_FOUNDATIONS when blended is high but org is only moderate', () => {
    // blended >= 21 but org readiness only 8 (< 12)
    expect(determineVerdict(30, 8)).toBe('NEEDS_FOUNDATIONS');
  });
});

// ---------------------------------------------------------------------------
// findLimitingDimension
// ---------------------------------------------------------------------------

describe('findLimitingDimension', () => {
  it('identifies the dimension with the lowest percentage', () => {
    const dims: ScoringDimension[] = [
      { name: 'Scanner', score: 50, maxScore: 100 },
      { name: 'Interview', score: 30, maxScore: 100 },
      { name: 'Org', score: 16, maxScore: 20 },
    ];
    expect(findLimitingDimension(dims).name).toBe('Interview');
  });

  it('handles org readiness as limiting when scaled low', () => {
    const dims: ScoringDimension[] = [
      { name: 'Scanner', score: 60, maxScore: 100 },
      { name: 'Interview', score: 55, maxScore: 100 },
      { name: 'Org', score: 4, maxScore: 20 },
    ];
    expect(findLimitingDimension(dims).name).toBe('Org');
  });
});

// ---------------------------------------------------------------------------
// computeAssessment (integration tests)
// ---------------------------------------------------------------------------

describe('computeAssessment', () => {
  it('L1 startup with low everything → NOT_QUALIFIED', () => {
    const result = computeAssessment({
      scannerScore: 8,
      interviewScore: 12,
      orgReadiness: { ...NO_ORG_READINESS, appropriateTeamSize: true },
    });

    expect(result.blendedScore).toBeLessThan(15);
    expect(result.level).toBe('L1.0');
    expect(result.verdict).toBe('NOT_QUALIFIED');
    expect(result.orgReadinessScore).toBe(4);
  });

  it('L2 startup with good org readiness → READY_FOR_PILOT', () => {
    const result = computeAssessment({
      scannerScore: 35,
      interviewScore: 30,
      orgReadiness: {
        executiveSponsor: true,
        budgetAllocated: true,
        dedicatedOwner: true,
        awsRelationship: false,
        appropriateTeamSize: true,
      },
    });

    // blended = 35*0.4 + 30*0.4 + (16/20)*100*0.2 = 14 + 12 + 16 = 42
    expect(result.blendedScore).toBe(42);
    expect(result.level).toBe('L3.0');
    expect(result.verdict).toBe('READY_FOR_PILOT');
    expect(result.orgReadinessScore).toBe(16);
  });

  it('high scanner but low interview (gaming artifacts) → lower blended score', () => {
    const result = computeAssessment({
      scannerScore: 75,
      interviewScore: 15,
      orgReadiness: {
        executiveSponsor: true,
        budgetAllocated: false,
        dedicatedOwner: false,
        awsRelationship: true,
        appropriateTeamSize: true,
      },
    });

    // blended = 75*0.4 + 15*0.4 + (12/20)*100*0.2 = 30 + 6 + 12 = 48
    expect(result.blendedScore).toBe(48);
    expect(result.level).toBe('L3.0');
    // Interview is the limiting dimension (15%)
    expect(result.limitingDimension.name).toBe('SA Interview');
    expect(result.verdict).toBe('READY_FOR_PILOT');
  });

  it('high interview but low scanner → interview cannot carry alone', () => {
    const result = computeAssessment({
      scannerScore: 10,
      interviewScore: 70,
      orgReadiness: {
        executiveSponsor: true,
        budgetAllocated: true,
        dedicatedOwner: false,
        awsRelationship: false,
        appropriateTeamSize: true,
      },
    });

    // blended = 10*0.4 + 70*0.4 + (12/20)*100*0.2 = 4 + 28 + 12 = 44
    expect(result.blendedScore).toBe(44);
    expect(result.limitingDimension.name).toBe('Automated Scanner');
  });

  it('edge case: exactly at READY_FOR_PILOT threshold', () => {
    // Need blended >= 21 and org >= 12
    // scanner=20, interview=25, org=12
    // blended = 20*0.4 + 25*0.4 + (12/20)*100*0.2 = 8 + 10 + 12 = 30
    const result = computeAssessment({
      scannerScore: 20,
      interviewScore: 25,
      orgReadiness: {
        executiveSponsor: true,
        budgetAllocated: true,
        dedicatedOwner: true,
        awsRelationship: false,
        appropriateTeamSize: false,
      },
    });

    expect(result.blendedScore).toBe(30);
    expect(result.orgReadinessScore).toBe(12);
    expect(result.verdict).toBe('READY_FOR_PILOT');
    expect(result.level).toBe('L2.0');
  });

  it('edge case: just below NEEDS_FOUNDATIONS threshold', () => {
    // Need blended >= 11 and org >= 8
    // scanner=10, interview=10, org=4
    // blended = 10*0.4 + 10*0.4 + (4/20)*100*0.2 = 4 + 4 + 4 = 12
    // blended >= 11 but org < 8 → NOT_QUALIFIED
    const result = computeAssessment({
      scannerScore: 10,
      interviewScore: 10,
      orgReadiness: { ...NO_ORG_READINESS, appropriateTeamSize: true },
    });

    expect(result.orgReadinessScore).toBe(4);
    expect(result.verdict).toBe('NOT_QUALIFIED');
  });

  it('perfect scores → L5.0 READY_FOR_PILOT', () => {
    const result = computeAssessment({
      scannerScore: 100,
      interviewScore: 100,
      orgReadiness: FULL_ORG_READINESS,
    });

    expect(result.blendedScore).toBe(100);
    expect(result.level).toBe('L5.0');
    expect(result.verdict).toBe('READY_FOR_PILOT');
    expect(result.orgReadinessScore).toBe(20);
  });

  it('zero scores → L1.0 NOT_QUALIFIED', () => {
    const result = computeAssessment({
      scannerScore: 0,
      interviewScore: 0,
      orgReadiness: NO_ORG_READINESS,
    });

    expect(result.blendedScore).toBe(0);
    expect(result.level).toBe('L1.0');
    expect(result.verdict).toBe('NOT_QUALIFIED');
  });

  it('throws on invalid scanner score', () => {
    expect(() =>
      computeAssessment({
        scannerScore: 150,
        interviewScore: 50,
        orgReadiness: FULL_ORG_READINESS,
      }),
    ).toThrow('Scanner score must be 0-100');
  });

  it('throws on invalid interview score', () => {
    expect(() =>
      computeAssessment({
        scannerScore: 50,
        interviewScore: -5,
        orgReadiness: FULL_ORG_READINESS,
      }),
    ).toThrow('Interview score must be 0-100');
  });
});
