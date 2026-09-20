<script setup lang="ts">
import { computed } from "vue";
import type { BlockTreeNode } from "@flowduet/core";

/** 节点卡片：类型图标 + 名称 + 审批人摘要（点击打开抽屉，悬停出删除） */
const props = defineProps<{
  node: Extract<BlockTreeNode, { kind: "element" }>;
  active: boolean;
}>();

const emit = defineEmits<{
  open: [nodeId: string];
  delete: [nodeId: string];
}>();

/** 事件/任务/网关的最小视觉词汇（卡片层，画布词汇属 #26），单一分派表 */
const TYPE_VOCAB: Record<string, { glyph: string; cls: string; deletable?: boolean }> = {
  "bpmn:StartEvent": { glyph: "起", cls: "node-card--start" },
  "bpmn:EndEvent": { glyph: "终", cls: "node-card--end" },
  "bpmn:ExclusiveGateway": { glyph: "分", cls: "node-card--gateway" },
  "bpmn:ParallelGateway": { glyph: "并", cls: "node-card--gateway" },
};

const vocab = computed(
  () =>
    TYPE_VOCAB[props.node.element.$type] ?? {
      glyph: "审",
      cls: "node-card--task",
      deletable: true,
    },
);

const summary = computed(() => {
  const el = props.node.element;
  if (el.$type === "bpmn:UserTask") {
    return String(el.get("assignee") ?? "未配置审批人");
  }
  if (el.$type === "bpmn:ServiceTask") {
    return `抄送：${String(el.get("ccTo") ?? "")}`;
  }
  const loop = el.get("loopCharacteristics") as { get(key: string): unknown } | undefined;
  if (loop !== undefined) {
    return `多人 · 集合 ${String(loop.get("collection") ?? "")}`;
  }
  return "";
});
</script>

<template>
  <div
    class="node-card"
    :class="[vocab.cls, { 'node-card--active': active }]"
    data-test="node-card"
    @click="emit('open', node.id)"
  >
    <span class="node-card-glyph" data-test="node-glyph">{{ vocab.glyph }}</span>
    <span class="node-card-main">
      <span class="node-card-name">{{ node.element.get("name") ?? node.id }}</span>
      <span v-if="summary" class="node-card-summary">{{ summary }}</span>
    </span>
    <button
      v-if="vocab.deletable"
      class="node-card-delete"
      :data-test="`node-delete-${node.id}`"
      title="删除节点"
      @click.stop="emit('delete', node.id)"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.node-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 280px;
  margin: 0 auto;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  position: relative;
}

.node-card:hover {
  box-shadow: 0 2px 8px rgba(45, 62, 151, 0.18);
}

.node-card--active {
  outline: 2px solid #2d3e97;
}

.node-card--start,
.node-card--end {
  width: 160px;
  justify-content: center;
  padding: 6px 12px;
}

.node-card--gateway {
  width: 200px;
  justify-content: center;
}

.node-card-glyph {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #fff;
  background: #2d3e97;
}

.node-card--start .node-card-glyph {
  background: #4caf50;
}

.node-card--end .node-card-glyph {
  background: #e5484d;
}

.node-card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.node-card-name {
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-card-summary {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-card-delete {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: #e5484d;
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: none;
}

.node-card:hover .node-card-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
