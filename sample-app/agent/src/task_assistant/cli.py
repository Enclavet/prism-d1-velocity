"""CLI entry point for the task assistant agent.

Usage:
    python -m src.task_assistant.cli              # Bedrock mode
    python -m src.task_assistant.cli --mock        # Mock mode
    python -m src.task_assistant.cli --mock --verbose
"""

import argparse
import sys

from .agent import create_agent, run_with_metrics
from .config import AgentConfig


def main():
    parser = argparse.ArgumentParser(description="Task Assistant Agent")
    parser.add_argument("--mock", action="store_true", help="Use mock model (no AWS)")
    parser.add_argument("--mcp", action="store_true", help="Connect via MCP server")
    parser.add_argument("--verbose", action="store_true", help="Show reasoning trace")
    parser.add_argument("--api-url", default="http://localhost:3000", help="Task API URL")
    parser.add_argument("--no-metrics", action="store_true", help="Disable metrics")
    args = parser.parse_args()

    config = AgentConfig(
        task_api_url=args.api_url,
        use_mcp=args.mcp,
        emit_metrics=not args.no_metrics,
    )

    agent = create_agent(config=config, mock=args.mock)

    mode = "mock" if args.mock else "Bedrock"
    print(f"Task Assistant Agent | Mode: {mode} | API: {args.api_url}")
    if args.verbose:
        print("Verbose mode: reasoning traces enabled")
    print("Type your request (or 'quit' to exit):\n")

    while True:
        try:
            prompt = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not prompt or prompt.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        try:
            response = run_with_metrics(agent, prompt, config)
            print(f"\n{response}\n")
        except Exception as exc:
            print(f"\nError: {exc}\n")


if __name__ == "__main__":
    main()
