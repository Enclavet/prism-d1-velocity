# PRISM D1: Velocity — AI Development Lifecycle Workshop

> :warning: **Sample Project — Not Production-Ready**
>
> This project is provided as a sample and reference implementation only. It is not designed, tested, or hardened for production use. Use it as a starting point or learning resource, and perform your own security review, testing, and operational hardening before deploying to any production environment.

> Compress the idea-to-production loop with disciplined AI adoption.

Part of the [PRISM Framework](../README.md) (Progressive Readiness Index for Scalable Maturity) — the D1 Velocity pillar focuses on AI-native software development lifecycle practices that are **measurable from Day 1**.

## What This Repo Contains

### For Engineering Leaders (Top-Down Visibility)

- **AWS-native dashboards** comparable to Jellyfish/Swarmia — but built on CloudWatch + QuickSight
- **Enhanced DORA metrics** with AI-specific dimensions (acceptance rate, AI-to-merge ratio, eval gate pass rate)
- **Executive readout templates** that connect engineering metrics to business outcomes
- **PRISM level tracking** — see your org's maturity score change over time

### For Engineering Teams (Bottom-Up Activation)

- **4-hour workshop** (+ extensions) with hands-on exercises using Claude Code + Bedrock
- **Spec-driven development** templates compatible with Kiro
- **AI agent development** — build agents with Strands SDK, MCP, and Amazon Bedrock AgentCore
- **Bootstrapper code** — git hooks, CI workflows, eval harnesses, agent configs teams inherit permanently
- **Sample application** with task API + MCP server + Strands agent to practice AI-DLC patterns

## Quick Start

### Prerequisites

Run the prism-cli command to verify and setup everything:

```bash
bash prism-cli.sh workshop verify-setup
```

Or install manually:

- AWS Account with Bedrock access (Claude models enabled)
- Node.js 20+ and npm
- Python 3.11+ (for Strands Agent)
- AWS CLI v2 and CDK v2 (`npm install -g aws-cdk`)
- Claude Code CLI configured for Bedrock (`export CLAUDE_CODE_USE_BEDROCK=1`)
- Git 2.40+, jq, GitHub CLI

The setup script supports flags:
- `--skip-aws` — skip AWS credential and Bedrock checks (for offline prep)
- `--skip-kiro` — skip Kiro IDE check
- `--verify-only` — only verify, don't install anything

### Deploy the Metrics Platform

```bash
cd infra
npm install
npx cdk bootstrap   # First time only
npx cdk deploy --all
```

### Assess a Customer

Run the [PRISM Assessment](assessment/README.md) to determine maturity level and onboarding track. See the [full methodology guide](assessment/ASSESSMENT-GUIDE.md) for scanner logic, interview rubrics, and scoring formulas.

### Run the Workshop

Open the [AWS Workshop](https://studio.us-east-1.prod.workshops.aws/preview/d0a8b037-dfe0-4023-9ce2-f5de32ee4c67/builds/c24d36f6-fd95-477d-98da-3838ac74ee71) from your browser.

### Run the Sample Agent (No AWS Required)

```bash
cd sample-app
npm install && npm run dev          # Start the task API

cd agent
pip install -e ".[dev]"
python scripts/run-demo.py --mock   # Run agent demo with mock model
```

### Adopt the Bootstrapper (Post-Workshop)

```bash
# Copy into your project
cp -r bootstrapper/ ~/your-repo/.prism/
cd ~/your-repo

# Install hooks and workflows
.prism/metric-hooks/install.sh
cp .prism/github-workflows/*.yml .github/workflows/
cp .prism/claude-code/CLAUDE.md ./CLAUDE.md

# For agent projects, also copy:
cp .prism/agent-configs/ ./agent-configs/
cp .prism/claude-code/CLAUDE-agent.md ./CLAUDE-agent.md

# Configure your team ID
echo 'PRISM_TEAM_ID=your-team-name' >> .env
```

## Enhanced AI-DORA Metrics

| Metric | Source | L2 Target | L4 Target |
|--------|--------|-----------|-----------|
| Deployment Frequency | GitHub/CodePipeline | Weekly | Daily+ |
| Lead Time for Changes | PR created → deployed | < 1 week | < 1 day |
| Change Failure Rate | Rollback/hotfix ratio | < 15% | < 5% |
| MTTR | Incident → resolution | < 24h | < 1h |
| **AI Acceptance Rate** | Git hooks + Claude Code | >= 30% | >= 55% |
| **AI-to-Merge Ratio** | CI metadata | >= 20% | >= 45% |
| **Spec-to-Code Turnaround** | Spec commit → PR ready | Baseline set | < 2 days |
| **Post-Merge Defect Rate** | Bug tracker + AI origin tag | <= 1.2x human | <= 0.9x |
| **Eval Gate Pass Rate** | Bedrock Evaluations in CI | >= 80% | >= 95% |
| **AI Test Coverage Delta** | Coverage tool + AI origin tag | > 15% | > 40% |

## Architecture

```
Developer Workstation              AWS Metrics Platform
────────────────────              ────────────────────
Claude Code ──────┐
Kiro Specs ───────┤               ┌──────────────┐
Git Hooks ────────┼── API GW ───→ │ EventBridge  │
GitHub Actions ───┤               └──────┬───────┘
Bedrock Evals ────┤                      │
Strands Agents ───┘               ┌──────▼───────┐
      │                           │   Lambda     │  enrich + normalize
  MCP Server ←── Tool Discovery   └──────┬───────┘
      │                                  │
  AgentCore ←── Runtime + Ops    ┌───────┼────────┐
                                 ▼       ▼        ▼
                             DynamoDB DynamoDB CloudWatch
                             (events) (metadata)   │
                                 │       │        │
                                 └───────┼────────┘
                                         ▼
                              ┌──────────────────┐
                              │    QuickSight    │  Executive Readout
                              │    CloudWatch    │  Team Dashboard
                              └──────────────────┘
```

## PRISM Maturity Levels (D1 Velocity)

| Level | Name | What It Looks Like |
|-------|------|--------------------|
| L1 | Experimental | Ad hoc AI use, no metrics, no shared tooling |
| L2 | Structured | Claude Code + Kiro adopted, acceptance rate tracked in CI |
| L3 | Integrated | Eval gates in pipeline, AI-DORA dashboards live, spec-driven workflow |
| L4 | Orchestrated | Multi-team platform, AI FinOps, governed agent scope |
| L5 | Autonomous | Agents contributing to architecture, >20% autonomous deployments |

## AI Agent Development

The repo includes a complete agent development stack for PRISM Level 3+ teams:

| Component | Technology | Location |
|-----------|-----------|----------|
| **Agent Framework** | Strands Agents SDK (Python) | `sample-app/agent/` |
| **Tool Integration** | Model Context Protocol (MCP) | `sample-app/src/mcp/` |
| **Production Hosting** | Amazon Bedrock AgentCore | `bootstrapper/agent-configs/` |
| **Agent Eval** | Bedrock Evaluations | `bootstrapper/eval-harness/rubrics/agent-quality.json` |
| **Workshop** | Module 02: Agent Development | `workshop/02-agent-development/` |

**GitHub Pages**: [sunilpp.github.io/prism-d1-velocity](https://sunilpp.github.io/prism-d1-velocity/)

## License

Internal use — AWS Solutions Architecture, Startups Organization.
