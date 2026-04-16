export interface Evidence {
  signal: string;
  found: boolean;
  points: number;
  detail: string;
}

export interface CategoryScore {
  category: string;
  maxPoints: number;
  earnedPoints: number;
  evidence: Evidence[];
}

export interface ScanConfig {
  repoPath: string;
  verbose: boolean;
  commitDepth: number;
}

export type PRISMLevel =
  | 'L1.0'
  | 'L1.5'
  | 'L2.0'
  | 'L2.5'
  | 'L3.0'
  | 'L3.5'
  | 'L4.0'
  | 'L4.5'
  | 'L5.0';

export interface PRISMLevelInfo {
  level: PRISMLevel;
  label: string;
  description: string;
}

export interface ScanResult {
  repoPath: string;
  repoName: string;
  scanDate: string;
  totalScore: number;
  maxScore: number;
  prismLevel: PRISMLevelInfo;
  categories: CategoryScore[];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export type OutputFormat = 'console' | 'json' | 'markdown';

export interface CLIOptions {
  repo: string;
  output: OutputFormat;
  outputFile?: string;
  verbose: boolean;
}

export interface Scanner {
  name: string;
  scan: (repoPath: string, config: ScanConfig) => Promise<CategoryScore>;
}
