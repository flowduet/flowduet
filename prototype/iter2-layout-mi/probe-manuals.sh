#!/usr/bin/env bash
# [PROTOTYPE] 多形态对照实验:一个容器依次部署 out/manual-*.bpmn20.xml(用后即弃)。
set -uo pipefail

SMOKE_PORT="${SMOKE_PORT:-18083}"
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
  if [ "$i" -gt 240 ]; then echo "✗ 引擎未就绪" >&2; exit 1; fi
  sleep 1
done
echo "✓ 引擎就绪(${i}s)"
echo

DIR="$(cd "$(dirname "$0")/out" && pwd)"
RESULT=0
for FILE in "$DIR"/manual-*.bpmn20.xml; do
  NAME="$(basename "$FILE")"
  RESP="$(mktemp)"
  HTTP_CODE=$(curl -s -o "$RESP" -w "%{http_code}" -u "$USER:$PASS" \
    -F "file=@$FILE;filename=$NAME" "$API/repository/deployments")
  if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✓ [$NAME] 部署接受"
  else
    echo "✗ [$NAME] HTTP $HTTP_CODE"
    python3 -c "import json;print('   ', json.load(open('$RESP'))['message'][:200])" 2>/dev/null || cat "$RESP"
    RESULT=1
  fi
  rm -f "$RESP"
done
exit $RESULT
