#!/usr/bin/env bash
# [PROTOTYPE] 命名空间判据实验:
#   g = bpmn 后缀 NS + flowable:assignee 字面量(判 assignee 属性复活?)
#   h = bpmn 后缀 NS + flowable:collection 属性 + elementVariable 属性(判属性形态全面复活?)
set -uo pipefail
PORT=18087
P_API="http://localhost:$PORT/flowable-ui/process-api"
R_API="http://localhost:$PORT/flowable-ui/process-api/runtime"
AUTH="admin:test"
CONTAINER="flowduet-probe-ns-$(date +%s)"
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "$PORT:8080" flowable/flowable-ui:6.8.0 >/dev/null
i=0
until curl -sf -u "$AUTH" "$P_API/management/engine" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 240 ]; then echo "✗ 引擎未就绪" >&2; exit 1; fi
  sleep 1
done
echo "✓ 引擎就绪(${i}s)"

DIR="$(cd "$(dirname "$0")/out" && pwd)"
echo "▶ 当前全部流程定义:"
curl -sf -u "$AUTH" "$P_API/repository/process-definitions?size=50" | python3 -c "
import json, sys
for d in json.load(sys.stdin)['data']:
    print('  ', d['key'], d.get('version'))
"

for F in manual-g manual-h; do
  RESP="$(mktemp)"
  CODE=$(curl -s -o "$RESP" -w "%{http_code}" -u "$AUTH" \
    -F "file=@$DIR/$F.bpmn20.xml;filename=$F.bpmn20.xml" "$P_API/repository/deployments")
  echo "[$F] 部署 HTTP $CODE"
  if [ "$CODE" != "201" ] && [ "$CODE" != "200" ]; then
    python3 -c "import json,sys; print('   ', json.load(open(sys.argv[1]))['message'][:220])" "$RESP"
    rm -f "$RESP"
    continue
  fi
  rm -f "$RESP"
  KEY=$([ "$F" = manual-g ] && echo manual_f || echo manual_a)
  START="$(mktemp)"
  if [ "$F" = "manual-h" ]; then
    BODY='{"processDefinitionKey":"manual_a","variables":[{"name":"approvers","type":"json","value":["刘备","关羽","张飞"]}]}'
  else
    BODY='{"processDefinitionKey":"manual_f"}'
  fi
  SCODE=$(curl -s -o "$START" -w "%{http_code}" -u "$AUTH" -H "Content-Type: application/json" -d "$BODY" "$R_API/process-instances")
  if [ "$SCODE" != "201" ]; then
    echo "  启动 HTTP $SCODE"; cat "$START"; echo; rm -f "$START"; continue
  fi
  PID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$START")
  rm -f "$START"
  curl -sf -u "$AUTH" "$R_API/tasks?processInstanceId=$PID&size=50" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
print(f'  任务数={len(tasks)}')
for t in tasks:
    print(f\"    assignee={t.get('assignee')!r}\")
"
done
