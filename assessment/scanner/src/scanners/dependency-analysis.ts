import { CategoryScore, Evidence, ScanConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const CATEGORY = 'Dependencies';
const MAX_POINTS = 2;

const AI_DEPENDENCIES = [
  // Anthropic / Claude
  '@anthropic-ai/sdk', 'anthropic',
  // AWS AI SDKs
  '@aws-sdk/client-bedrock', '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-bedrock-agent', '@aws-sdk/client-bedrock-agent-runtime',
  '@aws-sdk/client-sagemaker', '@aws-sdk/client-sagemaker-runtime',
  'boto3',  // check for bedrock usage
  // OpenAI
  'openai', '@openai/api',
  // LangChain
  'langchain', '@langchain/core', '@langchain/community', '@langchain/anthropic',
  '@langchain/aws', 'langchain-anthropic', 'langchain-aws',
  // Other AI frameworks
  'llamaindex', 'llama-index', '@llamaindex/core',
  'ai', '@ai-sdk/anthropic', '@ai-sdk/amazon-bedrock',
  'autogen', 'crewai', 'crew-ai',
  'semantic-kernel',
  // Evaluation
  'ragas', 'deepeval', 'promptfoo',
  // Vector / RAG
  'chromadb', 'pinecone', '@pinecone-database/pinecone',
  'weaviate-client', 'faiss-node', 'pgvector',
  // MCP
  '@modelcontextprotocol/sdk',
];

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];
  const foundDeps: string[] = [];

  // Check package.json
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      for (const dep of AI_DEPENDENCIES) {
        if (allDeps[dep]) {
          foundDeps.push(`${dep} (package.json)`);
        }
      }
    } catch {
      // skip
    }
  }

  // Check requirements.txt / pyproject.toml / Pipfile
  const pythonDepFiles = await glob('{requirements*.txt,pyproject.toml,Pipfile,setup.py,setup.cfg}', {
    cwd: repoPath, dot: true,
  }).catch(() => []);
  for (const file of pythonDepFiles) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8').toLowerCase();
      const pyAiDeps = [
        'anthropic', 'boto3', 'openai', 'langchain', 'llama-index',
        'llamaindex', 'autogen', 'crewai', 'semantic-kernel',
        'ragas', 'deepeval', 'promptfoo', 'chromadb', 'pinecone',
        'weaviate', 'faiss', 'pgvector', 'bedrock',
      ];
      for (const dep of pyAiDeps) {
        if (content.includes(dep)) {
          foundDeps.push(`${dep} (${file})`);
        }
      }
    } catch {
      // skip
    }
  }

  // Check go.mod
  const goModPath = path.join(repoPath, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, 'utf-8');
      if (/anthropic|bedrock|openai|langchain/i.test(content)) {
        foundDeps.push('AI SDK (go.mod)');
      }
    } catch {
      // skip
    }
  }

  // Check Cargo.toml
  const cargoPath = path.join(repoPath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf-8');
      if (/anthropic|bedrock|openai|llm/i.test(content)) {
        foundDeps.push('AI SDK (Cargo.toml)');
      }
    } catch {
      // skip
    }
  }

  // Deduplicate
  const uniqueDeps = [...new Set(foundDeps)];

  // AI SDKs present (1 pt)
  const hasAiSdk = uniqueDeps.length > 0;
  evidence.push({
    signal: 'AI SDKs in dependency files',
    found: hasAiSdk,
    points: hasAiSdk ? 1 : 0,
    detail: hasAiSdk
      ? `Found AI dependencies: ${uniqueDeps.slice(0, 8).join(', ')}`
      : 'No AI SDKs found in dependency files',
  });

  // Multiple AI dependencies (breadth) (1 pt)
  const hasBreadth = uniqueDeps.length >= 2;
  evidence.push({
    signal: 'Multiple AI-related dependencies (breadth)',
    found: hasBreadth,
    points: hasBreadth ? 1 : 0,
    detail: hasBreadth
      ? `${uniqueDeps.length} AI-related dependencies show breadth of AI adoption`
      : uniqueDeps.length === 1
        ? 'Only 1 AI dependency found (need 2+ for breadth credit)'
        : 'No AI dependencies found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
