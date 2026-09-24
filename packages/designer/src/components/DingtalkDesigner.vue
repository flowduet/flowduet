<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import type { BpmnModel, BlockTreeNode } from "@flowduet/core";
import { deriveBlockTree, resolveEffectiveForm } from "@flowduet/core";
import BlockNodeList from "./BlockNodeList.vue";
import NodeDrawer from "./NodeDrawer.vue";
import type { DesignerFormOption, NodeFormSummary } from "../form-options.js";
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
  /**
   * 表单目录摘要（#72 中立接缝）：传入即启用表单集成模式——展示流程默认
   * 表单选择条与审批节点的有效表单摘要；不传（未安装表单包的宿主）则
   * 完全不出现相关入口，原有纯流程使用方式不变。选项内容与表单实现解耦。
   */
  formOptions?: readonly DesignerFormOption[];
}>();

const emit = defineEmits<{ change: [] }>();

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

/** 当前默认 key 是否指向目录中不存在的表单（保留原值供修复，不回退不清除） */
const defaultFormInvalid = computed<boolean>(() => {
  void version.value;
  const options = props.formOptions;
  const key = model.value.defaultFormKey;
  if (options === undefined || key === undefined) return false;
  return !options.some((option) => option.id === key);
});

/**
 * 审批节点的有效表单摘要（#72）：显式覆盖优先，否则继承流程默认；网关与
 * 抄送不参与（无条目即不展示）。失效引用保留 key 展示并标记，供用户修复。
 */
const formSummaries = computed<Map<string, NodeFormSummary>>(() => {
  void version.value;
  const map = new Map<string, NodeFormSummary>();
  const options = props.formOptions;
  if (options === undefined) return map;
  const walk = (items: BlockTreeNode[]): void => {
    for (const item of items) {
      if (item.kind === "block") {
        item.branches.forEach(walk);
        continue;
      }
      // 非审批节点（网关/抄送/事件）由解析器统一返回 none，无需预判
      const ref = resolveEffectiveForm(model.value, item.id);
      if (ref.source === "none" || ref.key === undefined) continue;
      const name = options.find((option) => option.id === ref.key)?.name;
      map.set(
        item.id,
        name === undefined
          ? { text: `表单：${ref.key}（引用失效）`, invalid: true }
          : {
              text: `表单：${name}（${ref.source === "node" ? "节点指定" : "继承默认"}）`,
              invalid: false,
            },
      );
    }
  };
  walk(tree.value);
  return map;
});

function onDefaultFormChange(value: string): void {
  runGuarded(() => {
    // 空串即「无」：清除默认引用，继承节点随之回到无表单状态
    model.value.setDefaultFormKey(value === "" ? undefined : value);
  });
}

function refresh(): void {
  version.value += 1;
  // 三区联动通道（#27）：任何编辑成功后通知宿主刷新只读区与 XML 预览
  emit("change");
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
    <!-- 流程默认表单选择条（#72）：仅在表单集成模式（传入 formOptions）出现。
         原生 select：与钉钉式视图的原生按钮语汇一致，也避开 ElSelect 泛型
         组件在 vue-tsc 严格检查下的模板推断问题 -->
    <div v-if="formOptions" class="default-form-bar" data-test="default-form-bar">
      <span class="default-form-bar-label">流程默认表单</span>
      <select
        class="default-form-select"
        data-test="default-form-select"
        :value="model.defaultFormKey ?? ''"
        @change="onDefaultFormChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="" data-test="default-form-option-none">无</option>
        <option
          v-for="form in formOptions"
          :key="form.id"
          :value="form.id"
          :data-test="`default-form-option-${form.id}`"
        >
          {{ form.name }}
        </option>
        <!-- key 不在目录中：追加只读项呈现原值，用户可见并可改选修复 -->
        <option v-if="defaultFormInvalid" :value="model.defaultFormKey">
          {{ model.defaultFormKey }}（目录外）
        </option>
      </select>
      <span v-if="defaultFormInvalid" class="default-form-invalid" data-test="default-form-invalid">
        引用失效：key 不在表单目录中，已保留原值供修复
      </span>
    </div>
    <BlockNodeList
      :items="tree"
      :active-id="activeId"
      :model="model"
      :default-index-by-fork="defaultIndexByFork"
      :form-summaries="formSummaries"
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

.default-form-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 280px;
  max-width: 100%;
  margin: 0 auto 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  flex-wrap: wrap;
}

.default-form-bar-label {
  font-size: 12px;
  color: #5e6f91;
  white-space: nowrap;
}

.default-form-select {
  width: 140px;
  flex: 1;
  min-width: 100px;
  height: 26px;
  padding: 0 4px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #303133;
  font-size: 12px;
}

.default-form-invalid {
  flex-basis: 100%;
  font-size: 11px;
  color: #c45656;
}
</style>
