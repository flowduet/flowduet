#!/usr/bin/env bash
# [PROTOTYPE] 部署 g 并抓引擎日志,找"部署 201 但定义未注册"的静默原因
set -uo pipefail
PORT=18088
P_API="http://localhost:$PORT/flowable-ui/process-api"
AUTH="admin:test"
CONTAINER="flowduet-probe-log-$(date +%s)"
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
RESP="$(mktemp)"
CODE=$(curl -s -o "$RESP" -w "%{http_code}" -u "$AUTH" \
  -F "file=@$DIR/manual-g.bpmn20.xml;filename=manual-g.bpmn20.xml" "$P_API/repository/deployments")
echo "部署 manual-g: HTTP $CODE"
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print('deployment id:', d.get('id'))" "$RESP" 2>/dev/null
rm -f "$RESP"
echo "--- 部署后的定义列表 ---"
curl -sf -u "$AUTH" "$P_API/repository/process-definitions?size=50" | python3 -c "
import json, sys
data = json.load(sys.stdin)['data']
print('定义数:', len(data))
for d in data: print('  ', d['key'], 'v', d.get('version'))
"
echo "--- 引擎日志尾部(WARN/ERROR)---"
docker logs "$CONTAINER" 2>&1 | grep -iE 'WARN|ERROR' | grep -viE 'JpaBaseConfiguration|spring' | tail -15
