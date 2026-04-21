import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Interview section definitions (mirrors scoring-sheet.md)
// ---------------------------------------------------------------------------
interface InterviewSection {
  id: string;
  name: string;
  maxScore: number;
  questions: { id: string; label: string; max: number }[];
}

const INTERVIEW_SECTIONS: InterviewSection[] = [
  {
    id: 'ai_tooling_landscape', name: 'AI Tooling Landscape', maxScore: 15,
    questions: [
      { id: 'q1_1', label: 'AI tool usage overview', max: 5 },
      { id: 'q1_2', label: 'Tool adoption process', max: 5 },
      { id: 'q1_3', label: 'Usage measurement', max: 5 },
    ],
  },
  {
    id: 'dev_workflow_specs', name: 'Development Workflow & Specs', maxScore: 20,
    questions: [
      { id: 'q2_1', label: 'Feature development flow', max: 5 },
      { id: 'q2_2', label: 'Spec quality and structure', max: 5 },
      { id: 'q2_3', label: 'AI in the design phase', max: 5 },
      { id: 'q2_4', label: 'AI attribution and traceability', max: 5 },
    ],
  },
  {
    id: 'cicd_quality', name: 'CI/CD & Quality', maxScore: 20,
    questions: [
      { id: 'q3_1', label: 'AI validation in CI/CD', max: 5 },
      { id: 'q3_2', label: 'AI bug tracking', max: 5 },
      { id: 'q3_3', label: 'AI code quality measurement', max: 5 },
      { id: 'q3_4', label: 'Deployment metrics and AI impact', max: 5 },
    ],
  },
  {
    id: 'metrics_visibility', name: 'Metrics & Visibility', maxScore: 15,
    questions: [
      { id: 'q4_1', label: 'Executive visibility', max: 5 },
      { id: 'q4_2', label: 'Engineering metrics with AI dimensions', max: 5 },
      { id: 'q4_3', label: 'AI ROI reporting', max: 5 },
    ],
  },
  {
    id: 'governance_security', name: 'Governance & Security', maxScore: 15,
    questions: [
      { id: 'q5_1', label: 'AI guardrails', max: 5 },
      { id: 'q5_2', label: 'AI access and permissions', max: 5 },
      { id: 'q5_3', label: 'AI incident response', max: 5 },
    ],
  },
  {
    id: 'org_culture', name: 'Organization & Culture', maxScore: 15,
    questions: [
      { id: 'q6_1', label: 'AI ownership and sponsorship', max: 5 },
      { id: 'q6_2', label: 'AI onboarding', max: 5 },
      { id: 'q6_3', label: 'Blockers and self-awareness', max: 5 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Scanner runner — shells out to the existing scanner CLI
// ---------------------------------------------------------------------------
interface ScanCategoryResult {
  category: string;
  maxPoints: number;
  earnedPoints: number;
  evidence: { signal: string; found: boolean; points: number; detail: string }[];
}

interface ScanResultJSON {
  repoPath: string;
  repoName: string;
  scanDate: string;
  totalScore: number;
  maxScore: number;
  prismLevel: { level: string; label: string; description: string };
  categories: ScanCategoryResult[];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

function runScanner(repoPath: string): ScanResultJSON {
  const scannerDir = resolve(PROJECT_ROOT, 'assessment', 'scanner');
  const indexTs = resolve(scannerDir, 'src', 'index.ts');
  if (!existsSync(indexTs)) {
    throw new Error(`Scanner not found at ${indexTs}`);
  }
  // Run scanner in JSON mode via tsx
  const out = execSync(
    `npx tsx ${JSON.stringify(indexTs)} --repo ${JSON.stringify(repoPath)} --output json`,
    { cwd: scannerDir, encoding: 'utf-8', timeout: 60_000 },
  );
  return JSON.parse(out);
}

// ---------------------------------------------------------------------------
// Scoring (inline — mirrors assessment/scoring/scoring-model.ts)
// ---------------------------------------------------------------------------
interface BlendedResult {
  scannerScore: number;
  interviewScore: number;
  orgReadinessScore: number;
  blendedScore: number;
  level: string;
  verdict: string;
}

function computeBlended(scannerTotal: number, scannerMax: number, interviewTotal: number, org: Record<string, boolean>): BlendedResult {
  const scannerScore = scannerMax > 0 ? (scannerTotal / scannerMax) * 100 : 0;
  const interviewScore = interviewTotal; // already 0-100
  let orgRaw = 0;
  if (org.executiveSponsor) orgRaw += 4;
  if (org.budgetAllocated) orgRaw += 4;
  if (org.dedicatedOwner) orgRaw += 4;
  if (org.awsRelationship) orgRaw += 4;
  if (org.appropriateTeamSize) orgRaw += 4;
  const orgScaled = (orgRaw / 20) * 100;
  const blended = Math.round((scannerScore * 0.4 + interviewScore * 0.4 + orgScaled * 0.2) * 100) / 100;

  const thresholds: [number, string][] = [
    [81, 'L5.0'], [71, 'L4.5'], [61, 'L4.0'], [51, 'L3.5'],
    [41, 'L3.0'], [31, 'L2.5'], [21, 'L2.0'], [11, 'L1.5'], [0, 'L1.0'],
  ];
  let level = 'L1.0';
  for (const [t, l] of thresholds) { if (blended >= t) { level = l; break; } }

  let verdict = 'NOT_QUALIFIED';
  if (blended >= 21 && orgRaw >= 12) verdict = 'READY_FOR_PILOT';
  else if (blended >= 11 && orgRaw >= 8) verdict = 'NEEDS_FOUNDATIONS';

  return { scannerScore: Math.round(scannerScore * 100) / 100, interviewScore, orgReadinessScore: orgRaw, blendedScore: blended, level, verdict };
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------
const PAGE_STYLE = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6}
  .page{max-width:900px;margin:0 auto;padding:40px 24px}
  h1{font-size:24px;font-weight:700;margin-bottom:8px}
  h2{font-size:18px;font-weight:600;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
  .card{background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:28px;margin-bottom:20px}
  label{display:block;font-weight:500;margin-bottom:4px;font-size:14px}
  input[type=text],input[type=number],select{width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-bottom:12px}
  input[type=number]{width:80px}
  button{background:linear-gradient(135deg,#0066ff,#7c3aed);color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px}
  button:hover{opacity:.9}
  button.secondary{background:#64748b}
  .badge{display:inline-block;padding:3px 12px;border-radius:16px;font-size:13px;font-weight:600;color:#fff}
  .badge-green{background:#22c55e}.badge-amber{background:#f59e0b}.badge-red{background:#ef4444}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
  th{background:#f1f5f9;color:#475569;font-weight:600;text-align:left;padding:8px 12px;font-size:12px;text-transform:uppercase}
  td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
  .progress-bg{background:#e2e8f0;border-radius:4px;height:8px;width:100%}
  .progress-fill{border-radius:4px;height:8px}
  .fill-green{background:#22c55e}.fill-amber{background:#f59e0b}.fill-red{background:#ef4444}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .score-big{font-size:36px;font-weight:800;color:#0066ff}
  .subtitle{color:#64748b;font-size:14px}
  .section-q{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .section-q label{margin:0;flex:1}
  .section-q input{margin:0;width:70px}
  .checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .checkbox-row input{width:auto;margin:0}
  .notes{width:100%;min-height:60px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;resize:vertical}
  .hidden{display:none}
  .spinner{display:inline-block;width:18px;height:18px;border:3px solid #e2e8f0;border-top-color:#0066ff;border-radius:50%;animation:spin .6s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

function scanPage(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PRISM D1 Assessment</title><style>${PAGE_STYLE}</style></head><body><div class="page">
<h1>PRISM D1 Velocity Assessment</h1>
<p class="subtitle">AI-Assisted Development Lifecycle Maturity Scanner</p>
<div class="card" style="margin-top:20px">
  <h2>Step 1: Scan Repository</h2>
  <form id="scanForm" method="POST" action="/scan">
    <label for="repoPath">Local repository path</label>
    <input type="text" id="repoPath" name="repoPath" placeholder="/home/user/my-project" required>
    <button type="submit">Scan Repository</button>
    <span id="spinner" class="spinner hidden"></span>
  </form>
</div>
</div>
<script>
document.getElementById('scanForm').addEventListener('submit', function(e) {
  document.getElementById('spinner').classList.remove('hidden');
});
</script>
</body></html>`;
}

function scanResultsPage(scan: ScanResultJSON): string {
  const catRows = scan.categories.map(c => {
    const pct = c.maxPoints > 0 ? Math.round((c.earnedPoints / c.maxPoints) * 100) : 0;
    const cls = pct >= 60 ? 'green' : pct >= 30 ? 'amber' : 'red';
    return `<tr><td>${c.category}</td><td><strong>${c.earnedPoints}/${c.maxPoints}</strong></td>
      <td><div class="progress-bg"><div class="progress-fill fill-${cls}" style="width:${pct}%"></div></div></td>
      <td>${pct}%</td></tr>`;
  }).join('');

  const strengthsHtml = scan.strengths.map(s => `<li>${s}</li>`).join('');
  const gapsHtml = scan.gaps.map(g => `<li>${g}</li>`).join('');
  const recsHtml = scan.recommendations.map(r => `<li>${r}</li>`).join('');

  // Encode scan data for passing to interview form
  const scanB64 = Buffer.from(JSON.stringify(scan)).toString('base64');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Scan Results — ${scan.repoName}</title><style>${PAGE_STYLE}</style></head><body><div class="page">
<h1>Scan Results: ${scan.repoName}</h1>
<p class="subtitle">Scanned ${scan.scanDate}</p>

<div class="card">
  <div class="grid-2">
    <div><div class="score-big">${scan.totalScore}/${scan.maxScore}</div><div class="subtitle">Scanner Score</div></div>
    <div><div class="score-big">${scan.prismLevel.level}</div><div class="subtitle">${scan.prismLevel.label} — ${scan.prismLevel.description}</div></div>
  </div>
</div>

<div class="card">
  <h2>Category Breakdown</h2>
  <table><thead><tr><th>Category</th><th>Score</th><th>Progress</th><th>%</th></tr></thead>
  <tbody>${catRows}</tbody></table>
</div>

<div class="card grid-2">
  <div><h2>Strengths</h2><ol>${strengthsHtml || '<li>None detected</li>'}</ol></div>
  <div><h2>Gaps</h2><ol>${gapsHtml || '<li>None detected</li>'}</ol></div>
</div>

${recsHtml ? `<div class="card"><h2>Recommendations</h2><ul>${recsHtml}</ul></div>` : ''}

<div class="card" style="display:flex;gap:12px">
  <form method="POST" action="/export-json"><input type="hidden" name="scanData" value="${scanB64}">
    <button type="submit" class="secondary">Export JSON</button></form>
  <form method="POST" action="/interview"><input type="hidden" name="scanData" value="${scanB64}">
    <button type="submit">Continue to Interview →</button></form>
</div>
</div></body></html>`;
}

function interviewPage(scan: ScanResultJSON): string {
  const scanB64 = Buffer.from(JSON.stringify(scan)).toString('base64');

  let sectionsHtml = '';
  for (const sec of INTERVIEW_SECTIONS) {
    let questionsHtml = '';
    for (const q of sec.questions) {
      questionsHtml += `<div class="section-q">
        <label for="${q.id}">${q.label}</label>
        <input type="number" id="${q.id}" name="${q.id}" min="0" max="${q.max}" value="0" required>
        <span class="subtitle">/ ${q.max}</span>
      </div>`;
    }
    sectionsHtml += `<div class="card">
      <h2>${sec.name} <span class="subtitle">(max ${sec.maxScore})</span></h2>
      ${questionsHtml}
      <label>Key findings / notes</label>
      <textarea class="notes" name="${sec.id}_notes" placeholder="Observations for this section..."></textarea>
    </div>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Interview — ${scan.repoName}</title><style>${PAGE_STYLE}</style></head><body><div class="page">
<h1>SA Interview: ${scan.repoName}</h1>
<p class="subtitle">Scanner score: ${scan.totalScore}/${scan.maxScore} (${scan.prismLevel.level})</p>

<form method="POST" action="/report">
<input type="hidden" name="scanData" value="${scanB64}">

<div class="card">
  <h2>Assessment Info</h2>
  <div class="grid-2">
    <div><label for="customerName">Customer name</label><input type="text" id="customerName" name="customerName" required></div>
    <div><label for="saName">SA / Interviewer</label><input type="text" id="saName" name="saName" required></div>
    <div><label for="fundingStage">Funding stage</label><input type="text" id="fundingStage" name="fundingStage" placeholder="Series A"></div>
    <div><label for="teamSize">Team size (engineers)</label><input type="number" id="teamSize" name="teamSize" min="1" value="10"></div>
  </div>
</div>

${sectionsHtml}

<div class="card">
  <h2>Org Readiness</h2>
  <div class="checkbox-row"><input type="checkbox" id="executiveSponsor" name="executiveSponsor"><label for="executiveSponsor">Executive sponsor identified</label></div>
  <div class="checkbox-row"><input type="checkbox" id="budgetAllocated" name="budgetAllocated"><label for="budgetAllocated">Budget allocated for AI tooling</label></div>
  <div class="checkbox-row"><input type="checkbox" id="dedicatedOwner" name="dedicatedOwner"><label for="dedicatedOwner">Dedicated AI/platform team or owner</label></div>
  <div class="checkbox-row"><input type="checkbox" id="awsRelationship" name="awsRelationship"><label for="awsRelationship">Existing AWS commitment/relationship</label></div>
  <div class="checkbox-row"><input type="checkbox" id="appropriateTeamSize" name="appropriateTeamSize"><label for="appropriateTeamSize">Team size appropriate (20-200 engineers)</label></div>
</div>

<div class="card"><button type="submit">Generate Report →</button></div>
</form>
</div></body></html>`;
}

function reportPage(scan: ScanResultJSON, interview: Record<string, any>, blended: BlendedResult): string {
  const customerName = interview.customerName || scan.repoName;
  const saName = interview.saName || 'N/A';
  const fundingStage = interview.fundingStage || 'N/A';
  const teamSize = interview.teamSize || 'N/A';

  // Build interview section scores
  let interviewRows = '';
  let interviewTotal = 0;
  for (const sec of INTERVIEW_SECTIONS) {
    let secScore = 0;
    for (const q of sec.questions) {
      secScore += parseInt(interview[q.id] || '0', 10);
    }
    interviewTotal += secScore;
    const pct = sec.maxScore > 0 ? Math.round((secScore / sec.maxScore) * 100) : 0;
    const cls = pct >= 60 ? 'green' : pct >= 30 ? 'amber' : 'red';
    const notes = interview[`${sec.id}_notes`] || '';
    const notesHtml = notes ? `<br><span class="subtitle">${notes}</span>` : '';
    interviewRows += `<tr><td><strong>${sec.name}</strong>${notesHtml}</td>
      <td>${secScore}/${sec.maxScore}</td><td><span class="badge badge-${cls}">${pct}%</span></td></tr>`;
  }

  // Scanner category rows
  const scanRows = scan.categories.map(c => {
    const pct = c.maxPoints > 0 ? Math.round((c.earnedPoints / c.maxPoints) * 100) : 0;
    const cls = pct >= 60 ? 'green' : pct >= 30 ? 'amber' : 'red';
    return `<tr><td>${c.category}</td><td>${c.earnedPoints}/${c.maxPoints}</td>
      <td><div class="progress-bg"><div class="progress-fill fill-${cls}" style="width:${pct}%"></div></div></td>
      <td>${pct}%</td></tr>`;
  }).join('');

  const verdictCls = blended.verdict === 'READY_FOR_PILOT' ? 'green' : blended.verdict === 'NEEDS_FOUNDATIONS' ? 'amber' : 'red';
  const verdictLabel = blended.verdict.replace(/_/g, ' ');

  // Org readiness items
  const orgKeys = ['executiveSponsor', 'budgetAllocated', 'dedicatedOwner', 'awsRelationship', 'appropriateTeamSize'];
  const orgLabels = ['Executive Sponsor', 'Budget Allocated', 'Dedicated Owner', 'AWS Relationship', 'Appropriate Team Size'];
  let orgHtml = '';
  orgKeys.forEach((k, i) => {
    const checked = !!interview[k];
    const icon = checked ? '✓' : '✗';
    const color = checked ? '#22c55e' : '#ef4444';
    orgHtml += `<span style="margin-right:16px"><span style="color:${color};font-weight:700">${icon}</span> ${orgLabels[i]}</span>`;
  });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Assessment Report — ${customerName}</title><style>${PAGE_STYLE}
  @media print{.no-print{display:none}.card{box-shadow:none;border:1px solid #e2e8f0}}
</style></head><body><div class="page">

<div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);color:#fff;padding:36px 32px;border-radius:12px;margin-bottom:24px">
  <h1 style="color:#fff;margin-bottom:2px">PRISM D1 Velocity Assessment</h1>
  <div class="subtitle" style="color:#94a3b8;margin-bottom:16px">AI-Assisted Development Lifecycle Maturity Report</div>
  <div class="grid-2" style="font-size:14px">
    <div><span style="color:#94a3b8">Customer</span><br><strong>${customerName}</strong></div>
    <div><span style="color:#94a3b8">Team Size</span><br><strong>${teamSize} engineers</strong></div>
    <div><span style="color:#94a3b8">Funding Stage</span><br><strong>${fundingStage}</strong></div>
    <div><span style="color:#94a3b8">SA</span><br><strong>${saName}</strong></div>
    <div><span style="color:#94a3b8">Repository</span><br><strong style="font-family:monospace">${scan.repoName}</strong></div>
    <div><span style="color:#94a3b8">Date</span><br><strong>${scan.scanDate}</strong></div>
  </div>
</div>

<div class="card">
  <h2>Executive Summary</h2>
  <div style="display:flex;align-items:center;gap:24px;margin-bottom:16px">
    <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#0066ff,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800;flex-shrink:0">${blended.level}</div>
    <div>
      <div style="font-size:20px;font-weight:700">PRISM D1 Level ${blended.level}</div>
      <span class="badge badge-${verdictCls}">${verdictLabel}</span>
    </div>
  </div>
  <div class="grid-2" style="gap:12px;margin-top:16px">
    <div class="card" style="text-align:center;margin:0"><div class="score-big">${Math.round(blended.scannerScore)}</div><div class="subtitle">Scanner (40%)</div></div>
    <div class="card" style="text-align:center;margin:0"><div class="score-big">${blended.interviewScore}</div><div class="subtitle">Interview (40%)</div></div>
  </div>
  <div class="grid-2" style="gap:12px;margin-top:12px">
    <div class="card" style="text-align:center;margin:0"><div class="score-big">${blended.orgReadinessScore}</div><div class="subtitle">Org Readiness /20 (20%)</div></div>
    <div class="card" style="text-align:center;margin:0"><div class="score-big">${blended.blendedScore}</div><div class="subtitle">Blended Score</div></div>
  </div>
</div>

<div class="card">
  <h2>Scanner Breakdown</h2>
  <table><thead><tr><th>Category</th><th>Score</th><th>Progress</th><th>%</th></tr></thead>
  <tbody>${scanRows}</tbody></table>
</div>

<div class="card">
  <h2>Interview Scores</h2>
  <table><thead><tr><th>Section</th><th>Score</th><th>Status</th></tr></thead>
  <tbody>${interviewRows}</tbody></table>
</div>

<div class="card">
  <h2>Organizational Readiness</h2>
  <div style="margin:8px 0">${orgHtml}</div>
  <p class="subtitle">Score: ${blended.orgReadinessScore}/20</p>
</div>

${scan.recommendations.length > 0 ? `<div class="card"><h2>Recommendations</h2><ul>${scan.recommendations.map(r => `<li>${r}</li>`).join('')}</ul></div>` : ''}

<div class="card no-print" style="display:flex;gap:12px">
  <button onclick="window.print()">Print / Save as PDF</button>
  <a href="/"><button type="button" class="secondary">New Assessment</button></a>
</div>

<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">
  PRISM D1 Velocity Assessment Report — ${scan.scanDate}<br>
  AWS Solutions Architecture · Startups Organization
</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function parseFormBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      const params: Record<string, string> = {};
      for (const pair of body.split('&')) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      }
      resolve(params);
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, contentType: string, body: string) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
function startServer(port: number) {
  const server = createServer(async (req, res) => {
    try {
      const url = req.url || '/';

      if (req.method === 'GET' && url === '/') {
        return send(res, 200, 'text/html', scanPage());
      }

      if (req.method === 'POST' && url === '/scan') {
        const form = await parseFormBody(req);
        const repoPath = form.repoPath?.trim();
        if (!repoPath) return send(res, 400, 'text/html', '<h1>Repository path is required</h1>');
        if (!existsSync(repoPath)) return send(res, 400, 'text/html', `<h1>Path not found: ${repoPath}</h1>`);
        const scan = runScanner(repoPath);
        return send(res, 200, 'text/html', scanResultsPage(scan));
      }

      if (req.method === 'POST' && url === '/export-json') {
        const form = await parseFormBody(req);
        const scan = JSON.parse(Buffer.from(form.scanData, 'base64').toString());
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${scan.repoName}-scan.json"`,
        });
        return res.end(JSON.stringify(scan, null, 2));
      }

      if (req.method === 'POST' && url === '/interview') {
        const form = await parseFormBody(req);
        const scan = JSON.parse(Buffer.from(form.scanData, 'base64').toString());
        return send(res, 200, 'text/html', interviewPage(scan));
      }

      if (req.method === 'POST' && url === '/report') {
        const form = await parseFormBody(req);
        const scan: ScanResultJSON = JSON.parse(Buffer.from(form.scanData, 'base64').toString());

        // Sum interview scores
        let interviewTotal = 0;
        for (const sec of INTERVIEW_SECTIONS) {
          for (const q of sec.questions) {
            interviewTotal += parseInt(form[q.id] || '0', 10);
          }
        }

        const org: Record<string, boolean> = {
          executiveSponsor: form.executiveSponsor === 'on',
          budgetAllocated: form.budgetAllocated === 'on',
          dedicatedOwner: form.dedicatedOwner === 'on',
          awsRelationship: form.awsRelationship === 'on',
          appropriateTeamSize: form.appropriateTeamSize === 'on',
        };

        const blended = computeBlended(scan.totalScore, scan.maxScore, interviewTotal, org);
        return send(res, 200, 'text/html', reportPage(scan, form, blended));
      }

      send(res, 404, 'text/html', '<h1>Not Found</h1>');
    } catch (err: any) {
      console.error('Server error:', err);
      send(res, 500, 'text/html', `<div class="page"><div class="card"><h2>Error</h2><pre>${err.message || err}</pre></div></div>`);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  PRISM D1 Assessment Web UI`);
    console.log(`  Running at: ${url}\n`);
    // Try to open browser
    try {
      const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${open} ${url}`, { stdio: 'ignore' });
    } catch { /* ignore if browser can't open */ }
  });
}

// ---------------------------------------------------------------------------
// CLI command export
// ---------------------------------------------------------------------------
export default {
  description: 'Launch the assessment web interface',
  options: [
    { flags: '-p, --port <number>', description: 'Port to listen on', default: '3120' },
  ],
  action(options: { port: string }) {
    const port = parseInt(options.port, 10) || 3120;
    startServer(port);
  },
};
