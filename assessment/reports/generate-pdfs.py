#!/usr/bin/env python3
"""Generate PDF assessment reports from sample JSON data."""
import json
import os
import shlex
import shutil
import subprocess
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(SCRIPT_DIR, "sample-reports")
OUTPUT_DIR = os.path.join(SAMPLES_DIR, "pdf")


def _resolve_chrome() -> str | None:
    """Find a Chrome/Chromium binary on the system."""
    for name in ("google-chrome", "chromium-browser", "chromium"):
        path = shutil.which(name)
        if path:
            return path
    # Fallback for macOS app bundle
    macos_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if os.path.isfile(macos_chrome):
        return macos_chrome
    return None

def status_color(score, max_score):
    pct = (score / max_score * 100) if max_score > 0 else 0
    if pct >= 60:
        return "#22c55e", "green"
    elif pct >= 30:
        return "#f59e0b", "amber"
    else:
        return "#ef4444", "red"

def verdict_class(verdict):
    if verdict == "READY_FOR_PILOT":
        return "verdict-ready"
    elif verdict == "NEEDS_FOUNDATIONS":
        return "verdict-foundations"
    return "verdict-notqualified"

def verdict_label(verdict):
    return verdict.replace("_", " ").title()

def level_band(level):
    if level <= 1.5:
        return "Experimental — Ad hoc AI use, no shared standards"
    elif level <= 2.5:
        return "Structured — AI tooling adopted, early measurement"
    elif level <= 3.5:
        return "Integrated — Eval gates active, AI embedded in SDLC"
    elif level <= 4.5:
        return "Orchestrated — Multi-agent governance, AI FinOps"
    return "Autonomous — AI as engineering peer"

def generate_radar_svg(scanner_scores, size=380):
    """Generate an SVG radar chart for scanner categories."""
    categories = scanner_scores
    n = len(categories)
    cx, cy = size // 2, size // 2
    r = size // 2 - 60

    svg_parts = [
        f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">',
        f'<rect width="{size}" height="{size}" fill="none"/>',
    ]

    # Draw concentric rings
    for ring in [0.25, 0.5, 0.75, 1.0]:
        rr = r * ring
        svg_parts.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="none" stroke="#e2e8f0" stroke-width="1"/>')

    # Draw axes and labels
    for i, cat in enumerate(categories):
        angle = (2 * math.pi * i / n) - math.pi / 2
        x_end = cx + r * math.cos(angle)
        y_end = cy + r * math.sin(angle)
        svg_parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x_end:.1f}" y2="{y_end:.1f}" stroke="#e2e8f0" stroke-width="1"/>')

        # Label
        label_r = r + 28
        lx = cx + label_r * math.cos(angle)
        ly = cy + label_r * math.sin(angle)
        anchor = "middle"
        if lx < cx - 10:
            anchor = "end"
        elif lx > cx + 10:
            anchor = "start"
        name = cat["name"]
        if len(name) > 14:
            name = name[:12] + ".."
        svg_parts.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" font-size="10" fill="#64748b" font-family="sans-serif">{name}</text>')

    # Draw data polygon
    points = []
    for i, cat in enumerate(categories):
        angle = (2 * math.pi * i / n) - math.pi / 2
        pct = cat["score"] / cat["maxScore"] if cat["maxScore"] > 0 else 0
        pr = r * pct
        px = cx + pr * math.cos(angle)
        py = cy + pr * math.sin(angle)
        points.append(f"{px:.1f},{py:.1f}")

    poly = " ".join(points)
    svg_parts.append(f'<polygon points="{poly}" fill="rgba(124,58,237,0.2)" stroke="#7c3aed" stroke-width="2"/>')

    # Draw data points
    for i, cat in enumerate(categories):
        angle = (2 * math.pi * i / n) - math.pi / 2
        pct = cat["score"] / cat["maxScore"] if cat["maxScore"] > 0 else 0
        pr = r * pct
        px = cx + pr * math.cos(angle)
        py = cy + pr * math.sin(angle)
        color, _ = status_color(cat["score"], cat["maxScore"])
        svg_parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="{color}" stroke="#fff" stroke-width="2"/>')

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)

