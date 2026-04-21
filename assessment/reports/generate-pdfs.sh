#!/usr/bin/env bash
# Generate PDF assessment reports from sample JSON data.
#
# This script:
#   1. Calls generate-html.py to produce HTML reports (pure Python, no subprocess)
#   2. Converts HTML to PDF using Chrome/Chromium headless
#
# Usage:
#   bash generate-pdfs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLES_DIR="$SCRIPT_DIR/sample-reports"
OUTPUT_DIR="$SAMPLES_DIR/pdf"

mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# Find Chrome/Chromium
# ---------------------------------------------------------------------------
CHROME=""
for candidate in google-chrome chromium-browser chromium; do
  if command -v "$candidate" &> /dev/null; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  # macOS fallback
  MACOS_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [[ -x "$MACOS_CHROME" ]]; then
    CHROME="$MACOS_CHROME"
  fi
fi

# ---------------------------------------------------------------------------
# Step 1: Generate HTML reports via Python (no subprocess calls)
# ---------------------------------------------------------------------------
echo "Generating HTML reports..."
python3 "$SCRIPT_DIR/generate-html.py"

# ---------------------------------------------------------------------------
# Step 2: Convert HTML to PDF via Chrome headless
# ---------------------------------------------------------------------------
if [[ -z "$CHROME" ]]; then
  echo "Chrome/Chromium not found. HTML reports generated, PDF conversion skipped."
  exit 0
fi

for html_file in "$OUTPUT_DIR"/*.html; do
  [[ ! -f "$html_file" ]] && continue
  base_name="$(basename "$html_file" .html)"
  pdf_file="$OUTPUT_DIR/$base_name.pdf"

  echo "  Converting: $base_name"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    "--print-to-pdf=$pdf_file" \
    --print-to-pdf-no-header \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=5000 \
    "file://$html_file" 2>/dev/null || true

  if [[ -f "$pdf_file" ]]; then
    size_kb=$(( $(stat -f%z "$pdf_file" 2>/dev/null || stat -c%s "$pdf_file" 2>/dev/null) / 1024 ))
    echo "  PDF: $pdf_file (${size_kb} KB)"
  else
    echo "  PDF generation failed for $base_name"
  fi
done

echo ""
echo "Done!"
