<script setup lang="ts">
import type { BlockTreeNode, BpmnModel } from "@flowduet/core";
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
defineProps<{
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
                title="配置此分支的条件表达式"
                @click="$emit('branchConfig', branchHeadFlowId(model, item.forkId, i))"
              >
                支路 {{ i + 1 }}{{ defaultIndexByFork.get(item.forkId) === i ? " · 默认" : "" }}
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
/* 支路引入/引出连接线（#51）+ 分叉/汇聚横线（用户确认）：
   每列横段覆盖「列宽 + 列间隙」，相邻列重叠拼成整条横线（免测量列中心）；
   引入线末端向下箭头指向支路 */
.branch-line {
  display: block;
  width: calc(100% + 12px);
  height: 24px;
  margin-left: -6px;
  position: relative;
}

/* 引入：顶部分叉横段 + 中轴竖段贯通到卡片顶 + 箭头（线不被标签打断） */
.branch-line--in {
  height: 32px;
  background:
    linear-gradient(#c0c4cc, #c0c4cc) top center / 100% 1px no-repeat,
    linear-gradient(#c0c4cc, #c0c4cc) center bottom / 1px 29px no-repeat;
}

.branch-line--in::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  border: 3.5px solid transparent;
  border-top: 5px solid #c0c4cc;
}

/* 引出：底部汇聚横段 + 中轴竖段 */
.branch-line--out {
  background:
    linear-gradient(#c0c4cc, #c0c4cc) bottom center / 100% 1px no-repeat,
    linear-gradient(#c0c4cc, #c0c4cc) center top / 1px 21px no-repeat;
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
  background: #c0c4cc;
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
  position: relative;
  margin: 8px 0;
  padding: 10px 12px 10px 16px;
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
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
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
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.branch-block-branch {
  position: relative;
  flex: 1;
  min-width: 0;
}

.branch-head {
  /* 标签浮引入线旁右上（用户定稿：线直达卡片顶，#51）；不占流内高度 */
  position: absolute;
  top: 2px;
  right: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 1;
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
