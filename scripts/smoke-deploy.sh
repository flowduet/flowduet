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
FIXTURE_DIR="$REPO_ROOT/packages/core/src/compile/__fixtures__"
BASELINE="$FIXTURE_DIR/minimal-flow.flowable68.baseline.xml"
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
RUNTIME_API="http://localhost:$SMOKE_PORT$API_PATH/runtime"

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

# ── 通用断言件（部署注册 / 启动实例 / 任务查询）──

# 部署一份 XML 并断言流程定义完成注册（比部署本身更强的证据：引擎完成了解析校验）
deploy_and_check() { # $1=文件路径 $2=上传文件名（须以 .bpmn20.xml 结尾） $3=期望流程定义 key
  local file="$1" upload_name="$2" defkey="$3" resp code defs count
  resp="$(mktemp)"
  # 引擎要求上传文件名以 .bpmn20.xml/.bpmn/.bar/.zip 结尾
  code=$(curl -s -o "$resp" -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
    -F "file=@${file};filename=${upload_name}" \
    "$API")
  if [ "$code" != "201" ] && [ "$code" != "200" ]; then
    echo "✗ ${upload_name} 部署失败 HTTP ${code}：" >&2
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
" "$defs" "$defkey")
  if [ "$count" -lt 1 ]; then
    echo "✗ 部署已登记但流程定义 ${defkey} 未注册" >&2
    exit 1
  fi
  echo "✓ ${defkey} 部署并注册"
}

# 启动实例并输出实例 id；$2 是 variables 的 JSON 数组字面量
start_instance() { # $1=流程定义 key $2=variables JSON 数组
  local start_file start_code
  start_file="$(mktemp)"
  start_code=$(curl -s -o "$start_file" -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
    -H "Content-Type: application/json" \
    -d "{\"processDefinitionKey\":\"$1\",\"variables\":$2}" \
    "$RUNTIME_API/process-instances")
  if [ "$start_code" != "201" ]; then
    echo "✗ 实例启动失败 HTTP ${start_code}（$1）:" >&2
    cat "$start_file" >&2
    rm -f "$start_file"
    exit 1
  fi
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$start_file"
  rm -f "$start_file"
}

# 查询实例的活动任务（JSON），供后续 python 断言消费
query_tasks() { # $1=实例 id
  curl -sf -u "$SMOKE_USER:$SMOKE_PASS" "$RUNTIME_API/tasks?processInstanceId=$1&size=50"
}

# ── 基准主流程（单人审批）──

echo "▶ 部署基准 XML ..."
deploy_and_check "$BASELINE" "leave-approval.bpmn20.xml" "leave_approval"

