import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Colors ---
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[0;33m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

let PASS = 0;
let FAIL = 0;
let WARN = 0;

function pass(msg: string) {
  console.log(`  ${GREEN}[PASS]${NC} ${msg}`);
  PASS++;
}

function fail(msg: string, fix: string) {
  console.log(`  ${RED}[FAIL]${NC} ${msg}`);
  console.log(`        Fix: ${fix}`);
  FAIL++;
}

function warn(msg: string) {
  console.log(`  ${YELLOW}[WARN]${NC} ${msg}`);
  WARN++;
}

function heading(text: string) {
  console.log(`\n${BOLD}${text}${NC}`);
}

/**
 * Run a shell command and return { ok, stdout, stderr }.
 * Never throws — returns ok=false on failure.
 */
function run(cmd: string) {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return { ok: true, stdout, stderr: '' };
  } catch (err: any) {
    return { ok: false, stdout: '', stderr: (err.stderr || err.message || '').trim() };
  }
}

function commandExists(cmd: string) {
  return run(`command -v ${cmd}`).ok;
}

// -------------------------------------------------------------------
// Checks
// -------------------------------------------------------------------

function checkAwsCli() {
  heading('1. AWS CLI & Credentials');

  if (commandExists('aws')) {
    const { stdout } = run('aws --version 2>&1');
    pass(`AWS CLI installed (${stdout.split('\n')[0]})`);
  } else {
    fail('AWS CLI not found', 'Install from https://aws.amazon.com/cli/');
  }

  const sts = run('aws sts get-caller-identity --query Account --output text');
  if (sts.ok) {
    pass(`AWS credentials configured (account: ${sts.stdout})`);
  } else {
    fail('AWS credentials not configured or expired', "Run 'aws configure' or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY");
  }
}

function checkBedrock() {
  heading('2. Amazon Bedrock Model Access');

  // list-foundation-models shows the catalog; list-inference-profiles shows what you can actually invoke
  const models = run("aws bedrock list-foundation-models --query \"modelSummaries[?contains(modelId, 'anthropic.claude')].modelId\" --output text");
  let claudeModelIds: string[] = [];

  if (models.ok) {
    claudeModelIds = models.stdout.split(/\s+/).filter(Boolean);
    if (claudeModelIds.length > 0) {
      pass(`Bedrock lists ${claudeModelIds.length} Claude model(s)`);
    } else {
      fail('No Claude models found in Bedrock', 'Enable Claude model access in AWS Console > Bedrock > Model access');
    }
  } else {
    fail('Cannot query Bedrock models', 'Check AWS credentials and region (need us-west-2)');
  }

  // Use inference profiles to find models we can actually invoke
  const profiles = run("aws bedrock list-inference-profiles --query \"inferenceProfileSummaries[?contains(inferenceProfileId, 'anthropic.claude')].inferenceProfileId\" --output text");
  let invocableIds: string[] = [];
  if (profiles.ok) {
    invocableIds = profiles.stdout.split(/\s+/).filter(Boolean);
  }

  // Fall back to foundation model IDs if no inference profiles found
  const candidates = invocableIds.length > 0 ? invocableIds : claudeModelIds;

  if (candidates.length === 0) {
    fail('Cannot test Bedrock invocation — no Claude model available', 'Enable Claude model access in AWS Console > Bedrock > Model access');
    return;
  }

  // AWS CLI expects --body as fileb:// or base64; write to a temp file
  const bodyFile = '/tmp/prism-bedrock-request.json';
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say OK' }],
  });
  writeFileSync(bodyFile, body);

  let invoked = false;
  const errors = [];
  for (const modelId of candidates) {
    const invoke = run(
      `aws bedrock-runtime invoke-model ` +
      `--model-id "${modelId}" ` +
      `--content-type "application/json" ` +
      `--accept "application/json" ` +
      `--body "fileb://${bodyFile}" ` +
      `/tmp/prism-bedrock-test.json`
    );
    if (invoke.ok) {
      pass(`Bedrock Claude invocation works (${modelId})`);
      run('rm -f /tmp/prism-bedrock-test.json');
      invoked = true;
      break;
    } else {
      errors.push({ modelId, error: invoke.stderr });
    }
  }

  try { unlinkSync(bodyFile); } catch { /* ignore */ }

  if (!invoked) {
    fail('Cannot invoke any Claude model on Bedrock', 'Ensure model access is granted for at least one Claude model in AWS Console > Bedrock > Model access');
    console.log(`        Tried ${errors.length} model(s):`);
    for (const { modelId, error } of errors) {
      const shortError = error.split('\n')[0] || 'unknown error';
      console.log(`          - ${modelId}: ${shortError}`);
    }
  }
}

function checkClaudeCode() {
  heading('3. Claude Code CLI');

  if (commandExists('claude')) {
    const { stdout } = run('claude --version');
    pass(`Claude Code CLI installed (${stdout || 'version unknown'})`);
  } else {
    fail('Claude Code CLI not found', 'Run: curl -fsSL https://claude.ai/install.sh | bash');
  }

  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') {
    pass('CLAUDE_CODE_USE_BEDROCK=1 is set');
  } else {
    fail('CLAUDE_CODE_USE_BEDROCK not set', 'Run: export CLAUDE_CODE_USE_BEDROCK=1');
  }

  if (process.env.AWS_REGION) {
    pass(`AWS_REGION is set (${process.env.AWS_REGION})`);
  } else {
    warn('AWS_REGION not set -- Claude Code will use default region. Set with: export AWS_REGION=us-west-2');
  }
}

