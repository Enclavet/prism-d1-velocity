#!/usr/bin/env bash
# install.sh — Install PRISM D1 Velocity git hooks and configure the local environment.
#
# Usage:
#   ./install.sh                    # Interactive — prompts for team_id
#   ./install.sh --team-id my-team  # Non-interactive
#   ./install.sh --uninstall        # Remove hooks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR=""
PRISM_DIR=""
TEAM_ID=""
REPO_NAME=""
UNINSTALL=false

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --team-id)
            TEAM_ID="$2"
            shift 2
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--team-id <id>] [--uninstall]"
            echo ""
            echo "Options:"
            echo "  --team-id <id>   Set the team ID (skips interactive prompt)"
            echo "  --uninstall      Remove PRISM hooks"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Locate git repository
# ---------------------------------------------------------------------------
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a git repository."
    exit 1
}

HOOKS_DIR="${GIT_ROOT}/.git/hooks"
PRISM_DIR="${GIT_ROOT}/.prism"

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
if [[ "${UNINSTALL}" == true ]]; then
    echo "Removing PRISM hooks..."
    for HOOK in prepare-commit-msg post-commit post-merge; do
        if [[ -f "${HOOKS_DIR}/${HOOK}" ]]; then
            # Only remove if it is our hook (check for PRISM marker)
            if grep -q 'prism.d1' "${HOOKS_DIR}/${HOOK}" 2>/dev/null; then
                rm "${HOOKS_DIR}/${HOOK}"
                echo "  Removed ${HOOK}"
            else
                echo "  Skipped ${HOOK} (not a PRISM hook)"
            fi
        fi
    done
    echo "Done. The .prism/ directory was left intact."
    exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
echo "=== PRISM D1 Velocity — Hook Installer ==="
echo ""

# Check for jq
if ! command -v jq &>/dev/null; then
    echo "Warning: 'jq' is not installed. Hooks require jq for JSON processing."
    echo "  macOS:  brew install jq"
    echo "  Linux:  sudo apt install jq  (or yum install jq)"
    echo ""
fi

# Check for AWS CLI
AWS_OK=false
if command -v aws &>/dev/null; then
    AWS_OK=true
    echo "AWS CLI:  $(aws --version 2>&1 | head -1)"
    # Quick credential check
    if aws sts get-caller-identity &>/dev/null; then
        echo "AWS Auth: OK"
    else
        echo "AWS Auth: Not configured (EventBridge emission will fail until configured)"
    fi
else
    echo "AWS CLI:  Not found (EventBridge emission will be disabled)"
    echo "  Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
fi
echo ""

# ---------------------------------------------------------------------------
# Prompt for team_id
# ---------------------------------------------------------------------------
REPO_NAME=$(basename "${GIT_ROOT}")

if [[ -z "${TEAM_ID}" ]]; then
    # Check if config already exists
    if [[ -f "${PRISM_DIR}/config.json" ]]; then
        EXISTING_TEAM=$(jq -r '.team_id // ""' "${PRISM_DIR}/config.json" 2>/dev/null || echo "")
        if [[ -n "${EXISTING_TEAM}" && "${EXISTING_TEAM}" != "YOUR_TEAM_ID" ]]; then
            echo "Existing PRISM config found (team: ${EXISTING_TEAM})."
            read -rp "Keep existing team ID? [Y/n] " KEEP
            if [[ "${KEEP}" != "n" && "${KEEP}" != "N" ]]; then
                TEAM_ID="${EXISTING_TEAM}"
            fi
        fi
    fi

    if [[ -z "${TEAM_ID}" ]]; then
        read -rp "Enter your team ID (e.g., team-payments): " TEAM_ID
        if [[ -z "${TEAM_ID}" ]]; then
            echo "Error: team ID is required."
            exit 1
        fi
    fi
fi

# ---------------------------------------------------------------------------
# Create .prism/ directory structure
# ---------------------------------------------------------------------------
echo "Creating .prism/ directory structure..."
mkdir -p "${PRISM_DIR}/metrics"
mkdir -p "${PRISM_DIR}/eval-results"

