<script setup lang="ts">
import type { BlockTreeNode, BpmnModel, ModdleElement } from "@flowduet/core";
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from "element-plus";
import NodeCard from "./NodeCard.vue";
import BlockNodeList from "./BlockNodeList.vue";
import { branchHeadFlowId } from "../operations.js";

/**
 * 递归块树渲染：元素出卡片，块出着色容器（浅靛蓝容器 + 左轨 + 标签，
 * 视觉定稿见 docs/assets/design/iteration-2/dingtalk-editor.png）。
 * #24 块交互：块头带「+ 分支」「删块」；支路多于两支时可删支；
 * 条件块的支路头带默认开关。fork/join 网关自身不出卡片（容器即其呈现）。
 */
const props = defineProps<{
  items: BlockTreeNode[];
  /** exactOptional 下显式传 undefined 是合法形态（未选中节点时） */
  activeId?: string | undefined;
  model: BpmnModel;
  /**
   * 默认态映射（forkId → 默认支路序），由宿主一次算好随递归下传（#24 评审 S8）：
   * 避免每条支路在模板里重复调读函数，也彻底避开渲染期抛错风险。
   */
  defaultIndexByFork: Map<string, number>;
}>();

defineEmits<{
  open: [nodeId: string];
  delete: [nodeId: string];
  insert: [kind: "approval" | "cc", nodeId: string];
  addBranch: [forkId: string];
  removeBranch: [forkId: string, branchIndex: number];
  setDefault: [forkId: string, branchIndex: number | null];
  removeBlock: [forkId: string];
  branchConfig: [flowId: string | undefined];
}>();

function insertable(item: BlockTreeNode): boolean {
  if (item.kind === "block") return false;
  const outgoing = (item.element.get("outgoing") as unknown[]) ?? [];
  return outgoing.length === 1;
}

function branchDisplay(forkId: string, index: number): { name: string; detail: string } {
  const fallback = { name: `支路 ${index + 1}`, detail: "未设置条件" };
  const flowId = branchHeadFlowId(props.model, forkId, index);
  if (flowId === undefined) return fallback;
  try {
    const flow = props.model.elementOf(flowId);
    const name = String(flow.get("name") ?? "").trim() || fallback.name;
    if (props.defaultIndexByFork.get(forkId) === index) {
      return { name, detail: "其他情况（默认）" };
    }
    const condition = flow.get("conditionExpression") as ModdleElement | undefined;
    const detail = String(condition?.get("body") ?? "").trim() || fallback.detail;
    return { name, detail };
  } catch {
    return fallback;
  }
}
</script>