function checkKiro() {
  heading('4. Kiro IDE');

  if (commandExists('kiro')) {
    const { stdout } = run('kiro --version');
    pass(`Kiro CLI found (${stdout || 'version unknown'})`);
  } else {
    warn('Kiro CLI not found in PATH -- verify Kiro is installed from https://kiro.dev');
  }
}

function checkGit() {
  heading('5. Git');

  if (commandExists('git')) {
    const { stdout } = run('git --version');
    const match = stdout.match(/(\d+)\.(\d+)/);
    if (match) {
      const [, major, minor] = match.map(Number);
      if (major >= 2 && minor >= 34) {
        pass(`${stdout} (>= 2.34 required for trailer support)`);
      } else {
        fail(`Git version too old (${stdout})`, 'Need git >= 2.34. Run: brew install git (macOS) or apt-get install git (Linux)');
      }
    }
  } else {
    fail('Git not found', 'Install git');
  }
}

function checkNode() {
  heading('6. Node.js & npm');

  if (commandExists('node')) {
    const { stdout } = run('node --version');
    const major = parseInt(stdout.replace('v', ''), 10);
    if (major >= 20) {
      pass(`Node.js ${stdout} (>= 20 required)`);
    } else {
      fail(`Node.js too old (${stdout})`, 'Need Node.js >= 20. Use nvm: nvm install 20');
    }
  } else {
    fail('Node.js not found', 'Install from https://nodejs.org/ or use nvm');
  }

  if (commandExists('npm')) {
    const { stdout } = run('npm --version');
    pass(`npm ${stdout}`);
  } else {
    fail('npm not found', 'Should come with Node.js -- reinstall Node');
  }
}

function checkPython() {
  heading('7. Python');

  const python = commandExists('python3') ? 'python3' : commandExists('python') ? 'python' : null;

  if (!python) {
    fail('Python not found', 'Install Python >= 3.11 from https://www.python.org/ or use pyenv');
    return;
  }

  const { stdout } = run(`${python} --version`);
  const match = stdout.match(/(\d+)\.(\d+)/);
  if (match) {
    const [, major, minor] = match.map(Number);
    if (major >= 3 && minor >= 11) {
      pass(`${stdout} (>= 3.11 required)`);
    } else {
      fail(`Python too old (${stdout})`, 'Need Python >= 3.11. Use pyenv: pyenv install 3.11');
    }
  } else {
    fail(`Could not determine Python version (${stdout})`, 'Ensure python3 --version works');
  }

  if (commandExists('pip3') || commandExists('pip')) {
    const pip = commandExists('pip3') ? 'pip3' : 'pip';
    const { stdout: pipVersion } = run(`${pip} --version`);
    pass(`pip installed (${pipVersion.split(' ').slice(0, 2).join(' ')})`);
  } else {
    fail('pip not found', 'Install pip: python3 -m ensurepip --upgrade');
  }
}

function checkUtilities() {
  heading('8. Utilities');

  if (commandExists('jq')) {
    const { stdout } = run('jq --version');
    pass(`jq installed (${stdout})`);
  } else {
    fail('jq not found', 'Run: brew install jq (macOS) or apt-get install jq (Linux)');
  }

  if (commandExists('curl')) {
    pass('curl installed');
  } else {
    fail('curl not found', 'Install curl');
  }

  if (commandExists('bc')) {
    pass('bc installed');
  } else {
    fail('bc not found', 'Run: brew install bc (macOS) or apt-get install bc (Linux)');
  }
}

function checkSampleApp() {
  heading('9. Sample App');

  const sampleAppDir = process.env.SAMPLE_APP_PATH || resolve(__dirname, '../../../../sample-app');

  if (existsSync(resolve(sampleAppDir, 'package.json'))) {
    pass(`Sample app found at ${sampleAppDir}`);
    if (existsSync(resolve(sampleAppDir, 'node_modules'))) {
      pass('Sample app dependencies installed');
    } else {
      warn(`Sample app dependencies not installed. Run: cd ${sampleAppDir} && npm install`);
    }
  } else {
    warn(`Sample app not found at ${sampleAppDir}. Clone it: git clone https://github.com/aws-samples/prism-d1-sample-app.git`);
  }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

export default {
  description: 'Verify environment prerequisites for the workshop',
  action() {
    verifySetup();
  },
};

function verifySetup() {
  console.log('');
  console.log(`${BOLD}================================================${NC}`);
  console.log(`${BOLD}  PRISM D1 Velocity - Environment Verification  ${NC}`);
  console.log(`${BOLD}================================================${NC}`);

  checkAwsCli();
  checkBedrock();
  checkClaudeCode();
  checkKiro();
  checkGit();
  checkNode();
  checkPython();
  checkUtilities();
  checkSampleApp();

  console.log('');
  console.log(`${BOLD}================================================${NC}`);
  console.log(`  ${GREEN}PASS: ${PASS}${NC}   ${RED}FAIL: ${FAIL}${NC}   ${YELLOW}WARN: ${WARN}${NC}`);
  console.log(`${BOLD}================================================${NC}`);
  console.log('');

  if (FAIL > 0) {
    console.log(`${RED}${BOLD}SETUP INCOMPLETE.${NC} Fix the failures above before proceeding.`);
    console.log('Ask your instructor for help if you\'re stuck.');
    process.exit(1);
  } else if (WARN > 0) {
    console.log(`${YELLOW}${BOLD}SETUP OK WITH WARNINGS.${NC} Review the warnings above -- some modules may not work.`);
  } else {
    console.log(`${GREEN}${BOLD}ALL CHECKS PASSED.${NC} You're ready for the workshop!`);
  }
}
