import { CategoryScore, Evidence, ScanConfig } from '../types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY = 'Platform & Reuse';
const MAX_POINTS = 5;

export async function scan(repoPath: string, config: ScanConfig): Promise<CategoryScore> {
  const evidence: Evidence[] = [];

  const allFiles = await glob('**/*.{ts,js,py,yaml,yml,json,toml,md}', {
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

  // Shared prompt library / prompt registry (2 pts)
  const promptDirs = await glob('**/{prompts,prompt-library,prompt-templates,prompt_templates}/**', {
    cwd: repoPath, dot: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  }).catch(() => []);

  let hasPromptLib = promptDirs.length > 0;
  let promptLibDetail = promptDirs.length > 0 ? `Found prompt library: ${promptDirs[0]}` : '';

  if (!hasPromptLib) {
    const promptPatterns = [
      /prompt[_-]?registry/i, /prompt[_-]?library/i,
      /prompt[_-]?template/i, /system[_-]?prompt/i,
      /shared[_-]?prompt/i, /prompt[_-]?catalog/i,
      /prompt[_-]?store/i,
    ];
    for (const [file, content] of contentCache) {
      for (const pat of promptPatterns) {
        if (pat.test(content)) {
          hasPromptLib = true;
          promptLibDetail = `${file} contains prompt library references (${pat.source})`;
          break;
        }
      }
      if (hasPromptLib) break;
    }
  }
  evidence.push({
    signal: 'Shared prompt library or prompt registry',
    found: hasPromptLib,
    points: hasPromptLib ? 2 : 0,
    detail: hasPromptLib ? promptLibDetail : 'No shared prompt library or registry found',
  });

  // Model gateway or centralized AI config (2 pts)
  const gatewayPatterns = [
    /model[_-]?gateway/i, /ai[_-]?gateway/i, /llm[_-]?gateway/i,
    /centralized.*model/i, /model[_-]?router/i,
    /bedrock[_-]?gateway/i, /inference[_-]?gateway/i,
    /ai[_-]?platform/i, /model[_-]?service/i,
    /api[_-]?gateway.*model/i, /litellm/i,
  ];
  let hasGateway = false;
  let gatewayDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of gatewayPatterns) {
      if (pat.test(content)) {
        hasGateway = true;
        gatewayDetail = `${file} contains model gateway/platform references (${pat.source})`;
        break;
      }
    }
    if (hasGateway) break;
  }
  evidence.push({
    signal: 'Model gateway or centralized AI config',
    found: hasGateway,
    points: hasGateway ? 2 : 0,
    detail: hasGateway ? gatewayDetail : 'No model gateway or centralized AI configuration found',
  });

  // RAG / Knowledge Base configurations (1 pt)
  const ragPatterns = [
    /rag/i, /knowledge[_-]?base/i, /retrieval[_-]?augment/i,
    /vector[_-]?store/i, /vector[_-]?db/i, /embedding/i,
    /opensearch.*vector/i, /pinecone/i, /chromadb/i, /chroma/i,
    /weaviate/i, /faiss/i, /pgvector/i, /kendra/i,
  ];
  let hasRag = false;
  let ragDetail = '';
  for (const [file, content] of contentCache) {
    for (const pat of ragPatterns) {
      if (pat.test(content)) {
        hasRag = true;
        ragDetail = `${file} contains RAG/Knowledge Base references (${pat.source})`;
        break;
      }
    }
    if (hasRag) break;
  }
  evidence.push({
    signal: 'RAG / Knowledge Base configurations',
    found: hasRag,
    points: hasRag ? 1 : 0,
    detail: hasRag ? ragDetail : 'No RAG or Knowledge Base configurations found',
  });

  const earnedPoints = evidence.reduce((sum, e) => sum + e.points, 0);
  return { category: CATEGORY, maxPoints: MAX_POINTS, earnedPoints, evidence };
}