# 运行时断言：启动实例并核对 assignee——flowable: 属性只有真实执行才被验证。
# 教训：命名空间 URI 写错时部署注册照常通过，assignee 静默为空（2026-09-20 原型实锤）。
echo "▶ 运行时断言:启动实例(manager=王经理)并核对 assignee ..."
PID="$(start_instance leave_approval '[{"name":"manager","type":"string","value":"王经理"}]')"
# curl 失败时管道会把空输入喂给 python，报 JSON 解析错而掩盖真实原因——先落变量再判
TASKS_JSON="$(query_tasks "$PID")" || {
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

# ── 多实例审批三档（issue #19）：三份基准部署 + 三档运行时断言 ──
# 会签：集合展开为并行实例（3 任务逐人）；或签：任一完成即终止其余实例；
# 依次：串行实例同一时刻只有队首审批人。
# ⚠ 已知引擎行为：REST 以 type=json 数组注入集合时，元素变量是 JsonNode
# 字符串元素的 toString()——assignee 会带字面引号（"刘备"）。宿主经 Java
# API 传 Collection<String> 时为裸值；冒烟验证的是「集合展开 + 逐实例
# 解析出互不相同的审批人」这一通道语义，引号是 REST 载荷形态的副作用。
echo "▶ 多实例三档：部署三份基准 ..."
deploy_and_check "$FIXTURE_DIR/mi-all.flowable68.baseline.xml" "mi-all.bpmn20.xml" "mi_all"
deploy_and_check "$FIXTURE_DIR/mi-any.flowable68.baseline.xml" "mi-any.bpmn20.xml" "mi_any"
deploy_and_check "$FIXTURE_DIR/mi-sequential.flowable68.baseline.xml" "mi-sequential.bpmn20.xml" "mi_sequential"

APPROVERS_JSON='[{"name":"approvers","type":"json","value":["刘备","关羽","张飞"]}]'

echo "▶ 运行时断言:会签展开为 3 个逐人任务 ..."
MI_ALL_PID="$(start_instance mi_all "$APPROVERS_JSON")"
if query_tasks "$MI_ALL_PID" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
assignees = sorted(t.get('assignee') or '' for t in tasks)
print(f'  会签任务数 = {len(tasks)}, assignee = {assignees}')
sys.exit(0 if len(tasks) == 3 and assignees == ['\"关羽\"', '\"刘备\"', '\"张飞\"'] else 1)
"; then
  echo "✓ 会签逐人 assignee 通道生效（刘备/关羽/张飞）"
else
  echo "✗ 会签运行时断言失败:集合未按 3 人展开或 assignee 丢失" >&2
  exit 1
fi

echo "▶ 运行时断言:或签——完成任一任务即终止其余实例 ..."
MI_ANY_PID="$(start_instance mi_any "$APPROVERS_JSON")"
ANY_TASK_ID="$(query_tasks "$MI_ANY_PID" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
print(tasks[0]['id'] if tasks else '')
")"
if [ -z "$ANY_TASK_ID" ]; then
  echo "✗ 或签实例未展开任务（集合解析异常）" >&2
  exit 1
fi
COMPLETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$SMOKE_USER:$SMOKE_PASS" \
  -H "Content-Type: application/json" -d '{"action":"complete"}' \
  "$RUNTIME_API/tasks/$ANY_TASK_ID")
if [ "$COMPLETE_CODE" != "200" ]; then
  echo "✗ 或签任务完成操作失败 HTTP ${COMPLETE_CODE}（task=${ANY_TASK_ID}）" >&2
  exit 1
fi
if query_tasks "$MI_ANY_PID" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
print(f'  或签完成任务后剩余任务数 = {len(tasks)}（期望 0:任一完成即终止其余实例）')
sys.exit(0 if len(tasks) == 0 else 1)
"; then
  echo "✓ 或签完成条件生效（任一同意即通过节点）"
else
  echo "✗ 或签运行时断言失败:完成一个任务后其余实例未被终止" >&2
  exit 1
fi

echo "▶ 运行时断言:依次审批串行——同一时刻仅队首审批人 ..."
MI_SEQ_PID="$(start_instance mi_sequential '[{"name":"chain","type":"json","value":["刘备","关羽","张飞"]}]')"
if query_tasks "$MI_SEQ_PID" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)['data']
assignees = [t.get('assignee') or '' for t in tasks]
print(f'  依次任务数 = {len(tasks)}, assignee = {assignees}')
sys.exit(0 if len(tasks) == 1 and assignees == ['\"刘备\"'] else 1)
"; then
  echo "✓ 依次串行生效（当前仅刘备待办）"
else
  echo "✗ 依次运行时断言失败:串行语义未生效" >&2
  exit 1
fi

# ── 分支结构基准（issue #20）：并行分裂-汇合 + 默认分支排他网关，部署注册 ──
# 运行时语义（并行同时推进/默认分支兜底）属引擎行为，部署注册即本票验收口径
echo "▶ 分支结构基准：部署两份 ..."
deploy_and_check "$FIXTURE_DIR/parallel-flow.flowable68.baseline.xml" "parallel-flow.bpmn20.xml" "parallel_flow"
deploy_and_check "$FIXTURE_DIR/default-branch.flowable68.baseline.xml" "default-branch.bpmn20.xml" "default_branch"

echo "✅ 冒烟通过：FlowDuet 编译产物被 Flowable 6.8 真实部署并解析（容器 $CONTAINER 已停止）"
