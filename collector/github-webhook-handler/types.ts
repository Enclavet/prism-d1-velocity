// ---------------------------------------------------------------------------
// GitHub Webhook Payload Types
// ---------------------------------------------------------------------------

export interface GitHubCommit {
  id: string;
  message: string;
  timestamp: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: GitHubRepository;
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
  pusher: { name: string; email: string };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  user: { login: string };
  labels: Array<{ name: string }>;
  body: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
}

export interface GitHubPullRequestEvent {
  action: 'opened' | 'closed' | 'synchronize' | 'reopened' | 'edited';
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
}

export interface GitHubDeploymentEvent {
  deployment: {
    id: number;
    sha: string;
    ref: string;
    environment: string;
    created_at: string;
    creator: { login: string };
    description: string | null;
  };
  repository: GitHubRepository;
}

export interface GitHubDeploymentStatusEvent {
  deployment_status: {
    id: number;
    state: 'error' | 'failure' | 'inactive' | 'in_progress' | 'queued' | 'pending' | 'success';
    environment: string;
    created_at: string;
    description: string | null;
  };
  deployment: {
    id: number;
    sha: string;
    ref: string;
    environment: string;
    created_at: string;
  };
  repository: GitHubRepository;
}

export interface GitHubCheckRunEvent {
  action: 'created' | 'completed' | 'rerequested' | 'requested_action';
  check_run: {
    id: number;
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'skipped' | null;
    started_at: string;
    completed_at: string | null;
    head_sha: string;
    output: {
      title: string | null;
      summary: string | null;
      text: string | null;
    };
  };
  repository: GitHubRepository;
}

export interface GitHubRepository {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
}

// ---------------------------------------------------------------------------
// PRISM Metric Event Types
// ---------------------------------------------------------------------------

export type AITool = 'claude-code' | 'kiro' | 'q-developer';
export type AIOrigin = 'ai-assisted' | 'ai-generated' | 'human';
export type PrismDetailType =
  | 'prism.d1.commit'
  | 'prism.d1.pr'
  | 'prism.d1.deploy'
  | 'prism.d1.eval'
  | 'prism.d1.incident'
  | 'prism.d1.assessment';

export interface AIContext {
  tool: AITool | string;
  model: string | null;
  origin: AIOrigin;
}

export interface DORAMetrics {
  deployment_frequency: number | null;
  lead_time_seconds: number | null;
  change_failure_rate: number | null;
  mttr_seconds: number | null;
}

export interface AIDORAMetrics {
  ai_acceptance_rate: number | null;
  ai_to_merge_ratio: number | null;
  spec_to_code_hours: number | null;
  post_merge_defect_rate: number | null;
  eval_gate_pass_rate: number | null;
  ai_test_coverage_delta: number | null;
}

export interface PrismMetricDetail {
  team_id: string;
  repo: string;
  timestamp: string;
  prism_level: number | null;
  metric: {
    name: string;
    value: number;
    unit: string;
  };
  ai_context: AIContext;
  dora: DORAMetrics;
  ai_dora: AIDORAMetrics;
}

export interface PrismEvent {
  source: 'prism.d1.velocity';
  detailType: PrismDetailType;
  detail: PrismMetricDetail;
}

// ---------------------------------------------------------------------------
// Parsed AI Trailers from commit messages
// ---------------------------------------------------------------------------

export interface AITrailers {
  origin: AIOrigin;
  model: string | null;
  tool: string | null;
  specRef: string | null;
}
