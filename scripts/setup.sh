#!/usr/bin/env bash
# ============================================================================
# PRISM D1 Velocity — Environment Setup Script
#
# Installs and verifies all dependencies for the AI-DLC workshop.
# Supports macOS (Homebrew) and Linux (apt/yum).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sunilpp/prism-d1-velocity/main/scripts/setup.sh | bash
#   # or
#   ./scripts/setup.sh
#   ./scripts/setup.sh --skip-aws      # Skip AWS credential check
#   ./scripts/setup.sh --skip-kiro     # Skip Kiro installation
#   ./scripts/setup.sh --verify-only   # Only verify, don't install
# ============================================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# --- Flags ---
SKIP_AWS=false
SKIP_KIRO=false
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-aws)    SKIP_AWS=true ;;
    --skip-kiro)   SKIP_KIRO=true ;;
    --verify-only) VERIFY_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-aws] [--skip-kiro] [--verify-only]"
      exit 0
      ;;
  esac
done

# --- Helpers ---
PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; WARN=$((WARN + 1)); }
info() { echo -e "  ${BLUE}→${NC} $1"; }
header() { echo -e "\n${BOLD}$1${NC}"; }

command_exists() { command -v "$1" &>/dev/null; }

detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    *)       echo "unknown" ;;
  esac
}

detect_pkg_manager() {
  if command_exists brew; then echo "brew"
  elif command_exists apt-get; then echo "apt"
  elif command_exists yum; then echo "yum"
  elif command_exists dnf; then echo "dnf"
  else echo "none"
  fi
}

install_pkg() {
  local name="$1"
  local pkg_name="${2:-$name}"

  if [[ "$VERIFY_ONLY" == true ]]; then
    fail "$name not found (run without --verify-only to install)"
    return
  fi

  info "Installing $name..."
  case "$(detect_pkg_manager)" in
    brew) brew install "$pkg_name" ;;
    apt)  sudo apt-get install -y -qq "$pkg_name" ;;
    yum)  sudo yum install -y -q "$pkg_name" ;;
    dnf)  sudo dnf install -y -q "$pkg_name" ;;
    *)    fail "No supported package manager found. Install $name manually."; return ;;
  esac
}

OS=$(detect_os)
PKG=$(detect_pkg_manager)

echo -e "${BOLD}"
echo "╔════════════════════════════════════════════════╗"
echo "║   PRISM D1 Velocity — Environment Setup       ║"
echo "║   AI-DLC Workshop Prerequisites               ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "OS: $(uname -s) $(uname -m) | Package manager: $PKG"
echo "Flags: skip-aws=$SKIP_AWS skip-kiro=$SKIP_KIRO verify-only=$VERIFY_ONLY"

# ============================================================================
# 1. Git
# ============================================================================
header "1. Git"

if command_exists git; then
  GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
  GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
  if [[ "$GIT_MAJOR" -gt 2 ]] || [[ "$GIT_MAJOR" -eq 2 && "$GIT_MINOR" -ge 40 ]]; then
    pass "Git $(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
  else
    warn "Git $(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') — recommend 2.40+ for trailer support"
  fi
else
  install_pkg git
  command_exists git && pass "Git installed" || fail "Git installation failed"
fi

# ============================================================================
# 2. Node.js & npm
# ============================================================================
header "2. Node.js & npm"

if command_exists node; then
  NODE_VERSION=$(node --version | grep -oE '[0-9]+' | head -1)
  if [[ "$NODE_VERSION" -ge 20 ]]; then
    pass "Node.js $(node --version)"
  else
    warn "Node.js $(node --version) — need v20+. Install via nvm or brew."
  fi
else
  if [[ "$VERIFY_ONLY" == true ]]; then
    fail "Node.js not found"
  else
    info "Installing Node.js 20..."
    if [[ "$PKG" == "brew" ]]; then
      brew install node@20
    elif command_exists nvm; then
      nvm install 20 && nvm use 20
    else
      # Use NodeSource for Linux
      if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
      else
        fail "Cannot install Node.js automatically. Install v20+ manually."
      fi
    fi
    command_exists node && pass "Node.js $(node --version)" || fail "Node.js installation failed"
  fi
fi

if command_exists npm; then
  pass "npm $(npm --version)"
else
  fail "npm not found"
fi

# ============================================================================
# 3. Python 3.11+
# ============================================================================
header "3. Python 3.11+ (for Strands Agent)"

