#!/usr/bin/env bash
# PRISM CLI - Entry point
# Usage: ./prism <command> [subcommand] [options]
# Examples:
#   ./prism assessment run
#   ./prism workshop verify-setup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check Node.js is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed or not in PATH."
  echo "Install Node.js >= 20 from https://nodejs.org/ or use nvm."
  exit 1
fi

# Check minimum Node version
NODE_MAJOR=$(node --version | grep -oE '[0-9]+' | head -1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Error: Node.js >= 20 required (found $(node --version))."
  echo "Upgrade with: nvm install 20"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/prism-cli/node_modules" ]; then
  echo "Installing prism-cli dependencies..."
  (cd "$SCRIPT_DIR/prism-cli" && npm install --silent)
fi

exec npx --prefix "$SCRIPT_DIR/prism-cli" tsx "$SCRIPT_DIR/prism-cli/bin/prism-cli.ts" "$@"