# Write config
CONFIG_FILE="${PRISM_DIR}/config.json"
if [[ -f "${CONFIG_FILE}" ]]; then
    # Update team_id and repo in existing config
    TMP_CONFIG=$(mktemp)
    jq --arg team_id "${TEAM_ID}" --arg repo "${REPO_NAME}" \
        '.team_id = $team_id | .repo = $repo' "${CONFIG_FILE}" > "${TMP_CONFIG}" 2>/dev/null \
        && mv "${TMP_CONFIG}" "${CONFIG_FILE}" \
        || rm -f "${TMP_CONFIG}"
else
    jq -n \
        --arg team_id "${TEAM_ID}" \
        --arg repo "${REPO_NAME}" \
        '{
            "team_id": $team_id,
            "repo": $repo,
            "event_bus": "prism-d1-metrics",
            "aws_region": "us-west-2",
            "emit_to_eventbridge": true,
            "store_local": true,
            "prism_level": 2
        }' > "${CONFIG_FILE}" 2>/dev/null || {
        # Fallback if jq is not available
        cat > "${CONFIG_FILE}" <<CONF
{
  "team_id": "${TEAM_ID}",
  "repo": "${REPO_NAME}",
  "event_bus": "prism-d1-metrics",
  "aws_region": "us-west-2",
  "emit_to_eventbridge": true,
  "store_local": true,
  "prism_level": 2
}
CONF
    }
fi

echo "  Config: ${CONFIG_FILE}"

# Add .prism/metrics/ to .gitignore if not already there
GITIGNORE="${GIT_ROOT}/.gitignore"
if [[ -f "${GITIGNORE}" ]]; then
    if ! grep -q '.prism/metrics/' "${GITIGNORE}" 2>/dev/null; then
        echo "" >> "${GITIGNORE}"
        echo "# PRISM local metrics (do not commit)" >> "${GITIGNORE}"
        echo ".prism/metrics/" >> "${GITIGNORE}"
        echo ".prism/eval-results/" >> "${GITIGNORE}"
    fi
else
    cat > "${GITIGNORE}" <<'IGNORE'
# PRISM local metrics (do not commit)
.prism/metrics/
.prism/eval-results/
IGNORE
fi

# ---------------------------------------------------------------------------
# Install hooks
# ---------------------------------------------------------------------------
echo ""
echo "Installing git hooks..."

for HOOK in prepare-commit-msg post-commit post-merge; do
    SOURCE="${SCRIPT_DIR}/${HOOK}"
    TARGET="${HOOKS_DIR}/${HOOK}"

    if [[ ! -f "${SOURCE}" ]]; then
        echo "  Warning: ${HOOK} not found in ${SCRIPT_DIR}, skipping."
        continue
    fi

    # Back up existing hook if it is not ours
    if [[ -f "${TARGET}" ]]; then
        if ! grep -q 'prism.d1' "${TARGET}" 2>/dev/null; then
            BACKUP="${TARGET}.pre-prism"
            cp "${TARGET}" "${BACKUP}"
            echo "  Backed up existing ${HOOK} to ${HOOK}.pre-prism"
        fi
    fi

    cp "${SOURCE}" "${TARGET}"
    chmod +x "${TARGET}"
    echo "  Installed ${HOOK}"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Installation Complete ==="
echo ""
echo "Team ID:   ${TEAM_ID}"
echo "Repo:      ${REPO_NAME}"
echo "Config:    ${CONFIG_FILE}"
echo "Hooks dir: ${HOOKS_DIR}"
echo ""
echo "What happens now:"
echo "  - Every commit gets AI-Origin trailers automatically"
echo "  - Commit metrics are stored in .prism/metrics/"
if [[ "${AWS_OK}" == true ]]; then
    echo "  - Events are emitted to EventBridge (prism-d1-metrics bus)"
else
    echo "  - EventBridge emission is disabled until AWS CLI is installed"
fi
echo ""
echo "Next steps:"
echo "  1. Choose a CLAUDE.md template from bootstrapper/claude-code/"
echo "  2. Add GitHub workflows from bootstrapper/github-workflows/"
echo "  3. Configure eval harness from bootstrapper/eval-harness/"