PYTHON_CMD=""
for cmd in python3 python; do
  if command_exists "$cmd"; then
    PY_VER=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [[ "$PY_MAJOR" -eq 3 && "$PY_MINOR" -ge 11 ]]; then
      PYTHON_CMD="$cmd"
      break
    fi
  fi
done

if [[ -n "$PYTHON_CMD" ]]; then
  pass "Python $($PYTHON_CMD --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
else
  if command_exists python3; then
    warn "Python $(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') — need 3.11+ for Strands SDK"
  else
    install_pkg python3
    command_exists python3 && pass "Python $(python3 --version)" || fail "Python not found"
  fi
fi

if command_exists pip3 || command_exists pip; then
  pass "pip available"
else
  warn "pip not found — install with: python3 -m ensurepip"
fi

# ============================================================================
# 4. AWS CLI
# ============================================================================
header "4. AWS CLI"

if command_exists aws; then
  pass "AWS CLI $(aws --version 2>&1 | grep -oE 'aws-cli/[0-9.]+' | head -1)"

  if [[ "$SKIP_AWS" == false ]]; then
    if aws sts get-caller-identity &>/dev/null; then
      ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null)
      pass "AWS credentials valid (account: $ACCOUNT)"
    else
      warn "AWS credentials not configured — run: aws configure"
    fi
  else
    info "Skipping AWS credential check (--skip-aws)"
  fi
else
  if [[ "$VERIFY_ONLY" == true ]]; then
    fail "AWS CLI not found"
  else
    info "Installing AWS CLI..."
    if [[ "$OS" == "macos" ]]; then
      brew install awscli
    else
      curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
      unzip -q /tmp/awscliv2.zip -d /tmp/aws-install
      sudo /tmp/aws-install/aws/install
      rm -rf /tmp/awscliv2.zip /tmp/aws-install
    fi
    command_exists aws && pass "AWS CLI installed" || fail "AWS CLI installation failed"
  fi
fi

# ============================================================================
# 5. AWS CDK
# ============================================================================
header "5. AWS CDK v2"

if command_exists cdk; then
  pass "CDK $(cdk --version 2>&1 | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')"
else
  if [[ "$VERIFY_ONLY" == true ]]; then
    fail "AWS CDK not found"
  else
    info "Installing AWS CDK..."
    npm install -g aws-cdk
    command_exists cdk && pass "CDK $(cdk --version 2>&1 | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')" || fail "CDK installation failed"
  fi
fi

# ============================================================================
# 6. Claude Code CLI
# ============================================================================
header "6. Claude Code CLI"

if command_exists claude; then
  pass "Claude Code $(claude --version 2>/dev/null || echo 'installed')"
else
  if [[ "$VERIFY_ONLY" == true ]]; then
    fail "Claude Code CLI not found"
  else
    info "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
    command_exists claude && pass "Claude Code installed" || fail "Claude Code installation failed"
  fi
fi

# Set Bedrock env vars if not already set
if [[ -z "${CLAUDE_CODE_USE_BEDROCK:-}" ]]; then
  warn "CLAUDE_CODE_USE_BEDROCK not set — add to your shell profile:"
  info "  export CLAUDE_CODE_USE_BEDROCK=1"
  info "  export AWS_REGION=us-west-2"
else
  pass "CLAUDE_CODE_USE_BEDROCK=$CLAUDE_CODE_USE_BEDROCK"
fi

# ============================================================================
# 7. Kiro IDE
# ============================================================================
header "7. Kiro IDE"

if [[ "$SKIP_KIRO" == true ]]; then
  info "Skipping Kiro check (--skip-kiro)"
elif command_exists kiro; then
  pass "Kiro $(kiro --version 2>/dev/null || echo 'installed')"
else
  warn "Kiro not found — install from https://kiro.dev"
  info "Kiro requires an AWS Builder ID (free): https://profile.aws.amazon.com/"
fi

# ============================================================================
# 8. Supporting tools
# ============================================================================
header "8. Supporting Tools"

# jq
if command_exists jq; then
  pass "jq $(jq --version 2>/dev/null)"
else
  install_pkg jq
  command_exists jq && pass "jq installed" || fail "jq not found"
fi

# GitHub CLI
if command_exists gh; then
  pass "GitHub CLI $(gh --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
  if gh auth status &>/dev/null; then
    pass "GitHub CLI authenticated"
  else
    warn "GitHub CLI not authenticated — run: gh auth login"
  fi
else
  install_pkg gh
  command_exists gh && pass "GitHub CLI installed" || warn "GitHub CLI not found — install from https://cli.github.com"
fi

# bc (used in metric workflows)
if command_exists bc; then
  pass "bc available"
