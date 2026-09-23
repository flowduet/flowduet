<script setup lang="ts">
import { computed } from "vue";
import type { Point } from "@flowduet/core";
import { edgeArrowPoints, edgePolylinePoints } from "../geometry.js";

/**
 * 折线连线（#26）：几何直映射——waypoints 是画布绝对坐标，VueFlow 的
 * 边 SVG 与图坐标同空间，直接 polyline 即可；无 waypoints 时退化为直线。
 */
const props = defineProps<{
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data?: { waypoints?: Point[]; label?: string };
}>();

/** 标签锚点：折线中点（无折线时取直线中点） */
const labelAt = computed(() => {
  const list = edgePolylinePoints(
    props.data?.waypoints,
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  );
  const mid = list[Math.floor(list.length / 2)] as Point;
  return { x: mid.x, y: mid.y - 6 };
});

// 本组件模板是 <polyline> + <polygon> 双根 fragment；VueFlow 会把整包 edge 元数据
// （id/source/target/marker*/…）作为透传属性下传，fragment 无单一根可继承 →
// 每条边刷 "Extraneous non-props attributes" 告警。这些属性 SVG 上用不到，关掉继承即可。
defineOptions({ inheritAttrs: false });

const points = computed(() =>
  edgePolylinePoints(
    props.data?.waypoints,
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  )
    .map((p) => `${p.x},${p.y}`)
    .join(" "),
);

const arrowPoints = computed(() =>
  edgeArrowPoints(
    props.data?.waypoints,
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  )
    .map((p) => `${p.x},${p.y}`)
    .join(" "),
);
</script>

<template>
  <polyline
    :points="points"
    fill="none"
    stroke="#8a94b8"
    stroke-width="1.5"
    data-test="canvas-edge-polyline"
  />
  <polygon :points="arrowPoints" fill="#8a94b8" />
  <!-- 短标签（#46）：白描边垫底保证压线可读 -->
  <text
    v-if="data?.label"
    :x="labelAt.x"
    :y="labelAt.y"
    text-anchor="middle"
    class="bpmn-edge-label"
    data-test="canvas-edge-label"
  >
    {{ data.label }}
  </text>
</template>

<style scoped>
.bpmn-edge-label {
  font-size: 10px;
  fill: #5b6bb5;
  stroke: #fff;
  stroke-width: 3px;
  paint-order: stroke;
}
</style>
