# Module 00: Prerequisites & Environment Setup

| | |
|---|---|
| **Duration** | 30 minutes |
| **Prerequisites** | AWS account with admin access, macOS/Linux workstation, GitHub account |
| **Learning Objective** | Confirm a fully working AI-DLC toolchain: Claude Code (Bedrock-backed), Kiro IDE, git hooks, and sample-app repo |

---

## Instructor Facilitation Guide

### [0-5 min] Welcome and Logistics

> **Instructor Note:** Have participants open this checklist on their screens immediately. The single biggest risk to the workshop timeline is a participant stuck on setup at minute 45. Front-load troubleshooting here.

Welcome to the PRISM D1 Velocity workshop. Before we write a single line of code, we need every machine in the room running the same toolchain. This module is pass/fail -- you either see green checks from the verification script or you don't.

**Key talking points:**
- This workshop uses Claude on Amazon Bedrock, not the consumer API. Your prompts stay in your AWS account.
- Kiro is the spec-authoring IDE; Claude Code is the CLI that does the implementation. They complement each other.
- Everything we build today flows into real metrics pipelines. Setup matters.

---

### [5-15 min] Environment Setup Checklist

Walk participants through each item. Have them check off as they go.

#### 1. AWS Account & Bedrock Access

```bash
# Verify AWS CLI is installed and configured
aws sts get-caller-identity

# Verify Bedrock model access for Claude Sonnet/Opus
aws bedrock list-foundation-models \
  --query "modelSummaries[?contains(modelId, 'anthropic')].[modelId, modelLifecycle.status]" \
  --output table
```

> **Instructor Note:** If participants are using a shared workshop AWS account, distribute pre-configured credentials here. If they use their own accounts, they need to have enabled Claude model access in the Bedrock console beforehand. This is the most common blocker -- model access requests can take minutes to hours.

Required Bedrock models:
- `anthropic.claude-sonnet-4-20250514` (primary model for Claude Code)
- `anthropic.claude-haiku-3-20250307` (used for eval gates in Module 04)

#### 2. Claude Code CLI

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Configure for Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-west-2

# Verify Bedrock connectivity
claude --print-system-prompt > /dev/null && echo "Claude Code OK"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) so it persists:

```bash
echo 'export CLAUDE_CODE_USE_BEDROCK=1' >> ~/.zshrc
echo 'export AWS_REGION=us-west-2' >> ~/.zshrc
source ~/.zshrc
```

#### 3. Kiro IDE

```bash
# Verify Kiro is installed (download from https://kiro.dev if not)
which kiro || echo "Kiro not found - install from https://kiro.dev"

# Open Kiro and sign in with your AWS Builder ID
kiro --version
```

> **Instructor Note:** Kiro requires an AWS Builder ID (free). If participants don't have one, they can create it in 2 minutes at https://profile.aws.amazon.com/. Do NOT let this derail into a 10-minute account creation exercise -- pair people up if needed.

#### 4. Git and Hooks Prerequisites

```bash
# Git version (need 2.34+ for trailer support)
git --version

# Verify jq is installed (used by metric hooks)
jq --version

# Verify GitHub CLI (used in Module 03-04)
gh --version
gh auth status
```

#### 5. Clone the Sample App

```bash
# Clone the workshop sample application
git clone https://github.com/aws-samples/prism-d1-sample-app.git
cd prism-d1-sample-app

# Install dependencies
npm install

# Verify it runs
npm run dev &
curl -s http://localhost:3000/health | jq .
# Expected: { "status": "ok" }
kill %1
```

#### 6. Node.js and TypeScript

```bash
# Node 20+ required
node --version

# TypeScript
npx tsc --version
```

---

### [15-25 min] Run Verification Script

Have everyone run the verification script:

```bash
cd /path/to/workshop/00-prerequisites/exercises/
chmod +x verify-setup.sh
./verify-setup.sh
```

The script checks every prerequisite and prints a pass/fail summary. All items must pass before proceeding.

> **Instructor Note:** Walk the room while the script runs. Common failures:
> - Bedrock model access not enabled (fix: AWS Console > Bedrock > Model access)
> - Old git version on macOS (fix: `brew install git`)
> - Missing jq (fix: `brew install jq` or `apt-get install jq`)
> - Claude Code not picking up Bedrock config (fix: check env vars are exported, not just set)

---

### [25-30 min] Troubleshooting & Buffer

Use this time to help anyone still stuck. If everyone passes, use the time to give a 2-minute preview of what we'll build today.

**Preview talking points:**
- Module 01: Configure Claude Code, make your first AI-assisted commit
- Module 02: Write specs in Kiro, implement with Claude Code
- Module 03: Install hooks that track AI contribution metrics
- Module 04: Add eval gates that catch bad AI output in CI
- Module 05: See it all on a dashboard

---

## Common Questions

**Q: Can I use Claude's direct API instead of Bedrock?**
A: For this workshop, no. PRISM's metric pipeline assumes Bedrock as the backend because it gives you CloudTrail logging, VPC endpoints, and consistent billing through your AWS account. In production, you'd also get model invocation logging for audit trails.

**Q: Why Claude Code CLI and not just Kiro's built-in AI?**
A: They serve different purposes. Kiro is where you write and manage specs. Claude Code is the autonomous coding agent that implements against those specs, generates commits with metadata, and integrates with your CI pipeline. You'll use both today.

**Q: Do I need a powerful machine for this?**
A: No. All LLM inference happens on Bedrock. Your laptop just needs to run Node.js, git, and the CLI tools. Any machine from the last 5 years is fine.

**Q: What if my company blocks npm global installs?**
A: Use `npx @anthropic-ai/claude-code` instead of installing globally. All exercises work with npx.
