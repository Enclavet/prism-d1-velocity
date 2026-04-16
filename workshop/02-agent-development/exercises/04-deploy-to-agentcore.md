# Exercise 4: Deploy to AgentCore (Extension)

**Time:** 15 minutes

## Objective

Understand what production deployment of a Strands agent looks like using Amazon Bedrock AgentCore. This exercise is a guided walkthrough -- you won't deploy live, but you'll configure everything needed and run a dry-run deployment.

## Prerequisites

- Exercise 1 complete (agent working locally)
- AWS CLI configured (for dry-run only)

## Background

Building an agent locally is step one. Running it in production requires answers to questions your local setup ignores:

| Concern | Local | Production (AgentCore) |
|---------|-------|------------------------|
| **Runtime** | `python3 agent.py` | Managed container with auto-scaling |
| **Memory** | None (stateless) | Persistent session memory across invocations |
| **Access** | `localhost` | API Gateway with auth, throttling, CORS |
| **Observability** | `print()` statements | CloudWatch metrics, traces, logs |
| **Security** | Your AWS credentials | IAM roles, guardrail policies, audit trail |

Amazon Bedrock AgentCore provides all of this as managed infrastructure. You bring the agent code; AgentCore handles the operational concerns.

## Steps

### Step 1: Review the AgentCore configuration

Open the configuration file:

```bash
cat sample-app/agent/agentcore-runtime.json
```

This file tells AgentCore how to run your agent. Here's the structure:

```json
{
  "agent_name": "prism-task-assistant",
  "runtime": {
    "entry_point": "src.task_assistant.agent",
    "factory_function": "create_agent",
    "python_version": "3.11",
    "requirements": "requirements.txt"
  },
  "model": {
    "provider": "bedrock",
    "model_id": "anthropic.claude-sonnet-4-20250514",
    "region": "us-west-2"
  },
  "memory": {
    "enabled": true,
    "provider": "agentcore",
    "session_ttl_seconds": 3600,
    "max_messages_per_session": 100
  },
  "gateway": {
    "enabled": true,
    "auth": "iam",
    "throttle_rps": 10,
    "cors_origins": ["https://your-app.example.com"]
  },
  "observability": {
    "metrics_namespace": "PRISM/D1/Agents",
    "tracing_enabled": true,
    "log_level": "INFO"
  },
  "guardrails": {
    "max_steps": 15,
    "timeout_seconds": 60,
    "bedrock_guardrail_id": null
  }
}
```

### Step 2: Understand each component

Walk through the four AgentCore pillars:

**1. Runtime** -- Where and how your agent code runs.
- AgentCore packages your code into a container
- `entry_point` + `factory_function` tell it how to create the agent
- It manages scaling (more containers when traffic is high, fewer when low)
- Your code doesn't change -- `create_agent()` works the same locally and in AgentCore

**2. Memory** -- Persistent conversation state.
- Locally, each agent invocation is stateless (new agent, no history)
- AgentCore maintains session memory: the agent remembers previous turns
- `session_ttl_seconds: 3600` means sessions expire after 1 hour of inactivity
- Memory is stored in a managed store (you don't manage the database)

**3. Gateway** -- API access to your agent.
- Exposes your agent as an HTTPS endpoint
- Handles authentication (IAM, API keys, or Cognito)
- Rate limiting (`throttle_rps: 10` = max 10 requests per second)
- CORS configuration for browser-based clients

**4. Observability** -- Monitoring and debugging.
- CloudWatch metrics: invocation count, latency, error rate, token usage
- Distributed tracing: see the full tool-call chain across agents
- Structured logs: every tool call, model invocation, and guardrail trigger is logged
- This feeds directly into the PRISM dashboards from Module 05

### Step 3: Run the dry-run deployment

The deploy script validates your configuration and shows what would be created:

```bash
cd sample-app/agent

python3 deploy-agentcore.py --dry-run
```

Expected output:

```
=== AgentCore Deployment Plan (DRY RUN) ===

Agent: prism-task-assistant
Region: us-west-2

Resources to create:
  [Runtime]
    - Container image: prism-task-assistant:latest
    - Entry point: src.task_assistant.agent:create_agent
    - Python 3.11, dependencies from requirements.txt

  [Memory]
    - Session store: enabled
    - TTL: 3600s
    - Max messages: 100/session

  [Gateway]
    - Endpoint: https://<agent-id>.agentcore.us-west-2.amazonaws.com/invoke
    - Auth: IAM
    - Rate limit: 10 RPS

  [Observability]
    - CloudWatch namespace: PRISM/D1/Agents
    - Tracing: enabled (X-Ray)
    - Log group: /aws/agentcore/prism-task-assistant

  [IAM]
    - Execution role: agentcore-prism-task-assistant-role
    - Bedrock invoke permission: anthropic.claude-sonnet-4-20250514
    - EventBridge put-events permission: prism-d1-metrics

Estimated monthly cost (at 1000 invocations/day):
  Runtime: ~$15/mo
  Memory:  ~$3/mo
  Gateway: ~$5/mo
  Model:   ~$30-90/mo (depends on token usage)

No resources were created (dry run).
```

### Step 4: Review the IAM permissions

AgentCore creates a least-privilege IAM role for your agent. Review what permissions it needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-20250514"
    },
    {
      "Effect": "Allow",
      "Action": "events:PutEvents",
      "Resource": "arn:aws:events:us-west-2:*:event-bus/prism-d1-metrics"
    }
  ]
}
```

The agent can only invoke the model it's configured to use and emit events to the metrics bus. It cannot access other AWS resources unless you explicitly grant permission. This is the principle of least privilege applied to agents.

### Step 5: Understand the invocation flow

Once deployed, the flow looks like this:

```
Client (curl/browser/other agent)
  |
  v
API Gateway (auth + throttle)
  |
  v
AgentCore Runtime (your agent container)
  |
  +---> Memory Store (load/save session)
  |
  +---> Bedrock (model inference)
  |
  +---> MCP Server (tool execution)
  |
  +---> EventBridge (metrics emission)
  |
  +---> CloudWatch (traces + logs)
  |
  v
Response to client
```

The invocation endpoint would look like:

```bash
# Example: invoking the deployed agent
curl -X POST https://<agent-id>.agentcore.us-west-2.amazonaws.com/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -d '{
    "session_id": "user-123-session-1",
    "prompt": "Create a task to fix the login bug"
  }'
```

The `session_id` enables memory -- subsequent requests with the same session ID continue the conversation.

### Step 6: Connect to PRISM metrics

The agent already emits `prism.d1.agent` events via the `AgentMetrics` class from Exercise 1. In production, these events flow through the same pipeline you built in Modules 03-05:

```
Agent invocation
  -> AgentMetrics.emit()
    -> EventBridge (prism-d1-metrics bus)
      -> Lambda (enrichment)
        -> DynamoDB (storage)
          -> CloudWatch Dashboard (visualization)
```

The dashboard from Module 05 would show:
- Agent invocation count per hour
- Average tool calls per invocation
- P50/P95 latency
- Error rate
- Token usage trends
- Guardrail trigger frequency

## Verification

You've completed this exercise when:
- [ ] You can explain the four AgentCore pillars: Runtime, Memory, Gateway, Observability
- [ ] You've run the dry-run deployment and reviewed the resource plan
- [ ] You understand how the agent's IAM role follows least-privilege
- [ ] You can trace a request from client to agent to tools to response
- [ ] You see how agent metrics connect to the PRISM dashboard pipeline
