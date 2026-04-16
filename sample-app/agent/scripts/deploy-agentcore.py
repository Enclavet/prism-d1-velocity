#!/usr/bin/env python3
"""Deploy the Task Assistant Agent to Amazon Bedrock AgentCore.

This script packages the agent and deploys it to AgentCore Runtime.
It uses the AgentCore CLI under the hood.

Usage:
    python scripts/deploy-agentcore.py
    python scripts/deploy-agentcore.py --config path/to/agentcore-runtime.json
    python scripts/deploy-agentcore.py --dry-run
"""

import argparse
import json
import os
import subprocess
import sys


DEFAULT_CONFIG = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "..", "bootstrapper", "agent-configs", "agentcore-runtime.json",
)


def load_config(path: str) -> dict:
    """Load AgentCore runtime configuration."""
    with open(path) as f:
        return json.load(f)


def deploy(config: dict, dry_run: bool = False) -> None:
    """Deploy agent to AgentCore Runtime."""
    agent_name = config.get("agent_name", "task-assistant")
    region = config.get("aws_region", "us-west-2")

    print(f"Deploying agent '{agent_name}' to AgentCore in {region}...")
    print(f"Configuration: {json.dumps(config, indent=2)}")

    if dry_run:
        print("\n[DRY RUN] Would execute:")
        print(f"  agentcore deploy --name {agent_name} --region {region}")
        print("  Skipping actual deployment.")
        return

    # Check AgentCore CLI is available
    try:
        subprocess.run(
            ["agentcore", "--version"],
            capture_output=True, check=True, text=True,
        )
    except FileNotFoundError:
        print("\nError: AgentCore CLI not found. Install it with:")
        print("  pip install agentcore-cli")
        print("\nOr install from: https://github.com/aws/agentcore-cli")
        sys.exit(1)

    # Deploy using AgentCore CLI
    cmd = [
        "agentcore", "deploy",
        "--name", agent_name,
        "--region", region,
        "--handler", "src.task_assistant.agent:create_agent",
    ]

    if config.get("memory_enabled"):
        cmd.extend(["--memory", "true"])

    if config.get("timeout_seconds"):
        cmd.extend(["--timeout", str(config["timeout_seconds"])])

    print(f"\nRunning: {' '.join(cmd)}")
    result = subprocess.run(cmd, text=True)

    if result.returncode == 0:
        print(f"\nAgent '{agent_name}' deployed successfully!")
        print(f"Endpoint: https://{agent_name}.agentcore.{region}.amazonaws.com")
    else:
        print(f"\nDeployment failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Deploy agent to AgentCore")
    parser.add_argument(
        "--config", default=DEFAULT_CONFIG,
        help="Path to AgentCore runtime config JSON",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen")
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Config file not found: {args.config}")
        print("Create one from: bootstrapper/agent-configs/agentcore-runtime.json")
        sys.exit(1)

    config = load_config(args.config)
    deploy(config, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
