#!/usr/bin/env bash
# PRISM D1 Velocity Workshop - Environment Verification Script
# Run this to confirm all prerequisites are met before starting the workshop.

set -euo pipefail

PASS=0
FAIL=0
WARN=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

pass() {
  echo -e "  ${GREEN}[PASS]${NC} $1"
  ((PASS++))
}

fail() {
  echo -e "  ${RED}[FAIL]${NC} $1"
  echo -e "        Fix: $2"
  ((FAIL++))
}

warn() {
  echo -e "  ${YELLOW}[WARN]${NC} $1"
  ((WARN++))
}

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  PRISM D1 Velocity - Environment Verification  ${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

# -------------------------------------------------------------------
# 1. AWS CLI
# -------------------------------------------------------------------
echo -e "${BOLD}1. AWS CLI & Credentials${NC}"

if command -v aws &> /dev/null; then
  pass "AWS CLI installed ($(aws --version 2>&1 | head -1))"
else
  fail "AWS CLI not found" "Install from https://aws.amazon.com/cli/"
fi

if aws sts get-caller-identity &> /dev/null; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
  pass "AWS credentials configured (account: ${ACCOUNT_ID})"
else
  fail "AWS credentials not configured or expired" "Run 'aws configure' or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY"
fi

# -------------------------------------------------------------------
# 2. Bedrock Model Access
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}2. Amazon Bedrock Model Access${NC}"

if aws bedrock list-foundation-models --query "modelSummaries[?contains(modelId, 'anthropic.claude')]" --output text &> /dev/null; then
  CLAUDE_MODELS=$(aws bedrock list-foundation-models \
    --query "modelSummaries[?contains(modelId, 'anthropic.claude')].modelId" \
    --output text 2>/dev/null | wc -w | tr -d ' ')
  if [ "$CLAUDE_MODELS" -gt 0 ]; then
    pass "Bedrock lists ${CLAUDE_MODELS} Claude model(s)"
  else
    fail "No Claude models found in Bedrock" "Enable Claude model access in AWS Console > Bedrock > Model access"
  fi
else
  fail "Cannot query Bedrock models" "Check AWS credentials and region (need us-west-2 or us-west-2)"
fi

# Quick invocation test
if aws bedrock-runtime invoke-model \
  --model-id "anthropic.claude-haiku-3-20250307" \
  --content-type "application/json" \
  --accept "application/json" \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":10,"messages":[{"role":"user","content":"Say OK"}]}' \
  /tmp/prism-bedrock-test.json &> /dev/null; then
  pass "Bedrock Claude invocation works"
  rm -f /tmp/prism-bedrock-test.json
else
  fail "Cannot invoke Claude on Bedrock" "Ensure model access is granted for Claude models in your region"
fi

# -------------------------------------------------------------------
# 3. Claude Code CLI
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}3. Claude Code CLI${NC}"

if command -v claude &> /dev/null; then
  pass "Claude Code CLI installed ($(claude --version 2>/dev/null || echo 'version unknown'))"
else
  fail "Claude Code CLI not found" "Run: npm install -g @anthropic-ai/claude-code"
fi

if [ "${CLAUDE_CODE_USE_BEDROCK:-}" = "1" ]; then
  pass "CLAUDE_CODE_USE_BEDROCK=1 is set"
else
  fail "CLAUDE_CODE_USE_BEDROCK not set" "Run: export CLAUDE_CODE_USE_BEDROCK=1"
fi

if [ -n "${AWS_REGION:-}" ]; then
  pass "AWS_REGION is set (${AWS_REGION})"
else
  warn "AWS_REGION not set -- Claude Code will use default region. Set with: export AWS_REGION=us-west-2"
fi

# -------------------------------------------------------------------
# 4. Kiro IDE
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}4. Kiro IDE${NC}"

if command -v kiro &> /dev/null; then
  pass "Kiro CLI found ($(kiro --version 2>/dev/null || echo 'version unknown'))"
else
  warn "Kiro CLI not found in PATH -- verify Kiro is installed from https://kiro.dev"
fi

# -------------------------------------------------------------------
# 5. Git
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}5. Git${NC}"

if command -v git &> /dev/null; then
  GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
  GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
  if [ "$GIT_MAJOR" -ge 2 ] && [ "$GIT_MINOR" -ge 34 ]; then
    pass "Git $(git --version) (>= 2.34 required for trailer support)"
  else
    fail "Git version too old ($(git --version))" "Need git >= 2.34. Run: brew install git (macOS) or apt-get install git (Linux)"
  fi
else
  fail "Git not found" "Install git"
fi

if gh auth status &> /dev/null 2>&1; then
  pass "GitHub CLI authenticated"
else
  if command -v gh &> /dev/null; then
    fail "GitHub CLI installed but not authenticated" "Run: gh auth login"
  else
    fail "GitHub CLI not found" "Install from https://cli.github.com/ then run: gh auth login"
  fi
fi

# -------------------------------------------------------------------
# 6. Node.js & npm
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}6. Node.js & npm${NC}"

if command -v node &> /dev/null; then
  NODE_MAJOR=$(node --version | grep -oE '[0-9]+' | head -1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    pass "Node.js $(node --version) (>= 20 required)"
  else
    fail "Node.js too old ($(node --version))" "Need Node.js >= 20. Use nvm: nvm install 20"
  fi
else
  fail "Node.js not found" "Install from https://nodejs.org/ or use nvm"
fi

if command -v npm &> /dev/null; then
  pass "npm $(npm --version)"
else
  fail "npm not found" "Should come with Node.js -- reinstall Node"
fi

# -------------------------------------------------------------------
# 7. Utilities
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}7. Utilities${NC}"

if command -v jq &> /dev/null; then
  pass "jq installed ($(jq --version 2>/dev/null))"
else
  fail "jq not found" "Run: brew install jq (macOS) or apt-get install jq (Linux)"
fi

if command -v curl &> /dev/null; then
  pass "curl installed"
else
  fail "curl not found" "Install curl"
fi

# -------------------------------------------------------------------
# 8. Sample App
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}8. Sample App${NC}"

SAMPLE_APP_DIR="${SAMPLE_APP_PATH:-../../../prism-d1-sample-app}"

if [ -d "$SAMPLE_APP_DIR" ] && [ -f "$SAMPLE_APP_DIR/package.json" ]; then
  pass "Sample app found at $SAMPLE_APP_DIR"
  if [ -d "$SAMPLE_APP_DIR/node_modules" ]; then
    pass "Sample app dependencies installed"
  else
    warn "Sample app dependencies not installed. Run: cd $SAMPLE_APP_DIR && npm install"
  fi
else
  warn "Sample app not found at $SAMPLE_APP_DIR. Clone it: git clone https://github.com/aws-samples/prism-d1-sample-app.git"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "  ${GREEN}PASS: ${PASS}${NC}   ${RED}FAIL: ${FAIL}${NC}   ${YELLOW}WARN: ${WARN}${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}SETUP INCOMPLETE.${NC} Fix the failures above before proceeding."
  echo "Ask your instructor for help if you're stuck."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}${BOLD}SETUP OK WITH WARNINGS.${NC} Review the warnings above -- some modules may not work."
  exit 0
else
  echo -e "${GREEN}${BOLD}ALL CHECKS PASSED.${NC} You're ready for the workshop!"
  exit 0
fi
