<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDrawer, ElForm, ElFormItem, ElInput } from "element-plus";
import type { ApprovalMode, BpmnModel, ModdleElement } from "@flowduet/core";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  readApprovalMulti,
  setApprovalMode,
  setBranchCondition,
} from "../operations.js";

/**
 * 节点配置抽屉（#23 最小集 + #25 字段面）。读写直接落模型——表单只是
 * 字段缓冲，保存即写回，无独立状态可失同步。
 *
 * 形态自适应：审批任务（单签/多人三档 + formKey 占位）、抄送任务（收件人）、
 * 分支头连线（条件表达式）。单人↔多人经 operations 的同 id 转换（保连通）。
 */
const props = defineProps<{
  model: BpmnModel;
  /** exactOptional 下显式传 undefined 是合法形态（未选中节点时） */
  nodeId?: string | undefined;
}>();

const emit = defineEmits<{
  saved: [];
  /** 守卫抛错的可读消息：由宿主接入内联提示通道，不冒泡炸视图 */
  error: [message: string];
}>();

const visible = defineModel<boolean>({ default: false });

const name = ref("");
const assignee = ref("");
const formKey = ref("");
const condition = ref("");
const recipients = ref("");
/** 完成方式：single = 单签（单实例）；三档 = 多实例（审批人字段变集合变量） */
const approvalKind = ref<"single" | ApprovalMode>("single");

/**
 * 取当前抽屉指向的模型元素；节点已被宿主删除时返回 undefined。
 * isTask / 回填 watch / save 三处共享这一防御口径，避免渲染期抛未捕获异常。
 */
function currentNode(): ModdleElement | undefined {
  if (props.nodeId === undefined) return undefined;
  try {
    return props.model.elementOf(props.nodeId);
  } catch {
    return undefined;
  }
}

const isTask = computed(() => currentNode()?.$type === "bpmn:UserTask");
const isCcTask = computed(() => {
  const el = currentNode();
  return el?.$type === "bpmn:ServiceTask" && el.get("ccTo") !== undefined;
});

// ── 条件分支抽屉（#24）：点支路头连线时呈现条件表达式字段 ──
const isBranchHead = computed(() => {
  const el = currentNode();
  if (el?.$type !== "bpmn:SequenceFlow") return false;
  return (el.get("sourceRef") as ModdleElement).$type === "bpmn:ExclusiveGateway";
});

const KIND_OPTIONS: { key: "single" | ApprovalMode; label: string; hint: string }[] = [
  { key: "single", label: "单签", hint: "一人审批" },
  { key: "all", label: "会签", hint: "全员同意才通过" },
  { key: "any", label: "或签", hint: "任一人同意即通过" },
  { key: "sequential", label: "依次", hint: "按顺序逐人审批" },
];

watch(
  () => [props.nodeId, visible.value] as const,
  () => {
    if (!visible.value) return;
    const el = currentNode();
    if (el === undefined) return;
    name.value = String(el.get("name") ?? "");
    assignee.value = String(el.get("assignee") ?? "");
    formKey.value = String(el.get("formKey") ?? "");
    recipients.value = String(el.get("ccTo") ?? "");
    condition.value =
      (el.get("conditionExpression") as ModdleElement | undefined)?.get("body") !== undefined
        ? String((el.get("conditionExpression") as ModdleElement).get("body"))
        : "";
    const multi = props.nodeId !== undefined ? readApprovalMulti(props.model, props.nodeId) : null;
    approvalKind.value = multi === null ? "single" : multi.mode;
    if (multi !== null) {
      // 集合变量回填到审批人字段（多人形态下该字段即集合名）
      assignee.value = multi.collection;
    }
  },
);

