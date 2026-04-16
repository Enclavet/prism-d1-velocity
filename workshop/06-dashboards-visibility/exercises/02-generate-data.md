# Exercise 2: Generate Sample Metric Data

**Time:** 5 minutes

## Objective

Generate a week's worth of realistic commit and PR metric data, send it to EventBridge, and watch it appear on the dashboard.

## Steps

### Step 1: Run the data generator

```bash
cd /path/to/workshop/06-dashboards-visibility/exercises/
chmod +x generate-sample-data.sh
./generate-sample-data.sh
```

The script generates 7 days of simulated team activity:
- 5 engineers making commits across 2 repos
- Mix of human, AI-assisted, and AI-generated commits
- Daily PR merges with lead time metrics
- Eval gate results (some pass, some fail)
- One "bad day" with a spike in eval failures (can you find it?)

### Step 2: Watch the dashboard populate

Open your CloudWatch dashboard (from Exercise 1) and refresh. Set the time range to "1 week."

You should see:
- **AI Contribution Ratio** climbing from ~30% to ~55% over the week (typical onboarding pattern)
- **AI Acceptance Rate** hovering around 82-90% with one dip
- **Deployment Frequency** at roughly 3-5 deploys/day
- **Lead Time** trending downward (from hours to minutes as the team adopts AI)
- **Commits by AI Origin** showing the mix of human/assisted/implementation
- **Eval Gate Pass Rate** mostly green with one red day

### Step 3: Identify the patterns

Look at the dashboard and answer these questions:

1. **Which day had the acceptance rate dip?** What happened? (Hint: look at the eval gate results for that day -- a new engineer started using Claude Code without a spec.)

2. **Which engineer has the highest AI contribution ratio?** Is that good or concerning? (It depends on whether their acceptance rate is also high.)

3. **Is lead time improving?** What's driving the improvement? (Hint: compare lead time for AI-originated PRs vs. human-only PRs.)

### Step 4: Query the data directly

You can also query Timestream directly:

```bash
aws timestream-query query --query-string "
  SELECT
    bin(time, 1d) as day,
    ai_origin,
    COUNT(*) as commit_count,
    AVG(CAST(measure_value::bigint AS double)) as avg_lines
  FROM prism_metrics.ai_dora_metrics
  WHERE measure_name = 'commit_count'
    AND time > ago(7d)
  GROUP BY bin(time, 1d), ai_origin
  ORDER BY day
" --output table
```

## Verification

You've completed this exercise when:
- [ ] The data generator ran successfully
- [ ] Dashboard shows populated charts for all 6 panels
- [ ] You can identify the "bad day" in the acceptance rate data
- [ ] You understand what each panel tells you about team health
