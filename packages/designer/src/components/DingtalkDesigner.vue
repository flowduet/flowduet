<script setup lang="ts">
import { computed, ref, toRaw } from "vue";
import type { BpmnModel, BlockTreeNode } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import BlockNodeList from "./BlockNodeList.vue";
import NodeDrawer from "./NodeDrawer.vue";
import { insertApprovalAfter, removeApprovalNode } from "../operations.js";

/**
 * 钉钉式编辑视图（顶层组件接缝）：挂一个模型实例即得可编辑视图。
 * 绑定方式 = 直接读写 + 重推导（R4）：一切编辑直接调模型方法，
 * 变更后仅递增版本号触发块树重算——视图无独立状态。
 * 块树渲染与坐标推导共用 deriveBlockTree（内核公开导出）。
 *
 * toRaw：宿主可能把模型放进 reactive store（或测试工具会包裹 props），
 * 私有字段无法穿越 Vue 代理——这里统一解掉代理，只解代理不解状态。
 */
const props = defineProps<{
  model: BpmnModel;
}>();

const model = computed(() => toRaw(props.model));

const version = ref(0);
const tree = computed<BlockTreeNode[]>(() => {
  void version.value;
  return deriveBlockTree(model.value);
});

const activeId = ref<string>();
const drawerVisible = ref(false);

function refresh(): void {
  version.value += 1;
}

function insertAfter(nodeId: string): void {
  insertApprovalAfter(model.value, nodeId);
  refresh();
}

function openNode(nodeId: string): void {
  activeId.value = nodeId;
  drawerVisible.value = true;
}

function deleteNode(nodeId: string): void {
  removeApprovalNode(model.value, nodeId);
  if (activeId.value === nodeId) {
    drawerVisible.value = false;
  }
  refresh();
}
</script>

<template>
  <div class="dingtalk-designer" data-test="dingtalk-designer">
    <BlockNodeList
      :items="tree"
      :active-id="activeId"
      @insert="insertAfter"
      @open="openNode"
      @delete="deleteNode"
    />
    <NodeDrawer v-model="drawerVisible" :model="model" :node-id="activeId" @saved="refresh" />
  </div>
</template>

<style scoped>
.dingtalk-designer {
  min-height: 100%;
  padding: 24px 16px;
  background: #f5f6f8;
}
</style>