def generate_html(data):
    """Generate a full self-contained HTML report from JSON data."""
    c = data["customer"]
    a = data["assessment"]
    o = a.get("onboardingPlan", data.get("onboardingPlan", {}))

    scanner = a["scannerScores"]
    interview = a["interviewScores"]
    org = a["orgReadiness"]

    radar_svg = generate_radar_svg(scanner)

    # Scanner category rows
    scanner_rows = ""
    for cat in scanner:
        color, cls = status_color(cat["score"], cat["maxScore"])
        pct = int(cat["score"] / cat["maxScore"] * 100) if cat["maxScore"] > 0 else 0
        scanner_rows += f"""
        <tr>
          <td>{cat["name"]}</td>
          <td style="font-weight:600">{cat["score"]} / {cat["maxScore"]}</td>
          <td>
            <div class="progress-bg"><div class="progress-fill fill-{cls}" style="width:{pct}%"></div></div>
          </td>
          <td><span class="status-dot status-{cls}"></span>{pct}%</td>
        </tr>"""

    # Interview section rows
    interview_rows = ""
    for sec in interview:
        color, cls = status_color(sec["score"], sec["maxScore"])
        pct = int(sec["score"] / sec["maxScore"] * 100) if sec["maxScore"] > 0 else 0
        findings_html = "<ul style='margin:4px 0 0 16px;color:#64748b;font-size:12px'>"
        for f in sec.get("keyFindings", []):
            findings_html += f"<li>{f}</li>"
        findings_html += "</ul>"
        interview_rows += f"""
        <tr>
          <td><strong>{sec["name"]}</strong>{findings_html}</td>
          <td style="font-weight:600">{sec["score"]} / {sec["maxScore"]}</td>
          <td><span class="status-dot status-{cls}"></span>{pct}%</td>
        </tr>"""

    # Gap rows
    gap_rows = ""
    for gap in o.get("gapRemediation", []):
        gap_rows += f"""
        <tr>
          <td style="font-weight:600">{gap["gap"]}</td>
          <td>{gap["category"]}</td>
          <td>{gap["score"]}</td>
          <td>{gap["action"]}</td>
        </tr>"""

    # Workshop module rows
    module_rows = ""
    for m in o.get("workshopModules", []):
        icon = "&#10003;" if m["included"] else "&#10007;"
        color = "#22c55e" if m["included"] else "#94a3b8"
        module_rows += f"""
        <tr>
          <td style="color:{color};font-weight:700;font-size:16px;text-align:center">{icon}</td>
          <td>{m["id"]}</td>
          <td>{m["name"]}</td>
          <td style="color:#64748b;font-size:13px">{m["reason"]}</td>
        </tr>"""

    # Milestone rows
    milestone_rows = ""
    for m in o.get("milestones", []):
        milestone_rows += f"""
        <tr>
          <td style="font-weight:600">Week {m["week"]}</td>
          <td>{m["milestone"]}</td>
          <td style="color:#64748b;font-size:13px">{m["measurable"]}</td>
        </tr>"""

    # Success metric rows
    success_rows = ""
    for s in o.get("successMetrics", []):
        success_rows += f"""
        <tr>
          <td>{s["metric"]}</td>
          <td style="font-weight:600">{s["target"]}</td>
          <td>{s["measureBy"]}</td>
        </tr>"""

    # SA touchpoint rows
    touchpoint_rows = ""
    for t in o.get("saTouchpoints", []):
        touchpoint_rows += f"""
        <tr>
          <td style="font-weight:600">Week {t["week"]}</td>
          <td>{t["type"]}</td>
          <td>{t["duration"]}</td>
          <td style="color:#64748b;font-size:13px">{t["agenda"]}</td>
        </tr>"""

    # Org readiness items
    org_items = ""
    for key, label in [
        ("executiveSponsor", "Executive Sponsor Identified"),
        ("dedicatedChampion", "Dedicated AI Champion"),
        ("teamWillingness", "Team Willingness"),
        ("budgetApproved", "Budget Approved"),
        ("timelineCommitment", "Timeline Commitment"),
    ]:
        val = org.get(key, False)
        icon = "&#10003;" if val else "&#10007;"
        color = "#22c55e" if val else "#ef4444"
        org_items += f'<div style="display:inline-block;margin:4px 16px 4px 0;font-size:14px"><span style="color:{color};font-weight:700;margin-right:4px">{icon}</span>{label}</div>'

    vc = verdict_class(a["verdict"])
    vl = verdict_label(a["verdict"])
    lb = level_band(a["prismLevel"])

    # Executive summary narrative
    narrative = f"""{c["name"]} is a {c["fundingStage"]} startup with {c["teamSize"]} engineers, currently assessed at
    <strong>PRISM D1 Level {a["prismLevel"]}</strong> ({lb.split('—')[0].strip()}).
    The automated scanner scored {a["scannerTotal"]}/100 and the SA interview scored {a["interviewTotal"]}/100,
    with an org readiness score of {org["totalScore"]}/20, producing a blended score of {a["blendedScore"]}.
    The assessment verdict is <strong>{vl}</strong>, routing {c["name"]} to
    <strong>Track {o.get("track", "N/A")}: {o.get("trackName", "N/A")}</strong>."""

    # Top strengths (highest % categories)
    sorted_cats = sorted(scanner, key=lambda x: x["score"]/x["maxScore"] if x["maxScore"] > 0 else 0, reverse=True)
    strengths_html = ""
    for cat in sorted_cats[:3]:
        pct = int(cat["score"] / cat["maxScore"] * 100) if cat["maxScore"] > 0 else 0
        strengths_html += f'<li><strong>{cat["name"]}</strong>: {cat["score"]}/{cat["maxScore"]} ({pct}%)</li>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRISM D1 Assessment — {c["name"]}</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b; background: #f8fafc; line-height: 1.6; -webkit-font-smoothing: antialiased;
  }}
  .page {{ max-width: 900px; margin: 0 auto; padding: 40px 24px; }}
  .header {{
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: #fff; padding: 48px 40px; border-radius: 12px; margin-bottom: 32px;
  }}
  .header h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 4px; }}
  .header .subtitle {{ font-size: 15px; color: #94a3b8; margin-bottom: 24px; }}
  .header-grid {{
    display: grid; grid-template-columns: 140px 1fr 140px 1fr;
    gap: 10px 16px; font-size: 14px;
  }}
  .header-grid .label {{ color: #94a3b8; }}
  .header-grid .value {{ color: #e2e8f0; font-weight: 500; }}
  .card {{
    background: #fff; border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    padding: 32px; margin-bottom: 24px;
  }}
  .card h2 {{
    font-size: 20px; font-weight: 700; color: #1a1a2e;
    margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;
  }}
  .card h3 {{ font-size: 16px; font-weight: 600; color: #334155; margin-top: 20px; margin-bottom: 12px; }}
  .level-display {{ display: flex; align-items: center; gap: 24px; margin-bottom: 20px; }}
  .level-badge {{
    display: flex; align-items: center; justify-content: center;
    width: 88px; height: 88px; border-radius: 50%;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    color: #fff; font-size: 28px; font-weight: 800; flex-shrink: 0;
  }}
  .level-label {{ font-size: 22px; font-weight: 700; color: #1a1a2e; }}
  .level-band {{ font-size: 14px; color: #64748b; margin-bottom: 6px; }}
  .verdict-badge {{
    display: inline-block; padding: 4px 14px; border-radius: 20px;
    font-size: 13px; font-weight: 600; color: #fff;
  }}
  .verdict-ready {{ background: #22c55e; }}
  .verdict-foundations {{ background: #f59e0b; }}
  .verdict-notqualified {{ background: #ef4444; }}
  .scores-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; }}
  .score-card {{
    background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;
  }}
  .score-card .score-value {{ font-size: 32px; font-weight: 800; color: #0066ff; }}
  .score-card .score-max {{ font-size: 14px; color: #94a3b8; }}
  .score-card .score-label {{ font-size: 12px; color: #64748b; margin-top: 4px; }}
  .narrative {{ font-size: 15px; color: #334155; line-height: 1.7; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  th {{
    background: #f1f5f9; color: #475569; font-weight: 600; text-align: left;
    padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  }}
  td {{ padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }}
  tr:last-child td {{ border-bottom: none; }}
  .radar-container {{ text-align: center; margin: 20px 0; }}
  .track-badge {{
    display: inline-block; padding: 6px 18px; border-radius: 6px;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    color: #fff; font-size: 18px; font-weight: 700;
  }}
  .status-dot {{
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
  }}
  .status-green {{ background: #22c55e; }}
  .status-amber {{ background: #f59e0b; }}
  .status-red {{ background: #ef4444; }}
  .progress-bg {{ background: #e2e8f0; border-radius: 4px; height: 8px; width: 100%; }}
  .progress-fill {{ border-radius: 4px; height: 8px; }}
  .fill-green {{ background: #22c55e; }}
  .fill-amber {{ background: #f59e0b; }}
  .fill-red {{ background: #ef4444; }}
  .footer {{ text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }}
  @media print {{
    body {{ background: #fff; font-size: 12px; }}
    .page {{ padding: 0; max-width: 100%; }}
    .header {{
      border-radius: 0; margin-bottom: 16px; padding: 20px 24px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }}
    .card {{
      box-shadow: none; border: 1px solid #e2e8f0;
      page-break-inside: avoid; margin-bottom: 12px; padding: 16px;
    }}
    .status-dot, .progress-bg, .progress-fill, .level-badge, .verdict-badge, .track-badge, .score-card {{
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }}
  }}
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1>PRISM D1 Velocity Assessment</h1>
    <div class="subtitle">AI-Assisted Development Lifecycle Maturity Report</div>
    <div class="header-grid">
      <div class="label">Customer</div>
      <div class="value">{c["name"]}</div>
      <div class="label">Team Size</div>
      <div class="value">{c["teamSize"]} engineers</div>
      <div class="label">Funding Stage</div>
      <div class="value">{c["fundingStage"]}</div>
      <div class="label">Assessment Date</div>
      <div class="value">{a["assessmentDate"]}</div>
      <div class="label">Solutions Architect</div>
      <div class="value">{a["saName"]}</div>
      <div class="label">Repository</div>
      <div class="value" style="font-family:monospace;font-size:13px">{a["repoAnalyzed"]}</div>
    </div>
  </div>

  <div class="card">
    <h2>Executive Summary</h2>
    <div class="level-display">
      <div class="level-badge">L{a["prismLevel"]}</div>
      <div>
        <div class="level-label">PRISM D1 Level {a["prismLevel"]}</div>
        <div class="level-band">{lb}</div>
        <span class="verdict-badge {vc}">{vl}</span>
      </div>
    </div>
    <p class="narrative">{narrative}</p>
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-value">{a["scannerTotal"]}</div>
        <div class="score-max">/ 100</div>
        <div class="score-label">Scanner Score (40%)</div>
      </div>
      <div class="score-card">
        <div class="score-value">{a["interviewTotal"]}</div>
        <div class="score-max">/ 100</div>
        <div class="score-label">Interview Score (40%)</div>
      </div>
      <div class="score-card">
        <div class="score-value">{org["totalScore"]}</div>
        <div class="score-max">/ 20</div>
        <div class="score-label">Org Readiness (20%)</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Scanner Category Breakdown</h2>
    <div class="radar-container">
      {radar_svg}
    </div>
    <table>
      <thead>
        <tr><th>Category</th><th>Score</th><th>Progress</th><th>Status</th></tr>
      </thead>
      <tbody>
        {scanner_rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Interview Assessment</h2>
    <table>
      <thead>
        <tr><th>Section</th><th>Score</th><th>Status</th></tr>
      </thead>
      <tbody>
        {interview_rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Organizational Readiness</h2>
    <div style="margin:12px 0">{org_items}</div>
    <p style="color:#64748b;font-size:14px;margin-top:8px">Org readiness score: <strong>{org["totalScore"]}/20</strong></p>
  </div>

  <div class="card">
    <h2>Top Strengths</h2>
    <ol style="margin-left:20px;color:#334155">{strengths_html}</ol>
  </div>

  <div class="card">
    <h2>Gap Analysis &amp; Remediation</h2>
    <table>
      <thead>
        <tr><th>Priority</th><th>Category</th><th>Score</th><th>Recommended Action</th></tr>
      </thead>
      <tbody>
        {gap_rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Onboarding Recommendation</h2>
    <div style="margin-bottom:20px">
      <span class="track-badge">Track {o.get("track", "N/A")}: {o.get("trackName", "N/A")}</span>
    </div>

    <h3>Workshop Modules</h3>
    <table>
      <thead>
        <tr><th style="width:40px"></th><th>ID</th><th>Module</th><th>Rationale</th></tr>
      </thead>
      <tbody>
        {module_rows}
      </tbody>
    </table>

    <h3>Success Metrics</h3>
    <table>
      <thead>
        <tr><th>Metric</th><th>Target</th><th>Measure By</th></tr>
      </thead>
      <tbody>
        {success_rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>90-Day Roadmap</h2>
    <table>
      <thead>
        <tr><th>Timeline</th><th>Milestone</th><th>Measurable Outcome</th></tr>
      </thead>
      <tbody>
        {milestone_rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>SA Engagement Cadence</h2>
    <table>
      <thead>
        <tr><th>Week</th><th>Type</th><th>Duration</th><th>Agenda</th></tr>
      </thead>
      <tbody>
        {touchpoint_rows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>PRISM D1 Velocity Assessment Report &mdash; Generated {a["assessmentDate"]}</p>
    <p>AWS Solutions Architecture &middot; Startups Organization &middot; CONFIDENTIAL</p>
    <p style="margin-top:8px">Solutions Architect: {a["saName"]}</p>
  </div>

</div>
</body>
</html>"""
    return html


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    samples = [
        ("sample-l1.5-startup.json", "novapay-l1.5-assessment"),
        ("sample-l2.5-startup.json", "arcline-health-l2.5-assessment"),
        ("sample-l3.5-startup.json", "vectrix-ai-l3.5-assessment"),
    ]

    chrome = _resolve_chrome()
    if not chrome:
        print("Error: Chrome/Chromium not found on PATH. Skipping PDF generation.")

    for json_file, base_name in samples:
        json_path = os.path.join(SAMPLES_DIR, json_file)
        html_path = os.path.join(OUTPUT_DIR, f"{base_name}.html")
        pdf_path = os.path.join(OUTPUT_DIR, f"{base_name}.pdf")

        print(f"Processing {json_file}...")

        with open(json_path) as f:
            data = json.load(f)

        html = generate_html(data)

        with open(html_path, "w") as f:
            f.write(html)
        print(f"  HTML: {html_path}")

        # Convert to PDF using Chrome headless
        if not chrome:
            print("  PDF:  skipped (no Chrome found)")
            continue

        # Convert to PDF using Chrome headless.
        # Arguments are passed as a list (no shell). shlex.quote is used
        # in the log line to prevent log-injection from file paths.
        chrome_args = [
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            f"--print-to-pdf={pdf_path}",
            "--print-to-pdf-no-header",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=5000",
            f"file://{html_path}",
        ]

        cmd = [chrome, *chrome_args]
        print(f"  $ {' '.join(shlex.quote(a) for a in cmd)}")
        # nosemgrep: python.lang.security.audit.dangerous-subprocess-use-audit
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if os.path.exists(pdf_path):
            size_kb = os.path.getsize(pdf_path) / 1024
            print(f"  PDF:  {pdf_path} ({size_kb:.0f} KB)")
        else:
            print(f"  PDF generation failed: {result.stderr[:200]}")

    print("\nDone!")


if __name__ == "__main__":
    main()
