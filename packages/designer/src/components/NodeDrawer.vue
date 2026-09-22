<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDrawer, ElForm, ElFormItem, ElInput } from "element-plus";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { setBranchCondition } from "../operations.js";

/**
 * 审批节点配置抽屉（分段选项卡式的最小集：节点名 + 审批人；
 * 完成方式三档属 #25）。读写直接落模型字段——表单只是字段缓冲，
 * 保存即写回，无独立状态可失同步（toRaw 由父组件统一完成）。
 */
const props = defineProps<{
  model: BpmnModel;
  /** exactOptional 下显式传 undefined 是合法形态（未选中节点时） */
  nodeId?: string | undefined;
}>();

const emit = defineEmits<{
  saved: [];
  /** 守卫抛错的可读消息（#24 评审 W4）：由宿主接入内联提示通道，不冒泡炸视图 */
  error: [message: string];
}>();

const visible = defineModel<boolean>({ default: false });

const name = ref("");
const assignee = ref("");

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

// ── 条件分支抽屉（#24）：点支路头连线时呈现条件表达式字段 ──
const isBranchHead = computed(() => {
  const el = currentNode();
  if (el?.$type !== "bpmn:SequenceFlow") return false;
  return (el.get("sourceRef") as ModdleElement).$type === "bpmn:ExclusiveGateway";
});

const condition = ref("");

watch(
  () => [props.nodeId, visible.value] as const,
  () => {
    if (!visible.value) return;
    const el = currentNode();
    if (el === undefined) return;
    name.value = String(el.get("name") ?? "");
    assignee.value = String(el.get("assignee") ?? "");
    condition.value =
      (el.get("conditionExpression") as ModdleElement | undefined)?.get("body") !== undefined
        ? String((el.get("conditionExpression") as ModdleElement).get("body"))
        : "";
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
  // #24 评审 W4：条件写回可能因守卫抛错（如默认流转不得携条件）——先校验后写，
  // 避免半写模型（name 已落、condition 未落）；抛错时不写名、不关抽屉、不发 saved，
  // 而是经 error emit 接入宿主的内联可读提示（AC#2「UI 呈现可读错误」）。
  if (isBranchHead.value) {
    try {
      setBranchCondition(props.model, props.nodeId, condition.value);
    } catch (e) {
      emit("error", e instanceof Error ? e.message : String(e));
      return;
    }
  }
  // trim 后再落盘：前后空白原样进 XML 会让引擎按带空格变量名解析、静默取不到人
  const trimmedName = name.value.trim();
  const trimmedAssignee = assignee.value.trim();
  el.set("name", trimmedName === "" ? undefined : trimmedName);
  el.set("assignee", trimmedAssignee === "" ? undefined : trimmedAssignee);
  visible.value = false;
  emit("saved");
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="isBranchHead ? '分支条件' : '审批节点'"
    size="360px"
    data-test="node-drawer"
  >
    <ElForm v-if="isTask" label-position="top">
      <ElFormItem label="节点名称">
        <ElInput v-model="name" data-test="drawer-name" placeholder="如：经理审批" />
      </ElFormItem>
      <ElFormItem label="审批人">
        <ElInput
          v-model="assignee"
          data-test="drawer-assignee"
          placeholder="如 ${manager} 或 张三"
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
