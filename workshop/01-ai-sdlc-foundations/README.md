# Module 01: AI-SDLC Foundations

| | |
|---|---|
| **Duration** | 45 minutes |
| **Prerequisites** | Module 00 complete (all checks passing) |
| **Learning Objective** | Configure Claude Code for spec-driven development, make first AI-assisted commit with proper metadata |

---

## Instructor Facilitation Guide

### [0-5 min] What Is AI-DLC and Why It Matters

> **Instructor Note:** This is the only pure-lecture segment in the module. Keep it tight. The goal is to establish vocabulary, not convince anyone -- these engineers already opted in by showing up.

**Key talking points:**

1. **AI-DLC is not "use ChatGPT more."** It's a disciplined lifecycle where AI participates at every stage -- spec authoring, implementation, review, testing, deployment -- with measurable contribution tracked end to end.

2. **The problem with ad-hoc AI usage:** Every engineer on your team probably uses AI differently. Some paste code into chat windows. Some use Copilot autocomplete. None of it is tracked, none of it is reproducible, and you can't tell your board how much velocity you're actually getting from AI spend.

3. **PRISM D1 Velocity gives you the structure:**
   - Specs define what to build (Kiro)
   - Claude Code implements against specs (with Bedrock backend)
   - Git hooks tag every commit with AI contribution metadata
   - CI pipelines evaluate AI output quality
   - Dashboards show the whole picture

4. **The payoff:** Teams at PRISM L3+ typically see 40-60% reduction in idea-to-PR time. But you only know that if you measure it. Today we build the measurement layer alongside the development workflow.

---

### [5-15 min] Claude Code Configuration Deep-Dive

Walk through the three configuration layers:

#### Layer 1: Bedrock Backend

Participants already set `CLAUDE_CODE_USE_BEDROCK=1` in Module 00. Explain what this does:

```
Developer Machine                    AWS Account
+------------------+                +------------------+
| Claude Code CLI  | ---HTTPS--->  | Amazon Bedrock   |
| (local)          |               | (Claude Sonnet)  |
+------------------+               +------------------+
                                          |
                                   CloudTrail logs
                                   every invocation
```

- All prompts and responses stay within your AWS account boundary
- CloudTrail gives you an audit trail of every AI invocation
- Bedrock model invocation logging (optional) captures full request/response for compliance
- Billing goes through your AWS bill, not a separate AI vendor invoice

#### Layer 2: CLAUDE.md Project Configuration

`CLAUDE.md` is a markdown file at the root of your repo that tells Claude Code how to behave in this project. It's version-controlled, team-shared, and enforced on every invocation.

```markdown
# CLAUDE.md -- project-level instructions for Claude Code

## Development Workflow
- Always check for a spec in /specs before implementing a feature
- If no spec exists, create one first and get approval before writing code
- Follow the spec's acceptance criteria as your definition of done

## Code Standards
- TypeScript strict mode, no `any` types
- All API endpoints must have OpenAPI annotations
- Tests required for all new functions (vitest)

## Git Conventions
- Conventional commits: feat|fix|docs|refactor|test(scope): description
- Every commit message must reference the spec file it implements
```

> **Instructor Note:** Emphasize that CLAUDE.md is the single most impactful configuration. A good CLAUDE.md turns Claude Code from a generic coding assistant into a team-aligned development agent. A bad one (or none at all) means every engineer gets different behavior.

#### Layer 3: Model Selection

```bash
# See which model Claude Code is using
claude config get model

# For this workshop we'll use Sonnet for speed
claude config set model anthropic.claude-sonnet-4-20250514

# In production, some teams use Opus for complex architectural work
# claude config set model anthropic.claude-opus-4-20250514
```

---

### [15-30 min] Hands-On: Configure Claude Code and Make First AI-Assisted Commit

Have participants work through Exercises 1 and 2.

#### Exercise 1: Create CLAUDE.md (10 min)

Direct participants to `exercises/01-create-claude-md.md`. They will:
1. Create a CLAUDE.md in the sample-app repo
2. Include spec-first enforcement rules
3. Test it by asking Claude Code to implement something without a spec

> **Instructor Note:** Walk the room. The most common mistake is making CLAUDE.md too vague ("write good code") or too restrictive ("never use loops"). Guide them toward specific, actionable instructions.

#### Exercise 2: First AI-Assisted Commit (10 min)

Direct participants to `exercises/02-ai-assisted-commit.md`. They will:
1. Use Claude Code to implement a simple health-check endpoint
2. Commit the result
3. Inspect the commit for AI origin metadata

After Exercise 2, have a few participants share their commit messages and metadata. Point out differences.

---

### [30-40 min] Exercise 3: Understanding Commit Metadata

Direct participants to `exercises/03-commit-metadata.md`. They will:
1. Examine the git trailer on their AI-assisted commit
2. Understand what data flows downstream to metrics
3. Compare AI-assisted vs. human-only commits

Walk through the metadata schema on the projector:

```
commit abc123
Author: developer@company.com
Date:   Mon Apr 13 10:30:00 2026 -0700

    feat(api): add health check endpoint

    Implements GET /health returning service status.

    Spec: specs/health-check.md
    AI-Origin: claude-code
    AI-Model: anthropic.claude-sonnet-4-20250514
    AI-Confidence: implementation
    AI-Session: ses_abc123def456
```

Explain each trailer:
- **AI-Origin**: Which tool produced the code (claude-code, kiro, human)
- **AI-Model**: Exact model version used -- critical for reproducibility
- **AI-Confidence**: Was this `implementation` (AI wrote it), `assisted` (AI helped), or `reviewed` (AI checked it)
- **AI-Session**: Links back to the Claude Code session for audit

---

### [40-45 min] Wrap-Up and Bridge to Module 02

**Key takeaway:** You now have Claude Code configured for your project with spec-first enforcement, and you've seen the metadata that every AI-assisted commit emits. In Module 02, we'll write real specs in Kiro and use Claude Code to implement against them.

**Check for understanding:**
- "Can someone explain what CLAUDE.md does and why it matters?"
- "What's the difference between AI-Origin values `claude-code` and `assisted`?"
- "Where does the commit metadata go after it's created?" (Answer: nowhere yet -- we wire that up in Module 03)

---

## Common Questions

**Q: Does CLAUDE.md get sent to the LLM with every prompt?**
A: Yes. Claude Code prepends CLAUDE.md contents to every conversation. That's why it's effective -- and why you should keep it focused. A 2000-line CLAUDE.md wastes tokens and confuses the model.

**Q: Can I have different CLAUDE.md files for different branches?**
A: Yes, it's just a file in your repo. Some teams use a stricter CLAUDE.md on `main` and a more permissive one on feature branches.

**Q: What if Claude Code ignores the CLAUDE.md instructions?**
A: This happens occasionally, especially with vague instructions. Make your rules specific and testable. Instead of "write clean code," say "all functions must have JSDoc comments with @param and @returns tags." If it still ignores rules, file a bug -- the team takes these seriously.

**Q: How is the AI-Origin trailer different from GitHub Copilot's metadata?**
A: Copilot tags suggestions at the autocomplete level. Claude Code's trailer is at the commit level, capturing the full contribution mode (implementation vs. assisted vs. reviewed). The PRISM pipeline consumes this for DORA-level metrics, not just usage counts.
