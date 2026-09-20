#!/usr/bin/env bash
# [PROTOTYPE] 隔离实验:部署指定 XML,打印引擎响应(用后即弃)。
# 用法: bash deploy-one.sh <xml路径> <processKey>
set -euo pipefail

FILE="$1"
KEY="$2"
SMOKE_PORT="${SMOKE_PORT:-18082}"
USER="admin"
PASS="test"
API="http://localhost:$SMOKE_PORT/flowable-ui/process-api"

CONTAINER="flowduet-probe-$(date +%s)"
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "$SMOKE_PORT:8080" flowable/flowable-ui:6.8.0 >/dev/null

i=0
until curl -sf -u "$USER:$PASS" "$API/management/engine" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 240 ] && { echo "✗ 引擎未就绪" >&2; exit 1; }
  sleep 1
done
echo "✓ 引擎就绪(${i}s)"

HTTP_CODE=$(curl -s -o /tmp/deploy-one-resp.json -w "%{http_code}" -u "$USER:$PASS" \
  -F "file=@$FILE;filename=$(basename "$FILE")" "$API/repository/deployments")
echo "部署 HTTP $HTTP_CODE"
cat /tmp/deploy-one-resp.json
echo
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  DEFS=$(curl -sf -u "$USER:$PASS" "$API/repository/process-definitions?size=100")
  echo "$DEFS" | python3 -c "
import json, sys
data = json.load(sys.stdin)['data']
hit = [d for d in data if d.get('key') == '$KEY']
print('✓ 流程定义注册:' if hit else '✗ 流程定义未注册', [d['key'] for d in hit])
"
fi
