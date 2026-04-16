import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Agent Workflows';
const MAX_POINTS = 8;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  const allFiles = await glob('**/*.{ts,js,py,yaml,yml,json,toml}', {
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

  // Agent definitions, orchestration configs (2 pts)
  const agentPatterns = [
    /agent[_-]?definition/i, /agent[_-]?config/i,
    /agent[_-]?orchestrat/i, /multi[_-]?agent/i,
    /agent[_-]?workflow/i, /agentic/i,
    /bedrock[_-]?agent/i, /create[_-]?agent/i,
    /agent[_-]?executor/i, /agent[_-]?chain/i,
    /crew[_-]?ai/i, /autogen/i, /langgraph/i,
    /step[_-]?functions.*agent/i,
    /\bstrands\b/i, /@tool/i, /from\s+strands/i,
    /strands\.agents/i, /strands[_-]agents/i,
    /\bagentcore\b/i, /agent[_-]?core/i,
    /AgentCoreRuntime/i, /agentcore[_-]runtime/i,
    /agentcore\.json/i,
  ];
  let hasAgentDefs = false;
  let agentDefDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of agentPatterns) {
      if (pat.test(content)) {
        hasAgentDefs = true;
        agentDefDetail = `${file} contains agent definitions/orchestration (${pat.source})`;
        break;
      }
    }
    if (hasAgentDefs) break;
  }

  // Also check for agent-specific files
  if (!hasAgentDefs) {
    const agentFiles = await glob('**/{agent,agents}/**', {
      cwd: repoPath, dot: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    }).catch(() => []);
    if (agentFiles.length > 0) {
      hasAgentDefs = true;
      agentDefDetail = `Found agent directory: ${agentFiles[0]}`;
    }
  }

  evidence.push({
    signal: 'Agent definitions or orchestration configs',
    found: hasAgentDefs,
    points: hasAgentDefs ? 2 : 0,
    detail: hasAgentDefs ? agentDefDetail : 'No agent definitions or orchestration configurations found',
  });

  // MCP server configs or tool registrations (2 pts)
  const mcpPatterns = [
    /mcp[_-]?server/i, /mcp[_-]?config/i,
    /model[_-]?context[_-]?protocol/i,
    /tool[_-]?registration/i, /tool[_-]?registry/i,
    /tools[_-]?config/i, /function[_-]?calling/i,
    /tool[_-]?use/i, /tool[_-]?definition/i,
    /McpServer/i, /mcp_server/i,
    /stdio[_-]?transport/i, /@modelcontextprotocol/i,
  ];
  let hasMcp = false;
  let mcpDetail = '';

  // Check for .mcp files or mcp directories
  const mcpFiles = await glob('**/.mcp*', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);
  const mcpDirs = await glob('**/mcp/**', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);

  if (mcpFiles.length > 0 || mcpDirs.length > 0) {
    hasMcp = true;
    mcpDetail = `Found MCP config: ${mcpFiles[0] || mcpDirs[0]}`;
  } else {
    for (const [file, content] of contentCache) {
      for (const pat of mcpPatterns) {
        if (pat.test(content)) {
          hasMcp = true;
          mcpDetail = `${file} contains MCP/tool registration references (${pat.source})`;
          break;
        }
      }
      if (hasMcp) break;
    }
  }

  evidence.push({
    signal: 'MCP server configs or tool registrations',
    found: hasMcp,
    points: hasMcp ? 2 : 0,
    detail: hasMcp ? mcpDetail : 'No MCP server configs or tool registrations found',
  });

  // Agent audit trail configuration (1 pt)
  const auditPatterns = [
    /agent.*audit/i, /audit.*trail/i, /agent.*log/i,
    /agent.*trace/i, /agent.*observ/i,
    /trace[_-]?id/i, /execution[_-]?log/i,
    /agent.*monitor/i, /run[_-]?history/i,
  ];
  let hasAudit = false;
  let auditDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of auditPatterns) {
      if (pat.test(content)) {
        hasAudit = true;
        auditDetail = `${file} contains agent audit/trace configuration (${pat.source})`;
        break;
      }
    }
    if (hasAudit) break;
  }
  evidence.push({
    signal: 'Agent audit trail configuration',
    found: hasAudit,
    points: hasAudit ? 1 : 0,
    detail: hasAudit ? auditDetail : 'No agent audit trail configuration found',
  });

  // AgentCore deployment configs or scripts (1 pt)
  const agentcoreDeployPatterns = [
    /agentcore\.json/i, /agentcore[_-]?deploy/i,
    /agentcore[_-]?config/i, /AgentCoreRuntime/i,
    /agent[_-]?core.*deploy/i, /deploy.*agent[_-]?core/i,
  ];
  let hasAgentCoreDeploy = false;
  let agentCoreDeployDetail = '';

  const agentcoreFiles = await glob('**/agentcore.json', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);

  if (agentcoreFiles.length > 0) {
    hasAgentCoreDeploy = true;
    agentCoreDeployDetail = `Found AgentCore config: ${agentcoreFiles[0]}`;
  } else {
    for (const [file, content] of contentCache) {
      for (const pat of agentcoreDeployPatterns) {
        if (pat.test(content)) {
          hasAgentCoreDeploy = true;
          agentCoreDeployDetail = `${file} contains AgentCore deployment configuration (${pat.source})`;
          break;
        }
      }
      if (hasAgentCoreDeploy) break;
    }
  }

  evidence.push({
    signal: 'AgentCore deployment configuration',
    found: hasAgentCoreDeploy,
    points: hasAgentCoreDeploy ? 1 : 0,
    detail: hasAgentCoreDeploy ? agentCoreDeployDetail : 'No AgentCore deployment configs or scripts found',
  });

  // Agent testing and eval rubrics (1 pt)
  const agentTestPatterns = [
    /test[_-]?agent/i, /agent.*test/i, /agent.*eval/i,
    /conftest/i, /mock.*agent/i,
    /agent.*spec/i, /eval[_-]?rubric/i,
    /agent.*fixture/i,
  ];
  let hasAgentTesting = false;
  let agentTestDetail = '';

  const agentTestFiles = await glob('**/*{test_agent,agent_test,agent.test,agent.spec,agent_eval}*', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);

  if (agentTestFiles.length > 0) {
    hasAgentTesting = true;
    agentTestDetail = `Found agent test file: ${agentTestFiles[0]}`;
  } else {
    for (const [file, content] of contentCache) {
      for (const pat of agentTestPatterns) {
        if (pat.test(content)) {
          hasAgentTesting = true;
          agentTestDetail = `${file} contains agent testing patterns (${pat.source})`;
          break;
        }
      }
      if (hasAgentTesting) break;
    }
  }

  evidence.push({
    signal: 'Agent testing and eval rubrics',
    found: hasAgentTesting,
    points: hasAgentTesting ? 1 : 0,
    detail: hasAgentTesting ? agentTestDetail : 'No agent test files or eval rubrics found',
  });

  // Agent metrics emission (1 pt)
  const agentMetricPatterns = [
    /prism\.d1\.agent/i, /agent[_-]?invocation/i,
    /AgentInvocationCount/i, /agent[_-]?metric/i,
    /agent.*telemetry/i, /agent.*emit/i,
  ];
  let hasAgentMetrics = false;
  let agentMetricDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of agentMetricPatterns) {
      if (pat.test(content)) {
        hasAgentMetrics = true;
        agentMetricDetail = `${file} contains agent metric emission (${pat.source})`;
        break;
      }
    }
    if (hasAgentMetrics) break;
  }

  evidence.push({
    signal: 'Agent metrics emission',
    found: hasAgentMetrics,
    points: hasAgentMetrics ? 1 : 0,
    detail: hasAgentMetrics ? agentMetricDetail : 'No agent metric emission patterns found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
