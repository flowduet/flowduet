<script setup lang="ts">
import { computed, markRaw, toRaw } from "vue";
import { VueFlow } from "@vue-flow/core";
import type { EdgeTypesObject, NodeTypesObject } from "@vue-flow/core";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { resolveCanvasGeometry } from "../geometry.js";
import BpmnNode from "./BpmnNode.vue";
import BpmnEdge from "./BpmnEdge.vue";
import { READONLY_FLOW_PROPS } from "../canvas-props.js";

/**
 * BPMN 视图只读投影（#26）：Vue-Flow 画布直读模型几何，与钉钉式视图
 * 挂同一模型实例，互切零转换——「一棵树两种投影」的代码证据。
 *
 * 只读配置见 READONLY_FLOW_PROPS（canvas-props.ts 单一出处，测试断言该常量）；
 * 编辑面全部禁用，缩放/平移保留。
 */
const props = defineProps<{
  model: BpmnModel;
}>();

// toRaw 解 Vue 代理（宿主 reactive store 会让内核私有字段无法穿越）
const modelRaw = computed(() => toRaw(props.model));

const geometry = computed(() => resolveCanvasGeometry(modelRaw.value));

type FlowNode = {
  id: string;
  type: "bpmn";
  position: { x: number; y: number };
  data: { element: ModdleElement };
  style: { width: string; height: string };
};

const nodes = computed<FlowNode[]>(() => {
  const flowElements = (modelRaw.value.process.get("flowElements") as ModdleElement[]) ?? [];
  const list: FlowNode[] = [];
  for (const element of flowElements) {
    if (element.$type === "bpmn:SequenceFlow") continue;
    const id = element.get("id") as string;
    const shape = geometry.value.shapes.get(id);
    if (shape === undefined) continue;
    list.push({
      id,
      type: "bpmn",
      position: { x: shape.x, y: shape.y },
      data: { element },
      style: { width: `${shape.width}px`, height: `${shape.height}px` },
    });
  }
  return list;
});

const edges = computed(() => {
  const flowElements = (modelRaw.value.process.get("flowElements") as ModdleElement[]) ?? [];
  const list: {
    id: string;
    source: string;
    target: string;
    type: "bpmn-edge";
    data: { waypoints?: { x: number; y: number }[] | undefined };
  }[] = [];
  for (const element of flowElements) {
    if (element.$type !== "bpmn:SequenceFlow") continue;
    const id = element.get("id") as string;
    const waypoints: { x: number; y: number }[] | undefined = geometry.value.waypoints.get(id);
    list.push({
      id,
      source: (element.get("sourceRef") as ModdleElement).get("id") as string,
      target: (element.get("targetRef") as ModdleElement).get("id") as string,
      type: "bpmn-edge",
      data: { waypoints },
    });
  }
  return list;
});

// VueFlow 的自定义组件契约（NodeProps/EdgeProps 全量字段）比我们的窄 props 宽，
// 经 markRaw 注册并以 slot 渲染实际节点；类型断言收敛在注册边界一处。
const nodeTypes = { bpmn: markRaw(BpmnNode) } as unknown as NodeTypesObject;
const edgeTypes = { "bpmn-edge": markRaw(BpmnEdge) } as unknown as EdgeTypesObject;
</script>

<template>
  <div class="bpmn-canvas" data-test="bpmn-canvas">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      v-bind="READONLY_FLOW_PROPS"
      :fit-view-on-init="true"
      :min-zoom="0.3"
      :max-zoom="2.5"
      data-test="vue-flow"
    />
  </div>
</template>

<style scoped>
.bpmn-canvas {
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: #fff;
}
</style>
