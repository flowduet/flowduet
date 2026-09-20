#!/usr/bin/env bash
# FlowDuet 部署冒烟（ROADMAP Step 1 定海神针）：
# 把编译合同的基准 XML 经 Flowable 6.8 REST 真实部署，
# 断言引擎完成解析并注册流程定义——"合法可执行"承诺的物理证明。
#
# 用法: scripts/smoke-deploy.sh
# 可调环境变量:
#   SMOKE_IMAGE    镜像（默认 flowable/flowable-ui:6.8.0）
#   SMOKE_PORT     宿主机端口（默认 18080，避开常见 8080）
#   SMOKE_USER     Basic 认证用户（默认按镜像类型：flowable-ui→admin，flowable-rest→rest-admin）
#   SMOKE_PASS     Basic 认证密码（默认 test）
#                  注意：此为 Flowable 官方 Docker 镜像的公开默认测试凭据，
#                  仅用于本地/CI 冒烟容器，非生产凭据
#   SMOKE_TIMEOUT  就绪等待秒数（默认 180）
#
# 说明：部署对象是编译合同的基准文件，它与 compile() 输出逐字一致
#（由编译合同测试保证）；CI 中本脚本在 pnpm build 之后执行。
set -euo pipefail

# 前置检查：Docker daemon 可用性
if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker daemon 未运行，请先启动 Docker" >&2
  exit 1
fi

SMOKE_IMAGE="${SMOKE_IMAGE:-flowable/flowable-ui:6.8.0}"
SMOKE_PORT="${SMOKE_PORT:-18080}"
SMOKE_PASS="${SMOKE_PASS:-test}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-180}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$REPO_ROOT/packages/core/src/compile/__fixtures__/minimal-flow.flowable68.baseline.xml"
if [ ! -f "$BASELINE" ]; then
  echo "✗ 找不到基准文件：$BASELINE" >&2
  exit 1
fi

# API 基路径与默认账号按镜像类型区分
case "$SMOKE_IMAGE" in
  *flowable-rest*)
    API_PATH="/flowable-rest"
    DEFAULT_USER="rest-admin"
    ;;
  *)
    API_PATH="/flowable-ui/process-api"
    DEFAULT_USER="admin"
    ;;
esac
SMOKE_USER="${SMOKE_USER:-$DEFAULT_USER}"
API="http://localhost:$SMOKE_PORT$API_PATH/repository/deployments"

CONTAINER="flowduet-smoke-$(date +%s)"
cleanup() {
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▶ 启动 $SMOKE_IMAGE ..."
docker run -d --rm --name "$CONTAINER" -p "$SMOKE_PORT:8080" "$SMOKE_IMAGE" >/dev/null

echo "▶ 等待引擎就绪（最长 ${SMOKE_TIMEOUT}s，账号 ${SMOKE_USER}）..."
# 就绪探测轮询引擎信息端点（仅在引擎完全初始化后才返回 200），
# 避免 REST 端点在引擎部分就绪时返回空列表导致假阳性
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
  echo "✗ 引擎 ${SMOKE_TIMEOUT}s 内未就绪；排查：docker logs $CONTAINER" >&2
  exit 1
fi
echo "✓ 引擎就绪（${i}s）"

# 部署一份基准 XML 并断言流程定义注册（注册 = 引擎完成 XSD 解析校验，比部署更强的证据）
# 注意：函数名与签名与 PR #28（feat/19）的通用断言件保持一致，合并时无烟冲突
deploy_and_check() { # $1=基准文件路径或名字 $2=上传文件名（须以 .bpmn20.xml 结尾） $3=期望流程定义 key
  local file resp code defs count
  if [ -f "$1" ]; then file="$1"; else file="$REPO_ROOT/packages/core/src/compile/__fixtures__/$1"; fi
  resp="$(mktemp)"
  code=$(curl -s -o "$resp" -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
    -F "file=@${file};filename=$2" \
    "$API")
  if [ "$code" != "201" ] && [ "$code" != "200" ]; then
    echo "✗ $2 部署失败 HTTP ${code}：" >&2
    cat "$resp" >&2
    rm -f "$resp"
    exit 1
  fi
  rm -f "$resp"
  # local 赋值会吞掉 curl 的非零退出码，必须拆开判断，否则引擎异常时静默退出
  if ! defs="$(curl -sf -u "$SMOKE_USER:$SMOKE_PASS" "$API/../process-definitions?size=100")"; then
    echo "✗ 查询流程定义列表失败（引擎异常？）：$API/../process-definitions" >&2
    exit 1
  fi
  count=$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])['data']
print(sum(1 for d in data if d.get('key') == sys.argv[2]))
" "$defs" "$3")
  if [ "$count" -lt 1 ]; then
    echo "✗ 部署已登记但流程定义 $3 未注册" >&2
    exit 1
  fi
  echo "✓ $3 部署并注册（× ${count}）"
}

echo "▶ 部署基准 XML ..."
deploy_and_check "$BASELINE" "leave-approval.bpmn20.xml" "leave_approval"

# 运行时断言：启动实例并核对 assignee——flowable: 属性只有真实执行才被验证。
# 教训：命名空间 URI 写错时部署注册照常通过，assignee 静默为空（2026-09-20 原型实锤）。
RUNTIME_API="http://localhost:$SMOKE_PORT$API_PATH/runtime"
echo "▶ 运行时断言:启动实例(manager=王经理)并核对 assignee ..."
START_FILE="$(mktemp)"
START_CODE=$(curl -s -o "$START_FILE" -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
  -H "Content-Type: application/json" \
  -d '{"processDefinitionKey":"leave_approval","variables":[{"name":"manager","type":"string","value":"王经理"}]}' \
  "$RUNTIME_API/process-instances")
if [ "$START_CODE" != "201" ]; then
  echo "✗ 实例启动失败 HTTP $START_CODE:" >&2
  cat "$START_FILE" >&2
  rm -f "$START_FILE"
  exit 1
fi
PID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$START_FILE")
rm -f "$START_FILE"
# curl 失败时管道会把空输入喂给 python，报 JSON 解析错而掩盖真实原因——先落变量再判
TASKS_JSON="$(curl -sf -u "$SMOKE_USER:$SMOKE_PASS" "$RUNTIME_API/tasks?processInstanceId=$PID")" || {
  echo "✗ 查询任务列表失败（引擎异常？）：$RUNTIME_API/tasks?processInstanceId=$PID" >&2
  exit 1
}
if printf '%s' "$TASKS_JSON" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
ok = len(tasks) == 1 and tasks[0].get('assignee') == '王经理'
print(f\"  任务 {tasks[0]['name'] if tasks else '-'} assignee={tasks[0].get('assignee') if tasks else '-'}\")
sys.exit(0 if ok else 1)
"; then
  echo "✓ assignee 通道生效(王经理)"
else
  echo "✗ 运行时断言失败:flowable:assignee 未生效(命名空间/属性通道异常)" >&2
  exit 1
fi

# ── 分支结构基准（issue #20）：并行分裂-汇合 + 默认分支排他网关，部署注册 ──
# 运行时语义（并行同时推进/默认分支兜底）属引擎行为，部署注册即本票验收口径
echo "▶ 分支结构基准：部署两份 ..."
deploy_and_check "parallel-flow.flowable68.baseline.xml" "parallel-flow.bpmn20.xml" "parallel_flow"
deploy_and_check "default-branch.flowable68.baseline.xml" "default-branch.bpmn20.xml" "default_branch"

echo "✅ 冒烟通过：FlowDuet 编译产物被 Flowable 6.8 真实部署并解析（容器 $CONTAINER 已停止）"
