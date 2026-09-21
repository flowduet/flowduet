<script setup lang="ts">
import { computed, ref, toRaw } from "vue";
import type { BpmnModel, BlockTreeNode } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import BlockNodeList from "./BlockNodeList.vue";
import NodeDrawer from "./NodeDrawer.vue";
import {
  addBranchToBlock,
  insertApprovalAfter,
  removeApprovalNode,
  removeBlock,
  removeBranch,
  setDefaultBranch,
} from "../operations.js";

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
/** 块操作守卫抛错的可读呈现（issue #24：第二处默认等被拦截时 UI 有反馈） */
const actionError = ref("");

function refresh(): void {
  version.value += 1;
}

/** 统一包裹块操作：守卫抛错转内联提示，不冒泡炸视图 */
function runGuarded(action: () => void): void {
  try {
    actionError.value = "";
    action();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  }
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
    // 清掉 stale 引用：activeId 残留会让回收该 id 的新卡片凭空亮起 active 描边
    activeId.value = undefined;
    drawerVisible.value = false;
  }
  refresh();
}

function addBranch(forkId: string): void {
  runGuarded(() => addBranchToBlock(model.value, forkId));
  refresh();
}

function removeBranchFrom(forkId: string, branchIndex: number): void {
  runGuarded(() => removeBranch(model.value, forkId, branchIndex));
  refresh();
}

function applyDefault(forkId: string, branchIndex: number | null): void {
  runGuarded(() => setDefaultBranch(model.value, forkId, branchIndex));
  refresh();
}

function removeBlockAt(forkId: string): void {
  runGuarded(() => removeBlock(model.value, forkId));
  refresh();
}

/** 支路头点击：抽屉切到条件编辑形态（activeId 指向支路头连线） */
function openBranchConfig(flowId: string): void {
  activeId.value = flowId;
  drawerVisible.value = true;
}
</script>

<template>
  <div class="dingtalk-designer" data-test="dingtalk-designer">
    <p v-if="actionError" class="action-error" data-test="action-error">{{ actionError }}</p>
    <BlockNodeList
      :items="tree"
      :active-id="activeId"
      :model="model"
      @insert="insertAfter"
      @open="openNode"
      @delete="deleteNode"
      @add-branch="addBranch"
      @remove-branch="removeBranchFrom"
      @set-default="applyDefault"
      @remove-block="removeBlockAt"
      @branch-config="openBranchConfig"
    />
    <NodeDrawer v-model="drawerVisible" :model="model" :node-id="activeId" @saved="refresh" />
  </div>
</template>

<style scoped>
.action-error {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(229, 72, 77, 0.08);
  color: #c45656;
  font-size: 12px;
}

.dingtalk-designer {
  min-height: 100%;
  padding: 24px 16px;
  background: #f5f6f8;
}
</style>
