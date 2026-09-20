#!/usr/bin/env bash
# [PROTOTYPE] 运行时探针:部署 manual-c(flowable:collection 子元素 + inputDataItem@name),
# 启动实例注入审批人集合,数任务、看 assignee——验证 collection 与 elementVariable
# 是否真的被引擎解析(部署校验测不出这两个)。用后即弃。
set -uo pipefail
PORT=18085
API="http://localhost:$PORT/flowable-ui/process-api"
R_API="http://localhost:$PORT/flowable-ui/process-api/runtime"
AUTH="admin:test"
CONTAINER="flowduet-probe-rt-$(date +%s)"
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "$PORT:8080" flowable/flowable-ui:6.8.0 >/dev/null
i=0
until curl -sf -u "$AUTH" "$API/management/engine" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 240 ]; then echo "✗ 引擎未就绪" >&2; exit 1; fi
  sleep 1
done
echo "✓ 引擎就绪(${i}s)"

DIR="$(cd "$(dirname "$0")/out" && pwd)"
RESP="$(mktemp)"
CODE=$(curl -s -o "$RESP" -w "%{http_code}" -u "$AUTH" \
  -F "file=@$DIR/manual-c.bpmn20.xml;filename=manual-c.bpmn20.xml" "$API/repository/deployments")
echo "部署 manual-c: HTTP $CODE"
if [ "$CODE" != "201" ] && [ "$CODE" != "200" ]; then
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['message'][:200])" "$RESP"
  exit 1
fi
rm -f "$RESP"

echo "▶ 启动实例(approvers=[刘备,关羽,张飞])..."
START="$(mktemp)"
START_CODE=$(curl -s -o "$START" -w "%{http_code}" -u "$AUTH" -H "Content-Type: application/json" \
  -d '{"processDefinitionKey":"manual_c","variables":[{"name":"approvers","type":"json","value":["刘备","关羽","张飞"]}]}' \
  "$R_API/process-instances")
echo "启动: HTTP $START_CODE"
if [ "$START_CODE" != "201" ]; then
  cat "$START"; echo; exit 1
fi
PID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$START")
rm -f "$START"
echo "  实例 id=$PID"

echo "▶ 查询活动任务..."
curl -sf -u "$AUTH" "$R_API/tasks?processInstanceId=$PID&size=50" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tasks = data['data']
print(f'  任务数 = {len(tasks)}(期望 3:集合被多实例展开)')
for t in tasks:
    print(f\"    task={t['name']!r} assignee={t.get('assignee')!r}\")
"
