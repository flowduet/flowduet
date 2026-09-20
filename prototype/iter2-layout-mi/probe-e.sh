#!/usr/bin/env bash
# [PROTOTYPE] 验证全标准形态 manual-e(用后即弃)
set -uo pipefail
PORT=18084
API="http://localhost:$PORT/flowable-ui/process-api"
CONTAINER="flowduet-probe-e-$(date +%s)"
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "$PORT:8080" flowable/flowable-ui:6.8.0 >/dev/null
i=0
until curl -sf -u admin:test "$API/management/engine" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 240 ]; then echo "✗ 引擎未就绪" >&2; exit 1; fi
  sleep 1
done
echo "✓ 引擎就绪(${i}s)"

DIR="$(cd "$(dirname "$0")/out" && pwd)"
for F in manual-e manual-a; do
  RESP="$(mktemp)"
  CODE=$(curl -s -o "$RESP" -w "%{http_code}" -u admin:test \
    -F "file=@$DIR/$F.bpmn20.xml;filename=$F.bpmn20.xml" "$API/repository/deployments")
  echo "[$F] HTTP $CODE"
  if [ "$CODE" != "201" ] && [ "$CODE" != "200" ]; then
    python3 -c "import json,sys; print('   ', json.load(open(sys.argv[1]))['message'][:160])" "$RESP"
  fi
  rm -f "$RESP"
done
