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

/**
 * 事件/任务/网关的最小视觉词汇（卡片层，画布词汇属 #26），单一分派表。
 * 抄送任务（ServiceTask + ccTo）用专属「抄」字形与中性灰蓝底色，与审批任务（「审」 + 靛蓝）
 * 在钉钉式列表中形成可辨识的类型差异（评审 W-5）；上下文：抄送不阻塞流程推进（CONTEXT.md），
 * 沿用审批任务字形会错标类型语义。
 * 非抄送的 ServiceTask（service/mail）当前无钉钉式列表入口（适配器只开放 user/cc），
 * 若后续引入可再拆一个 ccOnly 判定。
 */
const TYPE_VOCAB: Record<string, { glyph: string; cls: string; deletable?: boolean }> = {
  "bpmn:StartEvent": { glyph: "起", cls: "node-card--start" },
  "bpmn:EndEvent": { glyph: "终", cls: "node-card--end" },
  "bpmn:ExclusiveGateway": { glyph: "分", cls: "node-card--gateway" },
  "bpmn:ParallelGateway": { glyph: "并", cls: "node-card--gateway" },
};

/**
 *  ServiceTask 拆抄送/非抄送：ccTo 存在即抄送（适配器写入的语义标记）。
 *  当前非抄送 ServiceTask 无列表入口，兜底归到“任务”字形（审）。
 */
function resolveVocab(el: { $type: string; get(key: string): unknown }): {
  glyph: string;
  cls: string;
  deletable?: boolean;
} {
  const mapped = TYPE_VOCAB[el.$type];
  if (mapped !== undefined) return mapped;
  if (el.$type === "bpmn:ServiceTask" && el.get("ccTo") !== undefined) {
    return { glyph: "抄", cls: "node-card--cc", deletable: true };
  }
  return { glyph: "审", cls: "node-card--task", deletable: true };
}

const vocab = computed(() => resolveVocab(props.node.element));
const name = computed(() => String(props.node.element.get("name") ?? props.node.id));

const summary = computed(() => {
  const el = props.node.element;
  if (el.$type === "bpmn:UserTask") {
    // 多实例审批优先于单人摘要：addApprovalTask 落的也是 bpmn:UserTask，
    // 若不先判 loopCharacteristics，多人分支永不可达（#25 多人扩展依赖此处）
    const loop = el.get("loopCharacteristics") as { get(key: string): unknown } | undefined;
    if (loop !== undefined) {
      return `多人 · 集合 ${String(loop.get("collection") ?? "")}`;
    }
    const assignee = el.get("assignee");
    return assignee === undefined ? "未配置审批人" : `审批人 ${String(assignee)}`;
  }
  if (el.$type === "bpmn:ServiceTask") {
    return `抄送：${String(el.get("ccTo") ?? "")}`;
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
      <span class="node-card-name" :title="name">{{ name }}</span>
      <span v-if="summary" class="node-card-summary" :title="summary">{{ summary }}</span>
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
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 280px;
  max-width: 100%;
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

/* 抄送卡片专属配色（PR #34 评审 W-5、PR #37 复核 3.1）：中性灰蓝，与审批任务的靛蓝、开始/结束的绿/红拉开声部。
   #26 spec 只定义珊瑚橙 #F76547 强调色、无抄送色系；若 #26 落地时为抄送节点引入配色，
   建议对齐此灰蓝以维持双视图同一语义的颜色回忆（待 #26 落地核验） */
.node-card--cc .node-card-glyph {
  background: #6b7a99;
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
