#!/usr/bin/env bash
# [PROTOTYPE] assignee 通道探针:字面量单任务,验证 flowable:assignee 属性是否被解析。
set -uo pipefail
PORT=18086
P_API="http://localhost:$PORT/flowable-ui/process-api"
R_API="http://localhost:$PORT/flowable-ui/process-api/runtime"
AUTH="admin:test"
CONTAINER="flowduet-probe-asg-$(date +%s)"
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "$PORT:8080" flowable/flowable-ui:6.8.0 >/dev/null
i=0
until curl -sf -u "$AUTH" "$P_API/management/engine" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 240 ]; then echo "✗ 引擎未就绪" >&2; exit 1; fi
  sleep 1
done

DIR="$(cd "$(dirname "$0")/out" && pwd)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$AUTH" \
  -F "file=@$DIR/manual-f.bpmn20.xml;filename=manual-f.bpmn20.xml" "$P_API/repository/deployments")
echo "部署 manual-f: HTTP $CODE"
[ "$CODE" != "201" ] && exit 1

START="$(mktemp)"
START_CODE=$(curl -s -o "$START" -w "%{http_code}" -u "$AUTH" -H "Content-Type: application/json" \
  -d '{"processDefinitionKey":"manual_f"}' "$R_API/process-instances")
echo "启动: HTTP $START_CODE"
[ "$START_CODE" != "201" ] && { cat "$START"; echo; exit 1; }
PID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$START")
rm -f "$START"

echo "任务响应原文:"
curl -sf -u "$AUTH" "$R_API/tasks?processInstanceId=$PID" | python3 -m json.tool
