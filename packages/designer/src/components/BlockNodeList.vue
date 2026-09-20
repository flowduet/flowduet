<script setup lang="ts">
import type { BlockTreeNode } from "@flowduet/core";
import NodeCard from "./NodeCard.vue";
import BlockNodeList from "./BlockNodeList.vue";

/**
 * 递归块树渲染：元素出卡片，块出着色容器（浅靛蓝容器 + 左轨 + 标签，
 * 视觉定稿见 docs/assets/design/iteration-2/dingtalk-editor.png）。
 * 卡间「+」按钮只在链元素（单出边）后出现——网关等多出边元素的
 * 分支内插入属 #24。块内分支交互（加支路/折叠）同属 #24。
 */
defineProps<{
  items: BlockTreeNode[];
  /** exactOptional 下显式传 undefined 是合法形态（未选中节点时） */
  activeId?: string | undefined;
}>();

defineEmits<{
  open: [nodeId: string];
  delete: [nodeId: string];
  insert: [nodeId: string];
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
        <button
          v-if="insertable(item)"
          class="insert-btn"
          :data-test="`insert-after-${item.id}`"
          title="在此后添加审批节点"
          @click="$emit('insert', item.id)"
        >
          +
        </button>
      </template>
      <div v-else class="branch-block" :data-gateway="item.gateway" data-test="branch-block">
        <div class="branch-block-label">
          {{ item.gateway === "parallel" ? "并行分支" : "条件分支" }}
        </div>
        <div class="branch-block-branches">
          <div v-for="(branch, i) in item.branches" :key="i" class="branch-block-branch">
            <BlockNodeList
              :items="branch"
              :active-id="activeId"
              @open="$emit('open', $event)"
              @delete="$emit('delete', $event)"
              @insert="$emit('insert', $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.insert-btn {
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

.branch-block-label {
  font-size: 12px;
  color: #2d3e97;
  margin-bottom: 6px;
}

.branch-block-branches {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.branch-block-branch {
  flex: 1;
  min-width: 0;
}
</style>