function save(): void {
  if (props.nodeId === undefined) return;
  const el = currentNode();
  if (el === undefined) {
    // 抽屉打开期间宿主可能已删除该节点——不在此抛未捕获异常
    visible.value = false;
    return;
  }
  // 条件写回可能因守卫抛错——先校验后写，避免半写模型；抛错经 error emit
  // 接入宿主内联提示（不写名、不关抽屉、不发 saved）
  if (isBranchHead.value) {
    try {
      setBranchCondition(props.model, props.nodeId, condition.value);
    } catch (e) {
      emit("error", e instanceof Error ? e.message : String(e));
      return;
    }
  }
  const trimmedName = name.value.trim();
  el.set("name", trimmedName === "" ? undefined : trimmedName);

  if (isTask.value) {
    // 完成方式分流：single 走单实例；三档走多实例（单人→转换，档间→直改）
    const trimmedAssignee = assignee.value.trim();
    const trimmedFormKey = formKey.value.trim();
    try {
      if (approvalKind.value === "single") {
        if (readApprovalMulti(props.model, props.nodeId) !== null) {
          convertMultiToSingle(props.model, props.nodeId);
        }
        const current = currentNode();
        if (current !== undefined) {
          current.set("assignee", trimmedAssignee === "" ? undefined : trimmedAssignee);
          current.set("formKey", trimmedFormKey === "" ? undefined : trimmedFormKey);
        }
      } else {
        if (trimmedAssignee === "") {
          emit("error", "多人审批需要填写审批人集合变量名（运行时注入名单）");
          return;
        }
        const multi = readApprovalMulti(props.model, props.nodeId);
        if (multi === null) {
          convertApprovalToMulti(props.model, props.nodeId, {
            collection: trimmedAssignee,
            mode: approvalKind.value,
          });
        } else {
          setApprovalMode(props.model, props.nodeId, {
            collection: trimmedAssignee,
            mode: approvalKind.value,
          });
        }
        const current = currentNode();
        if (current !== undefined) {
          // 与单人分支同口径：清空保存同样落盘（多人形态 formKey 不残留旧值）
          current.set("formKey", trimmedFormKey === "" ? undefined : trimmedFormKey);
        }
      }
    } catch (e) {
      emit("error", e instanceof Error ? e.message : String(e));
      return;
    }
  } else if (isCcTask.value) {
    // 抄送收件人必填（空收件人的抄送执行会静默丢知会）
    const trimmedRecipients = recipients.value.trim();
    if (trimmedRecipients === "") {
      emit("error", "抄送收件人不能为空白（字面量逗号分隔或表达式）");
      return;
    }
    el.set("ccTo", trimmedRecipients);
  }
  visible.value = false;
  emit("saved");
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="isBranchHead ? '分支条件' : isCcTask ? '抄送节点' : '审批节点'"
    size="360px"
    data-test="node-drawer"
  >
    <ElForm v-if="isTask" label-position="top">
      <ElFormItem label="节点名称">
        <ElInput v-model="name" data-test="drawer-name" placeholder="如：经理审批" />
      </ElFormItem>
      <ElFormItem :label="approvalKind === 'single' ? '审批人' : '审批人（集合变量）'">
        <ElInput
          v-model="assignee"
          data-test="drawer-assignee"
          :placeholder="
            approvalKind === 'single' ? '如 ${manager} 或 张三' : '如 approvers，运行时注入名单'
          "
        />
      </ElFormItem>
      <ElFormItem label="完成方式">
        <div class="kind-cards" data-test="kind-cards">
          <button
            v-for="option in KIND_OPTIONS"
            :key="option.key"
            class="kind-card"
            :class="{ 'kind-card--on': approvalKind === option.key }"
            :data-test="`kind-${option.key}`"
            type="button"
            @click="approvalKind = option.key"
          >
            <span class="kind-card-label">{{ option.label }}</span>
            <span class="kind-card-hint">{{ option.hint }}</span>
          </button>
        </div>
      </ElFormItem>
      <ElFormItem label="表单标识（占位）">
        <ElInput v-model="formKey" data-test="drawer-formkey" placeholder="如 leave_form_v1" />
      </ElFormItem>
    </ElForm>
    <ElForm v-else-if="isCcTask" label-position="top">
      <ElFormItem label="节点名称">
        <ElInput v-model="name" data-test="drawer-name" placeholder="如：抄送知会" />
      </ElFormItem>
      <ElFormItem label="收件人">
        <ElInput
          v-model="recipients"
          data-test="drawer-recipients"
          placeholder="字面量逗号分隔（张三,李四）或表达式（${ccUsers}）"
        />
      </ElFormItem>
    </ElForm>
    <ElForm v-else-if="isBranchHead" label-position="top">
      <ElFormItem label="节点名称">
        <ElInput v-model="name" data-test="drawer-name" placeholder="分支名（如：金额较大）" />
      </ElFormItem>
      <ElFormItem label="条件表达式">
        <ElInput
          v-model="condition"
          data-test="drawer-condition"
          placeholder="如 ${amount > 1000}；留空表示无条件"
        />
      </ElFormItem>
    </ElForm>
    <div v-else class="drawer-empty">该元素无可配置字段</div>
    <template #footer>
      <ElButton data-test="drawer-cancel" @click="visible = false">取消</ElButton>
      <ElButton type="primary" data-test="drawer-save" @click="save">确定</ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
/* 完成方式三档卡片（视觉定稿：分段选项卡式，选中态靛蓝描边） */
.kind-cards {
  display: flex;
  gap: 6px;
  width: 100%;
}

.kind-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  text-align: center;
}

.kind-card--on {
  border-color: #2d3e97;
  background: rgba(45, 62, 151, 0.06);
  outline: 1px solid #2d3e97;
}

.kind-card-label {
  font-size: 13px;
  color: #303133;
}

.kind-card-hint {
  font-size: 10px;
  color: #909399;
}

.drawer-empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}
</style>
