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
  data?: { waypoints?: Point[] };
}>();

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
</template>
