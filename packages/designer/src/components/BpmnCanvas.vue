<script setup lang="ts">
import { computed, markRaw, ref, toRaw } from "vue";
import { VueFlow } from "@vue-flow/core";
import type { EdgeTypesObject, NodeTypesObject, VueFlowStore } from "@vue-flow/core";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { initialCanvasViewport, resolveCanvasGeometry } from "../geometry.js";
import type { CanvasGeometry } from "../geometry.js";
import BpmnNode from "./BpmnNode.vue";
import BpmnEdge from "./BpmnEdge.vue";
import { READONLY_FLOW_PROPS } from "../canvas-props.js";

/**
 * BPMN 视图只读投影（#26）：Vue-Flow 画布直读模型几何，与钉钉式视图
 * 挂同一模型实例，互切零转换——「一棵树两种投影」的代码证据。
 *
 * 只读配置见 READONLY_FLOW_PROPS（canvas-props.ts 单一出处，测试断言该常量）；
 * 编辑面全部禁用，缩放/平移保留。
 *
 * 刷新合同：几何只依赖 model 的**身份**——toRaw 后对 moddle 树的原地读写不经
 * Vue 响应式通道，宿主在挂载期间原地改模型不会自动重算。刷新二选一：
 *  ① 重挂 / 换 model 实例（playground 互切走此路径，互切零转换成立）；
 *  ② 传 version prop，原地改后递增它触发重算（#27 三区布局边编辑边看预览用）。
 */
const props = defineProps<{
  model: BpmnModel;
  /** 原地刷新接缝：宿主在挂载期间原地改模型后递增此值触发几何重算（缺省＝仅重挂/换实例刷新） */
  version?: number;
}>();

// toRaw 解 Vue 代理（宿主 reactive store 会让内核私有字段无法穿越）
const modelRaw = computed(() => toRaw(props.model));
const canvasElement = ref<HTMLElement | null>(null);

// 只读投影同样可失败：半损/非良构模型（缺坐标且含不可达元素、循环、多开始事件等）
// 会让竖排推导抛错。computed 内不做副作用（lint: vue/no-side-effects-in-computed-properties），
// 只返回 null + 错误信息；模板据此渲染可读错误态，而非让异常冒泡炸渲染树（白屏）。
// 与钉钉式视图 DingtalkDesigner 的 { items, error } 降级口径一致。
// 模板分支用数据态（geometry === null）而非文案态（error 非空）：任何异常一律不挂 VueFlow，
// 即便错误信息为空串也不会静默丢图。
const geometryResult = computed<{ geometry: CanvasGeometry | null; error: string }>(() => {
  void props.version; // 建立对 version 的依赖：宿主原地改模型后递增即触发本 computed 重算
  try {
    return { geometry: resolveCanvasGeometry(modelRaw.value), error: "" };
  } catch (e) {
    return { geometry: null, error: e instanceof Error ? e.message : String(e) };
  }
});

type FlowNode = {
  id: string;
  type: "bpmn";
  position: { x: number; y: number };
  data: { element: ModdleElement };
  style: { width: string; height: string };
};

const nodes = computed<FlowNode[]>(() => {
  const geo = geometryResult.value.geometry;
  if (geo === null) return [];
  const flowElements = (modelRaw.value.process.get("flowElements") as ModdleElement[]) ?? [];
  const list: FlowNode[] = [];
  for (const element of flowElements) {
    if (element.$type === "bpmn:SequenceFlow") continue;
    const id = element.get("id") as string;
    const shape = geo.shapes.get(id);
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
  const geo = geometryResult.value.geometry;
  if (geo === null) return [];
  const flowElements = (modelRaw.value.process.get("flowElements") as ModdleElement[]) ?? [];
  const list: {
    id: string;
    source: string;
    target: string;
    type: "bpmn-edge";
    data: { waypoints?: { x: number; y: number }[] | undefined; label?: string; detail?: string };
  }[] = [];
  for (const element of flowElements) {
    if (element.$type !== "bpmn:SequenceFlow") continue;
    const id = element.get("id") as string;
    const waypoints: { x: number; y: number }[] | undefined = geo.waypoints.get(id);
    // 连线短标签用于浏览结构，原始条件留在 detail 供只读查看。
    const source = element.get("sourceRef") as ModdleElement;
    const flowName = element.get("name");
    const isDefault = source.get("default") === element;
    const expression = element.get("conditionExpression") as ModdleElement | undefined;
    const condition = String(expression?.get("body") ?? "").trim();
    const shortCondition = condition.length > 28 ? `${condition.slice(0, 27)}…` : condition;
    const label =
      typeof flowName === "string" && flowName.trim() !== ""
        ? `${flowName.trim()}${isDefault ? " · 默认" : ""}`
        : isDefault
          ? "默认"
          : shortCondition || undefined;
    list.push({
      id,
      source: source.get("id") as string,
      target: (element.get("targetRef") as ModdleElement).get("id") as string,
      type: "bpmn-edge",
      data:
        label === undefined
          ? { waypoints }
          : condition === ""
            ? { waypoints, label }
            : { waypoints, label, detail: condition },
    });
  }
  return list;
});

// VueFlow 的自定义组件契约（NodeProps/EdgeProps 全量字段）比我们的窄 props 宽，
// 经 markRaw 注册并以 slot 渲染实际节点；类型断言收敛在注册边界一处。
const nodeTypes = { bpmn: markRaw(BpmnNode) } as unknown as NodeTypesObject;
const edgeTypes = { "bpmn-edge": markRaw(BpmnEdge) } as unknown as EdgeTypesObject;

function initializeViewport(instance: VueFlowStore): void {
  const geometry = geometryResult.value.geometry;
  const width = canvasElement.value?.getBoundingClientRect().width ?? 0;
  if (geometry === null) return;
  const viewport = initialCanvasViewport(geometry, width);
  if (viewport !== null) {
    void instance.setViewport(viewport).catch((error: unknown) => {
      console.warn("无法设置 BPMN 初始视角", error);
    });
  }
}
</script>

<template>
  <div ref="canvasElement" class="bpmn-canvas" data-test="bpmn-canvas">
    <p
      v-if="geometryResult.geometry === null"
      class="canvas-error"
      data-test="canvas-error"
      role="alert"
    >
      {{ geometryResult.error }}
    </p>
    <VueFlow
      v-else
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      v-bind="READONLY_FLOW_PROPS"
      :fit-view-on-init="false"
      :min-zoom="0.55"
      :max-zoom="2.5"
      data-test="vue-flow"
      @pane-ready="initializeViewport"
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

.canvas-error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(229, 72, 77, 0.08);
  color: #c45656;
  font-size: 12px;
}
</style>