else
  install_pkg bc
fi

# ============================================================================
# 9. Bedrock Model Access (optional)
# ============================================================================
header "9. Bedrock Model Access"

if [[ "$SKIP_AWS" == true ]]; then
  info "Skipping Bedrock check (--skip-aws)"
elif command_exists aws && aws sts get-caller-identity &>/dev/null; then
  REGION="${AWS_REGION:-us-west-2}"
  MODELS=$(aws bedrock list-foundation-models --region "$REGION" \
    --query "modelSummaries[?contains(modelId, 'anthropic')].[modelId]" \
    --output text 2>/dev/null || echo "")

  if echo "$MODELS" | grep -q "claude-sonnet"; then
    pass "Claude Sonnet models available in $REGION"
  else
    warn "Claude Sonnet not found in $REGION — enable in Bedrock console"
  fi

  if echo "$MODELS" | grep -q "claude-haiku"; then
    pass "Claude Haiku models available in $REGION"
  else
    warn "Claude Haiku not found in $REGION — needed for eval gates"
  fi
else
  info "Skipping Bedrock check (no AWS credentials)"
fi

# ============================================================================
# 10. Sample App & Agent Setup
# ============================================================================
header "10. Project Dependencies"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd || echo "")"

if [[ -f "$REPO_ROOT/sample-app/package.json" ]]; then
  info "Installing sample-app npm dependencies..."
  (cd "$REPO_ROOT/sample-app" && npm install --silent 2>/dev/null) && pass "sample-app: npm install" || warn "sample-app: npm install failed"

  info "Installing infra npm dependencies..."
  (cd "$REPO_ROOT/infra" && npm install --silent 2>/dev/null) && pass "infra: npm install" || warn "infra: npm install failed"

  if [[ -f "$REPO_ROOT/sample-app/agent/pyproject.toml" ]]; then
    AGENT_DIR="$REPO_ROOT/sample-app/agent"
    VENV_DIR="$AGENT_DIR/.venv"
    PY="${PYTHON_CMD:-python3}"

    # Create a virtual environment if one doesn't exist
    if [[ ! -d "$VENV_DIR" ]]; then
      info "Creating Python virtual environment at agent/.venv ..."
      "$PY" -m venv "$VENV_DIR" 2>/dev/null || {
        warn "Failed to create venv — trying with --without-pip"
        "$PY" -m venv --without-pip "$VENV_DIR" 2>/dev/null || true
      }
    fi

    if [[ -f "$VENV_DIR/bin/pip" ]]; then
      info "Installing agent Python dependencies in .venv ..."
      ("$VENV_DIR/bin/pip" install -e "$AGENT_DIR[dev]" --quiet 2>&1 | tail -2) && pass "agent: pip install (in .venv)" || warn "agent: pip install failed"
      info "Activate with: source sample-app/agent/.venv/bin/activate"
    elif [[ -f "$VENV_DIR/bin/python" ]]; then
      info "Installing pip into venv..."
      "$VENV_DIR/bin/python" -m ensurepip --upgrade --default-pip 2>/dev/null || true
      if [[ -f "$VENV_DIR/bin/pip" ]]; then
        ("$VENV_DIR/bin/pip" install -e "$AGENT_DIR[dev]" --quiet 2>&1 | tail -2) && pass "agent: pip install (in .venv)" || warn "agent: pip install failed"
        info "Activate with: source sample-app/agent/.venv/bin/activate"
      else
        warn "Could not install pip in venv. Run manually:"
        info "  cd sample-app/agent && python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
      fi
    else
      warn "Could not create virtual environment. Run manually:"
      info "  cd sample-app/agent && python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
    fi
  fi
else
  info "Not inside the prism-d1-velocity repo — skipping project dependency install"
  info "Clone the repo first: git clone https://github.com/sunilpp/prism-d1-velocity.git"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Setup Summary${NC}"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}✓ Passed:${NC}  $PASS"
echo -e "  ${YELLOW}! Warnings:${NC} $WARN"
echo -e "  ${RED}✗ Failed:${NC}  $FAIL"
echo ""

if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  Ready for the workshop!${NC}"
  echo ""
  echo "  Next steps:"
  echo "    cd sample-app && npm run dev   # Start the task API"
  echo "    cd agent && python scripts/run-demo.py --mock  # Test the agent"
  echo ""
else
  echo -e "${RED}${BOLD}  $FAIL issue(s) need attention before the workshop.${NC}"
  echo "  Fix the failures above and re-run: ./scripts/setup.sh --verify-only"
  echo ""
fi