<template>
  <div class="block-node-list">
    <template v-for="item in items" :key="item.kind === 'element' ? item.id : item.forkId">
      <template v-if="item.kind === 'element'">
        <NodeCard
          :node="item"
          :active="item.id === activeId"
          @open="$emit('open', item.id)"
          @delete="$emit('delete', item.id)"
        />
        <div v-if="insertable(item)" class="insert-wrap">
          <ElDropdown
            :data-test="`insert-after-${item.id}`"
            trigger="click"
            @command="(kind: 'approval' | 'cc') => $emit('insert', kind, item.id)"
          >
            <button class="insert-btn" :data-test="`insert-btn-${item.id}`" title="在此后添加节点">
              +
            </button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="approval" data-test="insert-kind-approval"
                  >审批节点</ElDropdownItem
                >
                <ElDropdownItem command="cc" data-test="insert-kind-cc">抄送节点</ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </template>
      <div v-else class="branch-block" :data-gateway="item.gateway" data-test="branch-block">
        <div class="branch-block-head">
          <span class="branch-block-label">
            {{ item.gateway === "parallel" ? "并行分支" : "条件分支" }}
          </span>
          <button
            v-for="(branch, i) in item.gateway === 'exclusive' ? item.branches : []"
            :key="`d${i}`"
            class="default-toggle"
            :class="{ 'default-toggle--on': defaultIndexByFork.get(item.forkId) === i }"
            :data-test="`default-toggle-${item.forkId}-${i}`"
            :title="
              defaultIndexByFork.get(item.forkId) === i
                ? '点击取消默认（其余情况无兜底支路）'
                : '把该支路设为默认（其余情况走此支路）'
            "
            @click="
              $emit('setDefault', item.forkId, defaultIndexByFork.get(item.forkId) === i ? null : i)
            "
          >
            默认{{ i + 1 }}
          </button>
          <span class="branch-block-spacer" />
          <button
            class="add-branch-btn"
            :data-test="`add-branch-${item.forkId}`"
            title="添加分支"
            @click="$emit('addBranch', item.forkId)"
          >
            + 分支
          </button>
          <button
            class="block-btn"
            :data-test="`block-delete-${item.forkId}`"
            title="删除整块（前后直连）"
            @click="$emit('removeBlock', item.forkId)"
          >
            删块
          </button>
        </div>
        <div class="branch-block-branches">
          <div v-for="(branch, i) in item.branches" :key="i" class="branch-block-branch">
            <!-- 引入线（#51）：块顶 → 支路，末端向下箭头指向卡片（对照钉钉官方分叉语义） -->
            <span
              class="branch-line branch-line--in"
              :data-test="`branch-line-in-${item.forkId}-${i}`"
            />
            <div class="branch-head">
              <button
                v-if="item.gateway === 'exclusive'"
                class="branch-tag branch-tag--btn"
                :data-test="`branch-head-${item.forkId}-${i}`"
                :title="`${branchDisplay(item.forkId, i).name}：${branchDisplay(item.forkId, i).detail}；点击配置此分支`"
                @click="$emit('branchConfig', branchHeadFlowId(model, item.forkId, i))"
              >
                <span class="branch-tag-name">{{ branchDisplay(item.forkId, i).name }}</span>
                <span class="branch-tag-detail">{{ branchDisplay(item.forkId, i).detail }}</span>
              </button>
              <span v-else class="branch-tag">支路 {{ i + 1 }}</span>
              <button
                v-if="item.branches.length > 2"
                class="branch-remove"
                :data-test="`remove-branch-${item.forkId}-${i}`"
                title="删除此支路"
                @click="$emit('removeBranch', item.forkId, i)"
              >
                ×
              </button>
            </div>
            <BlockNodeList
              :items="branch"
              :active-id="activeId"
              :model="model"
              :default-index-by-fork="defaultIndexByFork"
              @open="$emit('open', $event)"
              @delete="$emit('delete', $event)"
              @insert="(kind: 'approval' | 'cc', nid: string) => $emit('insert', kind, nid)"
              @add-branch="$emit('addBranch', $event)"
              @remove-branch="(fid, idx) => $emit('removeBranch', fid, idx)"
              @set-default="(fid, idx) => $emit('setDefault', fid, idx)"
              @remove-block="$emit('removeBlock', $event)"
              @branch-config="$emit('branchConfig', $event)"
            />
            <!-- 引出线（#51）：卡片 → 块底，与引入线同轴收拢 -->
            <span
              class="branch-line branch-line--out"
              :data-test="`branch-line-out-${item.forkId}-${i}`"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 各列横段在相邻列的间隙中相接；首尾列只画中心以内的半段。 */
.branch-line {
  display: block;
  width: calc(100% + 12px);
  margin-left: -6px;
  position: relative;
}

.branch-line--in {
  height: 32px;
  background: linear-gradient(#8c9bb5, #8c9bb5) center bottom / 1px 32px no-repeat;
}

.branch-line--in::before,
.branch-line--out::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #8c9bb5;
}

.branch-line--in::before {
  top: 0;
}

.branch-line--out::before {
  bottom: 0;
}

.branch-block-branch:first-child > .branch-line::before {
  left: 50%;
}

.branch-block-branch:last-child > .branch-line::before {
  right: 50%;
}

.branch-line--in::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  border: 3.5px solid transparent;
  border-top: 5px solid #8c9bb5;
}

