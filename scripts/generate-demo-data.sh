#!/usr/bin/env bash
# Fast sample data generator — batches events for speed.
# Usage: ./scripts/generate-demo-data.sh

set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
BUS="prism-d1-metrics"
TEAM="demo-team"
REPO="prism-d1-sample-app"
NS="PRISM/D1/Velocity"

echo "=== Fast Demo Data Generator ==="
echo "Region: $REGION | Bus: $BUS | Team: $TEAM"
echo ""

# Build batch entries (EventBridge accepts up to 10 per call)
BATCH="[]"
COUNT=0
TOTAL=0

flush() {
  if [ "$COUNT" -gt 0 ]; then
    aws events put-events --region "$REGION" --entries "$BATCH" > /dev/null 2>&1
    TOTAL=$((TOTAL + COUNT))
    BATCH="[]"
    COUNT=0
  fi
}

add_event() {
  local DT="$1"
  local DETAIL="$2"
  BATCH=$(echo "$BATCH" | jq --arg src "prism.d1.velocity" --arg dt "$DT" --arg bus "$BUS" --arg detail "$DETAIL" \
    '. + [{"Source":$src,"DetailType":$dt,"EventBusName":$bus,"Detail":$detail}]')
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge 10 ]; then
    flush
    printf "."
  fi
}

ORIGINS=("human" "ai-assisted" "ai-generated" "ai-assisted" "ai-assisted")
TOOLS=("n/a" "claude-code" "claude-code" "kiro" "claude-code")

