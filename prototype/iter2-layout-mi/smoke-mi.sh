#!/usr/bin/env bash
# [PROTOTYPE] 多实例三档 + 竖排场景的 Flowable 6.8 部署冒烟(throwaway)。
# 改编自 scripts/smoke-deploy.sh:一次部署 out/ 下全部 4 份 XML,
# 断言每个流程定义(process id)都注册成功。
# 用法: bash prototype/iter2-layout-mi/smoke-mi.sh
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker daemon 未运行" >&2
  exit 1
fi

SMOKE_IMAGE="${SMOKE_IMAGE:-flowable/flowable-ui:6.8.0}"
SMOKE_PORT="${SMOKE_PORT:-18081}"
SMOKE_USER="admin"
SMOKE_PASS="test"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-240}"

DIR="$(cd "$(dirname "$0")" && pwd)"
API_PATH="/flowable-ui/process-api"
API="http://localhost:$SMOKE_PORT$API_PATH/repository/deployments"

CONTAINER="flowduet-proto-smoke-$(date +%s)"
cleanup() {
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▶ 启动 $SMOKE_IMAGE ..."
docker run -d --rm --name "$CONTAINER" -p "$SMOKE_PORT:8080" "$SMOKE_IMAGE" >/dev/null

echo "▶ 等待引擎就绪(最长 ${SMOKE_TIMEOUT}s)..."
ENGINE_API="http://localhost:$SMOKE_PORT$API_PATH/management/engine"
ready=0
i=0
while [ "$i" -lt "$SMOKE_TIMEOUT" ]; do
  i=$((i + 1))
  if curl -sf -u "$SMOKE_USER:$SMOKE_PASS" "$ENGINE_API" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "✗ 引擎 ${SMOKE_TIMEOUT}s 内未就绪;排查:docker logs $CONTAINER" >&2
  exit 1
fi
echo "✓ 引擎就绪(${i}s)"

# 流程 id → 部署文件(逐个部署,失败即停,错误体打印)
declare -a CASES=(
  "mi_all:mi-all.xml"
  "mi_any:mi-any.xml"
  "mi_sequential:mi-sequential.xml"
  "vertical_scenario:vertical-scenario.xml"
)

for entry in "${CASES[@]}"; do
  KEY="${entry%%:*}"
  FILE="${entry#*:}"
  PATH_XML="$DIR/out/$FILE"
  if [ ! -f "$PATH_XML" ]; then
    echo "✗ 缺产物 $PATH_XML(先跑 pnpm -C prototype/iter2-layout-mi play)" >&2
    exit 1
  fi
  RESP_FILE="$(mktemp)"
  HTTP_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
    -F "file=@$PATH_XML;filename=$KEY.bpmn20.xml" "$API") || true
  if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
    echo "✗ [$KEY] 部署失败 HTTP $HTTP_CODE:" >&2
    cat "$RESP_FILE" >&2
    rm -f "$RESP_FILE"
    exit 1
  fi
  rm -f "$RESP_FILE"
  echo "  ✓ [$KEY] 部署接受($FILE)"

  DEFS=$(curl -sf -u "$SMOKE_USER:$SMOKE_PASS" "$API/../process-definitions?size=100")
  COUNT=$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])['data']
print(sum(1 for d in data if d.get('key') == '$KEY'))
" "$DEFS")
  if [ "$COUNT" -lt 1 ]; then
    echo "✗ [$KEY] 流程定义未注册" >&2
    exit 1
  fi
  echo "  ✓ [$KEY] 流程定义已注册"
done

echo "✅ 冒烟通过:三档多实例 + 竖排场景共 4 份产物被 Flowable 6.8 真实部署并注册"
