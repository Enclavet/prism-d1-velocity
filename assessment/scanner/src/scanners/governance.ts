import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Governance';
const MAX_POINTS = 5;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  const allFiles = await glob('**/*.{ts,js,py,yaml,yml,json,tf,hcl,md}', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'package-lock.json', 'yarn.lock', 'vendor/**'],
  }).catch(() => []);

  const contentCache: Map<string, string> = new Map();
  for (const file of allFiles.slice(0, 200)) {
    try {
      contentCache.set(file, fs.readFileSync(path.join(repoPath, file), 'utf-8'));
    } catch {
      // skip
    }
  }

  // Bedrock Guardrails config (2 pts)
  const guardrailPatterns = [
    /bedrock.*guardrail/i, /guardrail.*config/i,
    /CreateGuardrail/i, /guardrail[_-]?id/i,
    /content[_-]?filter/i, /content[_-]?policy/i,
    /guardrails/i, /responsible[_-]?ai/i,
  ];
  let hasGuardrails = false;
  let guardrailDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of guardrailPatterns) {
      if (pat.test(content)) {
        hasGuardrails = true;
        guardrailDetail = `${file} contains guardrail configuration (${pat.source})`;
        break;
      }
    }
    if (hasGuardrails) break;
  }
  evidence.push({
    signal: 'Bedrock Guardrails config',
    found: hasGuardrails,
    points: hasGuardrails ? 2 : 0,
    detail: hasGuardrails ? guardrailDetail : 'No Bedrock Guardrails or content filtering config found',
  });

  // Autonomy tier definitions or agent permission configs (2 pts)
  const autonomyPatterns = [
    /autonomy[_-]?tier/i, /autonomy[_-]?level/i,
    /agent[_-]?permission/i, /agent[_-]?policy/i,
    /agent[_-]?role/i, /agent[_-]?scope/i,
    /human[_-]?in[_-]?the[_-]?loop/i, /hitl/i,
    /approval[_-]?gate/i, /approval[_-]?workflow/i,
    /escalation[_-]?policy/i, /agent[_-]?governance/i,
  ];
  let hasAutonomy = false;
  let autonomyDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of autonomyPatterns) {
      if (pat.test(content)) {
        hasAutonomy = true;
        autonomyDetail = `${file} contains autonomy/permission configuration (${pat.source})`;
        break;
      }
    }
    if (hasAutonomy) break;
  }
  evidence.push({
    signal: 'Autonomy tier definitions or agent permission configs',
    found: hasAutonomy,
    points: hasAutonomy ? 2 : 0,
    detail: hasAutonomy ? autonomyDetail : 'No autonomy tiering or agent permission configurations found',
  });

  // AI-specific IAM policies or security reviews (1 pt)
  const securityPatterns = [
    /ai.*iam/i, /bedrock.*policy/i, /invoke[_-]?model.*policy/i,
    /ai.*security/i, /model.*access/i,
    /bedrock.*role/i, /sagemaker.*role/i,
    /ai[_-]?security[_-]?review/i, /threat[_-]?model.*ai/i,
  ];
  let hasSecurity = false;
  let securityDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of securityPatterns) {
      if (pat.test(content)) {
        hasSecurity = true;
        securityDetail = `${file} references AI security or IAM (${pat.source})`;
        break;
      }
    }
    if (hasSecurity) break;
  }
  evidence.push({
    signal: 'AI-specific IAM policies or security reviews',
    found: hasSecurity,
    points: hasSecurity ? 1 : 0,
    detail: hasSecurity ? securityDetail : 'No AI-specific IAM or security review references found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
