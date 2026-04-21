#!/usr/bin/env python3
"""Deploy the Task Assistant Agent to Amazon Bedrock AgentCore.

Uses the AgentCore CLI (@aws/agentcore). On first run, scaffolds the
project with 'agentcore create', then copies the agent entrypoint into
the generated project structure before deploying.

Prerequisites:
    npm install -g @aws/agentcore
    AWS CDK bootstrapped: cdk bootstrap

Usage:
    python scripts/deploy-agentcore.py
    python scripts/deploy-agentcore.py --local
    python scripts/deploy-agentcore.py --plan
    python scripts/deploy-agentcore.py --destroy
"""

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AGENT_DIR = os.path.dirname(SCRIPT_DIR)
AGENT_NAME = "prismtaskassistant"
CDK_DIR = os.path.join(AGENT_DIR, "agentcore", "cdk")


def run_cmd(cmd: list[str], cwd: str | None = None) -> subprocess.CompletedProcess:
    """Run a CLI command and return the result."""
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(
        [shlex.quote(arg) for arg in cmd], text=True, cwd=cwd or AGENT_DIR,
    )


def check_cli() -> None:
    """Verify the AgentCore CLI is installed."""
    try:
        result = subprocess.run(
            [shlex.quote(arg) for arg in ["agentcore", "--version"]],
            capture_output=True, check=True, text=True,
        )
        print(f"AgentCore CLI: {result.stdout.strip()}")
    except FileNotFoundError:
        print("\nError: AgentCore CLI not found.")
        print("Install with: npm install -g @aws/agentcore")
        sys.exit(1)


def needs_create() -> bool:
    """Check if the agentcore project needs to be scaffolded."""
    return not os.path.exists(CDK_DIR)


def create_project() -> None:
    """Scaffold the AgentCore project using the CLI."""
    print("\nScaffolding AgentCore project...")

    # Run agentcore create in the parent directory so it creates
    # the project as a subdirectory we can work with.
    # We create in a temp location then move the agentcore/ dir in.
    tmp_dir = os.path.join(AGENT_DIR, ".agentcore-tmp")
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir)

    result = run_cmd([
        "agentcore", "create",
        "--name", AGENT_NAME,
        "--framework", "Strands",
        "--protocol", "HTTP",
        "--build", "Container",
        "--model-provider", "Bedrock",
        "--memory", "shortTerm",
    ], cwd=tmp_dir)

    if result.returncode != 0:
        print(f"\nagentcore create failed (exit {result.returncode})")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(result.returncode)

    # Move the generated agentcore/ directory into our project
    generated_project = os.path.join(tmp_dir, AGENT_NAME)
    generated_agentcore = os.path.join(generated_project, "agentcore")

    if os.path.exists(generated_agentcore):
        target = os.path.join(AGENT_DIR, "agentcore")
        if os.path.exists(target):
            shutil.rmtree(target)
        shutil.move(generated_agentcore, target)
        print(f"  Moved agentcore/ config into project")

    shutil.rmtree(tmp_dir, ignore_errors=True)

    # Update the entrypoint in agentcore.json to point to our code
    update_entrypoint()


def update_entrypoint() -> None:
    """Update agentcore.json to point to our agent entrypoint and code location."""
    config_path = os.path.join(AGENT_DIR, "agentcore", "agentcore.json")
    if not os.path.exists(config_path):
        return

    with open(config_path) as f:
        config = json.load(f)

    # Update runtime config to point to our code
    if "runtimes" in config:
        for runtime in config["runtimes"]:
            runtime["build"] = "Container"
            runtime["entrypoint"] = "task_assistant/agentcore_app.py"
            runtime["codeLocation"] = "src/"
            runtime["runtimeVersion"] = "PYTHON_3_13"

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print("  Updated agentcore.json: codeLocation=src/, entrypoint=task_assistant/agentcore_app.py")


def resolve_account_id() -> None:
    """Populate aws-targets.json with the current AWS account ID if empty."""
    targets_path = os.path.join(AGENT_DIR, "agentcore", "aws-targets.json")
    if not os.path.exists(targets_path):
        return

    with open(targets_path) as f:
        targets = json.load(f)

    # Find the first target missing an account
    if not targets:
        targets = [{"name": "default", "account": "", "region": "us-west-2"}]

    target = targets[0]
    if target.get("account"):
        return

    try:
        result = subprocess.run(
            [shlex.quote(arg) for arg in
             ["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"]],
            capture_output=True, check=True, text=True,
        )
        account_id = result.stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("Warning: Could not resolve AWS account ID. Fill agentcore/aws-targets.json manually.")
        return

    target["account"] = account_id
    with open(targets_path, "w") as f:
        json.dump(targets, f, indent=2)
    print(f"  Resolved AWS account: {account_id}")


def main():
    parser = argparse.ArgumentParser(description="Deploy agent to AgentCore Runtime")
    parser.add_argument("--local", action="store_true", help="Run locally with agentcore dev")
    parser.add_argument("--destroy", action="store_true", help="Tear down deployed resources")
    parser.add_argument("--plan", action="store_true", help="Preview deployment changes")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose deploy output")
    args = parser.parse_args()

    check_cli()

    if needs_create():
        create_project()

    resolve_account_id()

    if args.destroy:
        print("\nDestroying resources...")
        run_cmd(["agentcore", "remove", "all"])
        run_cmd(["agentcore", "deploy", "-y"])
        return

    if args.local:
        print("\nStarting local dev server...")
        run_cmd(["agentcore", "dev", "--no-browser"])
        return

    print("\nDeploying to AgentCore Runtime...")
    cmd = ["agentcore", "deploy", "-y"]
    if args.plan:
        cmd = ["agentcore", "deploy", "--plan"]
    if args.verbose:
        cmd.append("-v")

    result = run_cmd(cmd)
    if result.returncode != 0:
        print(f"\nDeployment failed (exit {result.returncode})")
        sys.exit(result.returncode)

    print("\nChecking status...")
    run_cmd(["agentcore", "status"])

    print("\n✓ Done! Next steps:")
    print("  agentcore invoke 'List all tasks'")
    print("  agentcore logs")
    print("  agentcore status")


if __name__ == "__main__":
    main()
