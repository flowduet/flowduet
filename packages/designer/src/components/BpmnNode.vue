<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { ModdleElement } from "@flowduet/core";

/**
 * BPMN 节点视觉词汇（#26 视觉修复：SVG 标准词汇 + 现代化呈现）。
 * 定稿口径：经典 BPMN 词汇（bpmn.io 式）为骨，圆角描边/柔和阴影/
 * 珊瑚橙声部（多实例标记、抄送）为现代化点缀；不卡片化、不用文本
 * 字符冒充图标。
 */
const props = defineProps<{
  data: { element: ModdleElement };
}>();

const type = computed(() => props.data.element.$type);

const kind = computed(() => {
  switch (type.value) {
    case "bpmn:StartEvent":
      return "start";
    case "bpmn:EndEvent":
      return "end";
    case "bpmn:ExclusiveGateway":
      return "exclusive";
    case "bpmn:ParallelGateway":
      return "parallel";
    case "bpmn:ServiceTask":
      return "cc";
    default:
      return "user";
  }
});

const isEvent = computed(() => kind.value === "start" || kind.value === "end");
const isGateway = computed(() => kind.value === "exclusive" || kind.value === "parallel");

const label = computed(() => String(props.data.element.get("name") ?? ""));

/** 多实例标记形态：会签/或签 = 并行三竖条；依次 = 串行三横条（BPMN 约定） */
const miMarker = computed<"parallel" | "sequential" | null>(() => {
  if (type.value !== "bpmn:UserTask") return null;
  const loop = props.data.element.get("loopCharacteristics") as
    { get(k: string): unknown } | undefined;
  if (loop === undefined) return null;
  return loop.get("isSequential") === true ? "sequential" : "parallel";
});
</script>

<template>
  <div class="bpmn-node" :data-kind="kind">
    <!-- 事件：细线圆（开始细描边，结束粗描边），标准 BPMN 不放字符 -->
    <svg v-if="isEvent" class="bpmn-svg" viewBox="0 0 36 36" :data-test="`canvas-${type}`">
      <circle
        cx="18"
        cy="18"
        :r="kind === 'end' ? 13 : 15"
        :stroke-width="kind === 'end' ? 4 : 1.8"
      />
    </svg>

    <!-- 网关：菱形描边 + 不旋转的细线符号（✕ = 排他；＋ = 并行） -->
    <svg v-else-if="isGateway" class="bpmn-svg" viewBox="0 0 50 50" :data-test="`canvas-${type}`">
      <path d="M25 4 L46 25 L25 46 L4 25 Z" />
      <g v-if="kind === 'exclusive'" class="gw-symbol">
        <line x1="17" y1="17" x2="33" y2="33" />
        <line x1="33" y1="17" x2="17" y2="33" />
      </g>
      <g v-else class="gw-symbol">
        <line x1="25" y1="14" x2="25" y2="36" />
        <line x1="14" y1="25" x2="36" y2="25" />
      </g>
    </svg>

    <!-- 任务：圆角矩形 + 左上角类型小图标 + 居中名称；多实例标记底部居中 -->
    <div v-else class="bpmn-task" :data-test="`canvas-${type}`" :data-cc="kind === 'cc'">
      <svg v-if="kind === 'user'" class="bpmn-task-icon" viewBox="0 0 16 16">
        <circle cx="8" cy="5" r="2.6" />
        <path d="M2.5 14a5.5 4.6 0 0 1 11 0Z" />
      </svg>
      <svg v-else class="bpmn-task-icon" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="3" />
        <g>
          <line x1="8" y1="1.5" x2="8" y2="4" />
          <line x1="8" y1="12" x2="8" y2="14.5" />
          <line x1="1.5" y1="8" x2="4" y2="8" />
          <line x1="12" y1="8" x2="14.5" y2="8" />
          <line x1="3.4" y1="3.4" x2="5.2" y2="5.2" />
          <line x1="10.8" y1="10.8" x2="12.6" y2="12.6" />
          <line x1="12.6" y1="3.4" x2="10.8" y2="5.2" />
          <line x1="5.2" y1="10.8" x2="3.4" y2="12.6" />
        </g>
      </svg>
      <span class="bpmn-task-name">{{ label || "未命名" }}</span>
      <span v-if="miMarker" class="bpmn-mi" :data-test="`mi-${miMarker}`" title="多人审批">
        <i /><i /><i />
      </span>
    </div>

    <span v-if="isEvent || isGateway" class="bpmn-label">{{ label }}</span>

    <!-- 只读投影：Handle 仅作连线锚点呈现，nodesConnectable=false 禁编辑 -->
    <Handle type="source" :position="Position.Bottom" class="bpmn-handle" />
    <Handle type="target" :position="Position.Top" class="bpmn-handle" />
  </div>
</template>

<style scoped>
.bpmn-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  /* 事件/网关的名称标签挂在框外下方（标准 BPMN 习惯） */
  overflow: visible;
}

.bpmn-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.bpmn-svg circle,
.bpmn-svg path,
.bpmn-svg line {
  fill: none;
  stroke: #2d3e97;
}

.bpmn-svg circle {
  fill: #fff;
}

.bpmn-node[data-kind="start"] .bpmn-svg circle {
  stroke: #4caf50;
}

.bpmn-node[data-kind="end"] .bpmn-svg circle {
  stroke: #e5484d;
}

.bpmn-task {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 1px solid #7a86b8;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.bpmn-task[data-cc="true"] {
  border-style: dashed;
}

.bpmn-task-icon {
  position: absolute;
  top: 3px;
  left: 4px;
  width: 13px;
  height: 13px;
}

.bpmn-task-icon circle,
.bpmn-task-icon line {
  fill: none;
  stroke: #5b6bb5;
  stroke-width: 1.4;
}

.bpmn-task-icon path {
  fill: #5b6bb5;
  stroke: none;
}

.bpmn-task-name {
  max-width: 70%;
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 多实例标记：三竖条 = 并行；三横条 = 串行（珊瑚橙声部，定稿强调位） */
.bpmn-mi {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.bpmn-mi i {
  width: 2px;
  height: 8px;
  background: #f76547;
}

.bpmn-mi[data-test="mi-sequential"] {
  flex-direction: column;
  gap: 1px;
}

.bpmn-mi[data-test="mi-sequential"] i {
  width: 8px;
  height: 2px;
}

.bpmn-label {
  position: absolute;
  top: 100%;
  margin-top: 2px;
  font-size: 11px;
  color: #606266;
  white-space: nowrap;
}

.bpmn-handle {
  opacity: 0;
  pointer-events: none;
}
</style>
