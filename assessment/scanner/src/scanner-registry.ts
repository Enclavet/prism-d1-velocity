import { Scanner } from './types';
import * as aiToolConfig from './scanners/ai-tool-config';
import * as specDriven from './scanners/spec-driven';
import * as commitHygiene from './scanners/commit-hygiene';
import * as ciIntegration from './scanners/ci-integration';
import * as evalGates from './scanners/eval-gates';
import * as testingMaturity from './scanners/testing-maturity';
import * as aiObservability from './scanners/ai-observability';
import * as governance from './scanners/governance';
import * as agentWorkflows from './scanners/agent-workflows';
import * as platformReuse from './scanners/platform-reuse';
import * as documentation from './scanners/documentation';
import * as dependencyAnalysis from './scanners/dependency-analysis';

export const scanners: Scanner[] = [
  { name: 'AI Tool Config', scan: aiToolConfig.scan },
  { name: 'Spec-Driven Dev', scan: specDriven.scan },
  { name: 'Commit Hygiene', scan: commitHygiene.scan },
  { name: 'CI/CD Integration', scan: ciIntegration.scan },
  { name: 'Eval & Quality', scan: evalGates.scan },
  { name: 'Testing Maturity', scan: testingMaturity.scan },
  { name: 'AI Observability', scan: aiObservability.scan },
  { name: 'Governance', scan: governance.scan },
  { name: 'Agent Workflows', scan: agentWorkflows.scan },
  { name: 'Platform & Reuse', scan: platformReuse.scan },
  { name: 'Documentation', scan: documentation.scan },
  { name: 'Dependencies', scan: dependencyAnalysis.scan },
];