/* 较短支路的引出线填满剩余高度，让嵌套分支与相邻支路在同一高度汇合。 */
.branch-line--out {
  flex: 1;
  min-height: 24px;
  background: linear-gradient(#8c9bb5, #8c9bb5) center / 1px 100% no-repeat;
}

/* ElDropdown 根是 inline-flex 收缩盒，需包裹层撑满居中（#27 用户反馈） */
.insert-wrap {
  display: flex;
  justify-content: center;
}

/* 卡间连接：短竖线串起「+」按钮（视觉定稿的 connector line 形态） */
.insert-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 4px auto;
  border-radius: 50%;
  border: 1px dashed #2d3e97;
  background: #fff;
  color: #2d3e97;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.insert-btn::before,
.insert-btn::after {
  content: "";
  position: absolute;
  left: 50%;
  width: 1px;
  height: 5px;
  background: #8c9bb5;
}

.insert-btn::before {
  top: -5px;
}

.insert-btn::after {
  bottom: -5px;
}

.insert-btn:hover {
  background: #2d3e97;
  color: #fff;
}

.branch-block {
  --branch-label-space: 24px;
  position: relative;
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(45, 62, 151, 0.06);
}

.branch-block::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: #2d3e97;
}

.branch-block-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--branch-label-space);
  flex-wrap: wrap;
}

/* 块头高度可随按钮换行变化，引入线仍从上个节点贯通到分叉横线。 */
.branch-block-head::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -18px;
  bottom: calc(-1 * var(--branch-label-space));
  width: 1px;
  background: #8c9bb5;
  pointer-events: none;
}

.branch-block-label {
  font-size: 12px;
  color: #2d3e97;
  font-weight: 600;
}

.branch-block-spacer {
  flex: 1;
}

.default-toggle,
.block-btn,
.add-branch-btn {
  border: none;
  border-radius: 4px;
  background: rgba(45, 62, 151, 0.1);
  color: #2d3e97;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}

.default-toggle--on {
  background: #2d3e97;
  color: #fff;
}

.default-toggle:hover,
.block-btn:hover,
.add-branch-btn:hover {
  background: rgba(45, 62, 151, 0.2);
}

.default-toggle--on:hover {
  background: #3d4fae;
}

.block-btn {
  color: #b4884d;
  background: rgba(180, 136, 77, 0.12);
}

.branch-block-branches {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.branch-block-branches::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  width: 1px;
  height: 18px;
  background: #8c9bb5;
  pointer-events: none;
}

.branch-block-branches::before {
  content: "";
  position: absolute;
  top: calc(100% + 13px);
  left: calc(50% - 3px);
  border: 3px solid transparent;
  border-top: 5px solid #8c9bb5;
  pointer-events: none;
}

.branch-block-branch {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.branch-head {
  /* 标签在横线之上、对准本支路中心，不遮挡箭头与竖线。 */
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  z-index: 1;
}

/* 条件标签保留两行，位于分叉横线之上。 */
.branch-block[data-gateway="exclusive"] {
  --branch-label-space: 42px;
}

.branch-block[data-gateway="exclusive"]
  > .branch-block-branches
  > .branch-block-branch
  > .branch-head {
  top: -38px;
  width: calc(100% - 8px);
  justify-content: center;
}

.branch-block[data-gateway="exclusive"] .branch-tag--btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  max-width: calc(100% - 18px);
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  line-height: 1.3;
}

.branch-tag-name,
.branch-tag-detail {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branch-tag-name {
  font-weight: 600;
}

.branch-tag-detail {
  color: #5e6f91;
}

.branch-tag {
  font-size: 11px;
  color: #909399;
}

.branch-tag--btn {
  border: none;
  background: none;
  padding: 0 2px;
  cursor: pointer;
  color: #2d3e97;
}

.branch-tag--btn:hover {
  text-decoration: underline;
}

.branch-remove {
  border: none;
  background: none;
  color: #c45656;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
</style>