for DAY in $(seq 7 -1 0); do
  if [[ "$OSTYPE" == "darwin"* ]]; then
    DATE=$(date -v-"${DAY}d" +%Y-%m-%d)
  else
    DATE=$(date -d "$DAY days ago" +%Y-%m-%d)
  fi

  # 8-15 commits per day
  COMMITS=$((RANDOM % 8 + 8))

  for i in $(seq 1 $COMMITS); do
    IDX=$((RANDOM % 5))
    ORIGIN="${ORIGINS[$IDX]}"
    TOOL="${TOOLS[$IDX]}"
    H=$((RANDOM % 10 + 8))
    M=$((RANDOM % 60))
    TS="${DATE}T$(printf '%02d' $H):$(printf '%02d' $M):00Z"
    LINES=$((RANDOM % 120 + 10))

    DETAIL=$(jq -nc \
      --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" \
      --arg o "$ORIGIN" --arg tl "$TOOL" --argjson l "$LINES" \
      '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,
        metric:{name:"commit",value:1,unit:"count"},
        ai_context:{tool:$tl,model:"us.anthropic.claude-haiku-4-5-20251001-v1:0",origin:$o},
        ai_dora:{ai_to_merge_ratio:(if $o!="human" then 1 else 0 end)}}')
    add_event "prism.d1.commit" "$DETAIL"
  done

  # 2-4 PRs per day
  PRS=$((RANDOM % 3 + 2))
  for i in $(seq 1 $PRS); do
    TC=$((RANDOM % 5 + 2))
    AC=$((RANDOM % (TC + 1)))
    RATIO=$(echo "scale=4; $AC / $TC" | bc -l | sed 's/^\./0./')
    LT=$((3600 * (DAY + 1) + RANDOM % 3600))
    LTH=$(echo "scale=2; $LT / 3600" | bc -l | sed 's/^\./0./')
    TS="${DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):30:00Z"
    PR=$((100 + DAY * 10 + i))

    DETAIL=$(jq -nc \
      --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" \
      --argjson ratio "$RATIO" --argjson tc "$TC" --argjson ac "$AC" \
      --argjson lt "$LT" --argjson lth "$LTH" --argjson pr "$PR" \
      '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,
        metric:{name:"ai_to_merge_ratio",value:$ratio,unit:"ratio"},
        ai_context:{tool:"github-actions",model:"n/a",origin:(if $ac>0 then "ai-assisted" else "human" end)},
        dora:{deployment_frequency:1,lead_time_seconds:$lt},
        ai_dora:{ai_to_merge_ratio:$ratio,total_commits:$tc,ai_commits:$ac},
        pr:{number:$pr,author:"engineer"}}')
    add_event "prism.d1.pr" "$DETAIL"

    # Deploy event
    DDTL=$(jq -nc \
      --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson lth "$LTH" \
      '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,
        metric:{name:"deployment",value:1,unit:"count"},
        dora:{deployment_frequency:1}}')
    add_event "prism.d1.deploy" "$DDTL"
  done

  # Eval results
  for i in $(seq 1 $PRS); do
    SCORE="0.88"
    RES="PASS"
    if [ "$DAY" -eq 4 ] && [ $((RANDOM % 2)) -eq 0 ]; then SCORE="0.62"; RES="FAIL"; fi
    if [ $((RANDOM % 8)) -eq 0 ]; then SCORE="0.71"; RES="FAIL"; fi
    TS="${DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):45:00Z"

    DETAIL=$(jq -nc \
      --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" \
      --argjson s "$SCORE" --arg res "$RES" --argjson pr "$((100 + DAY * 10 + i))" \
      '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,
        metric:{name:"eval_score",value:$s,unit:"score"},
        ai_context:{tool:"bedrock-eval",model:"us.anthropic.claude-haiku-4-5-20251001-v1:0",origin:"ai-generated"},
        ai_dora:{eval_gate_pass_rate:(if $res=="PASS" then 1 else 0 end)},
        eval:{result:$res,pr_number:$pr}}')
    add_event "prism.d1.eval" "$DETAIL"
  done

  # --- Weekly assessment (all remaining metrics) ---
  TS="${DATE}T09:00:00Z"
  CFR=$(echo "scale=4; ($((RANDOM % 8)) + 1) / 100" | bc -l | sed 's/^\./0./')
  MTTR_S=$((RANDOM % 3600 + 600))
  ACCEPT=$(echo "scale=4; ($((RANDOM % 20)) + 70) / 100" | bc -l | sed 's/^\./0./')
  COVERAGE=$(echo "scale=4; ($((RANDOM % 25)) + 10) / 100" | bc -l | sed 's/^\./0./')
  SPEC_H=$(echo "scale=2; ($((RANDOM % 30)) + 10) / 10" | bc -l | sed 's/^\./0./')
  DEFECT=$(echo "scale=4; ($((RANDOM % 5)) + 1) / 100" | bc -l | sed 's/^\./0./')

  # Change Failure Rate
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$CFR" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"change_failure_rate",value:$v,unit:"percent"},dora:{change_failure_rate:$v}}')
  add_event "prism.d1.assessment" "$D"

  # MTTR
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$MTTR_S" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"mttr",value:$v,unit:"seconds"},dora:{mttr_seconds:$v}}')
  add_event "prism.d1.assessment" "$D"

  # AI Acceptance Rate
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$ACCEPT" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"ai_acceptance_rate",value:$v,unit:"percent"},ai_dora:{ai_acceptance_rate:$v}}')
  add_event "prism.d1.assessment" "$D"

  # AI Test Coverage Delta
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$COVERAGE" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"ai_test_coverage_delta",value:$v,unit:"percent"},ai_dora:{ai_test_coverage_delta:$v}}')
  add_event "prism.d1.assessment" "$D"

  # Spec-to-Code Hours
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$SPEC_H" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"spec_to_code_hours",value:$v,unit:"count"},ai_dora:{spec_to_code_hours:$v}}')
  add_event "prism.d1.assessment" "$D"

  # Post-Merge Defect Rate
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$DEFECT" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"post_merge_defect_rate",value:$v,unit:"percent"},ai_dora:{post_merge_defect_rate:$v}}')
  add_event "prism.d1.assessment" "$D"

  # PRISM Level (trending up over the week)
  LEVEL=$(echo "scale=1; 1.5 + (7 - $DAY) * 0.2" | bc -l | sed 's/^\./0./')
  D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$TS" --argjson v "$LEVEL" \
    '{team_id:$t,repo:$r,timestamp:$ts,prism_level:2,metric:{name:"PRISMLevel",value:$v,unit:"none"}}')
  add_event "prism.d1.assessment" "$D"

  # Agent invocations
  AGENT_COUNT=$((RANDOM % 8 + 3))
  for a in $(seq 1 $AGENT_COUNT); do
    STEPS=$((RANDOM % 8 + 2))
    DUR=$((RANDOM % 5000 + 1000))
    TOKENS=$((RANDOM % 8000 + 2000))
    STATUS="success"
    if [ $((RANDOM % 6)) -eq 0 ]; then STATUS="failure"; fi
    ATS="${DATE}T$(printf '%02d' $((RANDOM % 10 + 8))):$(printf '%02d' $((RANDOM % 60))):00Z"

    D=$(jq -nc --arg t "$TEAM" --arg r "$REPO" --arg ts "$ATS" \
      --argjson steps "$STEPS" --argjson dur "$DUR" --argjson tok "$TOKENS" --arg st "$STATUS" \
      '{team_id:$t,repo:$r,timestamp:$ts,prism_level:3,
        metric:{name:"agent_invocation",value:1,unit:"count"},
        ai_context:{tool:"strands-agent",model:"us.anthropic.claude-haiku-4-5-20251001-v1:0",origin:"ai-generated"},
        agent:{agent_name:"task-assistant",steps_taken:$steps,tools_invoked:($steps - 1),
          duration_ms:$dur,tokens_used:$tok,status:$st,guardrails_triggered:0}}')
    add_event "prism.d1.agent" "$D"
  done
done

flush
echo ""
echo ""
echo "=== Done! $TOTAL events emitted ==="
echo "Open CloudWatch → Dashboards → PRISM-D1-Team-Velocity (us-west-2)"
echo "Set time range to 'Last 1 week'"
