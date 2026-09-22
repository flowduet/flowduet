<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import type { BpmnModel, BlockTreeNode } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import BlockNodeList from "./BlockNodeList.vue";
import NodeDrawer from "./NodeDrawer.vue";
import {
  addBranchToBlock,
  CC_RECIPIENTS_PLACEHOLDER,
  insertApprovalAfter,
  insertCcAfter,
  isDefaultBranch,
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
const activeId = ref<string>();
const drawerVisible = ref(false);
/** 块操作 / 抽屉守卫抛错的可读呈现（issue #24：第二处默认等被拦截时 UI 有反馈） */
const actionError = ref("");

// #24 评审 W5：读视图可失败——半损态模型（块操作中间态抛错）不炸渲染。
// computed 内不做副作用（lint: vue/no-side-effects-in-computed-properties），只返回
// 空树 + 错误标记；错误经 watch 汇入 actionError 内联提示通道，UI 优雅降级而非白屏卡死。
const treeResult = computed<{ items: BlockTreeNode[]; error: string }>(() => {
  void version.value;
  try {
    return { items: deriveBlockTree(model.value), error: "" };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
});
const tree = computed<BlockTreeNode[]>(() => treeResult.value.items);

watch(
  () => treeResult.value.error,
  (err) => {
    // 双向同步（#24 二轮评审 W1）：模型从坏恢复（err 变 ""）时同样清掉旧横幅，
    // 不让陈旧错误残留在画布上。
    actionError.value = err;
  },
);

// #24 评审 S8：默认态一次算好的映射（forkId → 默认支路序），随 model 下传供递归模板复用，
// 避免 BlockNodeList 每条支路重复调 isDefaultBranch。依赖 tree（已随 version 追踪）。
const defaultIndexByFork = computed<Map<string, number>>(() => {
  const map = new Map<string, number>();
  const walk = (items: BlockTreeNode[]): void => {
    for (const item of items) {
      if (item.kind !== "block") continue;
      if (item.gateway === "exclusive") {
        item.branches.forEach((_, i) => {
          if (isDefaultBranch(model.value, item.forkId, i)) map.set(item.forkId, i);
        });
      }
      item.branches.forEach(walk);
    }
  };
  walk(tree.value);
  return map;
});

function refresh(): void {
  version.value += 1;
}

/**
 * 统一包裹写操作：守卫抛错转内联提示，不冒泡炸视图；仅成功时刷新（#24 评审 W5）——
 * 失败时模型可能处于中间态，不触发重算，交由下一次读视图的兜底捕获降级。
 */
function runGuarded(action: () => void): void {
  try {
    actionError.value = "";
    action();
    refresh();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  }
}

function insertAfter(kind: "approval" | "cc", nodeId: string): void {
  runGuarded(() => {
    if (kind === "cc") {
      // 新抄送默认收件人占位，抽屉里改成真实名单（空白/占位保存均被守卫拦截）
      insertCcAfter(model.value, nodeId, { recipients: CC_RECIPIENTS_PLACEHOLDER });
    } else {
      insertApprovalAfter(model.value, nodeId);
    }
  });
}

function openNode(nodeId: string): void {
  activeId.value = nodeId;
  drawerVisible.value = true;
}

function deleteNode(nodeId: string): void {
  // #24 评审 S7：删节点同样走 runGuarded——空分支守卫抛错时呈现可读提示，
  // 不再以未捕获异常形式冒出（与块操作统一错误口径）。
  runGuarded(() => {
    removeApprovalNode(model.value, nodeId);
    if (activeId.value === nodeId) {
      // 清掉 stale 引用：activeId 残留会让回收该 id 的新卡片凭空亮起 active 描边
      activeId.value = undefined;
      drawerVisible.value = false;
    }
  });
}

function addBranch(forkId: string): void {
  runGuarded(() => addBranchToBlock(model.value, forkId));
}

function removeBranchFrom(forkId: string, branchIndex: number): void {
  runGuarded(() => {
    removeBranch(model.value, forkId, branchIndex);
    clearStaleActive();
  });
}

function applyDefault(forkId: string, branchIndex: number | null): void {
  runGuarded(() => setDefaultBranch(model.value, forkId, branchIndex));
}

function removeBlockAt(forkId: string): void {
  runGuarded(() => {
    removeBlock(model.value, forkId);
    clearStaleActive();
  });
}

/**
 * 块级删除后的 stale active 清理（#24 二轮评审 W2）：被删支路/块可能包含当前 active
 * 元素（节点或支路头连线）——activeId 滞留会让 id 回收后的新卡片凭空亮起 active 描边，
 * 与 deleteNode 的清理口径一致。仅在守卫后的成功路径调用；元素仍在时为 no-op。
 */
function clearStaleActive(): void {
  if (activeId.value === undefined) return;
  try {
    model.value.elementOf(activeId.value);
  } catch {
    activeId.value = undefined;
    drawerVisible.value = false;
  }
}

/** 支路头点击：抽屉切到条件编辑形态（activeId 指向支路头连线） */
function openBranchConfig(flowId: string | undefined): void {
  // 非抛出式读函数（S8）可能返回 undefined（半损态）——此时不开抽屉
  if (flowId === undefined) return;
  activeId.value = flowId;
  drawerVisible.value = true;
}

/** 抽屉守卫抛错接入内联提示（#24 评审 W4） */
function onDrawerError(message: string): void {
  actionError.value = message;
}

/** 抽屉保存成功：清掉上一次守卫错误横幅（#24 二轮评审 W1），再触发重算 */
function onDrawerSaved(): void {
  actionError.value = "";
  refresh();
}
</script>

<template>
  <div class="dingtalk-designer" data-test="dingtalk-designer">
    <p v-if="actionError" class="action-error" data-test="action-error">{{ actionError }}</p>
    <BlockNodeList
      :items="tree"
      :active-id="activeId"
      :model="model"
      :default-index-by-fork="defaultIndexByFork"
      @insert="insertAfter"
      @open="openNode"
      @delete="deleteNode"
      @add-branch="addBranch"
      @remove-branch="removeBranchFrom"
      @set-default="applyDefault"
      @remove-block="removeBlockAt"
      @branch-config="openBranchConfig"
    />
    <NodeDrawer
      v-model="drawerVisible"
      :model="model"
      :node-id="activeId"
      @saved="onDrawerSaved"
      @error="onDrawerError"
    />
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
