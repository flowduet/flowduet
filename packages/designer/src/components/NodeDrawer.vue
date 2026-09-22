<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDrawer, ElForm, ElFormItem, ElInput } from "element-plus";
import type { ApprovalMode, BpmnModel, ModdleElement } from "@flowduet/core";
import {
  CC_RECIPIENTS_PLACEHOLDER,
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
 * 逐实例元素变量名缓冲（评审 W-1）：readApprovalMulti 返回后回填，
 * save 时透传给 convertApprovalToMulti / setApprovalMode。不透传会让
 * setApprovalMode 回落 DEFAULT_ELEMENT_VARIABLE，静默改写 assignee 表达式，
 * 流程内引用原变量名的表单/监听器/后续节点全部失效。
 */
const elementVariable = ref<string | undefined>(undefined);
/**
 * 单↔多切换时暂存的旧审批人值（评审 S-3）：同一抽屉会话内误点后切回不丢字段。
 * 只存在内存 ref，不持久化到模型；抽屉关闭重开后以模型当前形态为准。
 */
const lastSingleAssignee = ref<string | undefined>(undefined);
const lastCollection = ref<string | undefined>(undefined);

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

/**
 * 集合变量应是裸标识符（运行时注入名单，如 approvers，可带点路径）。
 * ${...} 表达式或逗号名单是单签语义的值，切多人时若沿用会被当集合名落盘，
 * 运行时 collection 求值不到 Collection 直接抛错（#25 评审 S1）。
 * ASCII-only 是有意的 UX 收口：JUEL/Java 理论上支持 Unicode 标识符，但只读画布 /
 * 宿主表单引用一致性上 ASCII 更安全；错误文案需与限制一致（评审 S-4）。
 */
function isCollectionVariable(value: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value);
}

/**
 * 用户点完成方式卡片：单↔多切换时暂存旧审批人缓冲并尝试恢复同侧旧值（评审 S-3）。
 * 字段语义在「字面 assignee」与「集合变量名」之间翻转——不暂存/清空会让旧语义
 * 值被当新语义落盘（多→单把集合名当字面 assignee，单→多把 ${manager} 当集合名）。
 * 只在用户交互时触发，不走 watch，避免打开抽屉回填多实例时被误清（#25 评审 C1/S1）。
 */
function selectKind(kind: "single" | ApprovalMode): void {
  const prev = approvalKind.value;
  if (prev === kind) return;
  approvalKind.value = kind;
  const crossedBoundary = (prev === "single") !== (kind === "single");
  if (!crossedBoundary) return;
  // 暂存旧侧值：单→多 暂存 assignee；多→单 暂存 collection（同一字段不同语义）
  if (prev === "single") {
    lastSingleAssignee.value = assignee.value;
  } else {
    lastCollection.value = assignee.value;
  }
  // 切到新侧：若同会话内曾暂存过该侧的值则恢复，否则置空（避免旧语义污染）
  assignee.value = (kind === "single" ? lastSingleAssignee.value : lastCollection.value) ?? "";
}

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
    const multi = readMultiSafe();
    approvalKind.value = multi === null ? "single" : multi.mode;
    // 重新打开抽屉 = 新会话，上一次暂存的单↔多旧值作废，避免跨会话污染
    lastSingleAssignee.value = undefined;
    lastCollection.value = undefined;
    if (multi !== null) {
      // 集合变量回填到审批人字段（多人形态下该字段即集合名）；
      // 元素变量名同步回填，保存时透传避免静默重置（评审 W-1）
      assignee.value = multi.collection;
      elementVariable.value = multi.elementVariable;
    } else {
      elementVariable.value = undefined;
    }
  },
);

/**
 * 回填期安全读取多实例形态：非内核固化完成条件（多见于外部导入 XML）时
 * readApprovalMulti 会抛错，此处捕获转 error emit，不猜语义。save() 会再次读取并
 * 同样抛错拦截，避免把多人节点静默转成单人（#25 评审 W2）。
 */
function readMultiSafe(): ReturnType<typeof readApprovalMulti> {
  if (props.nodeId === undefined) return null;
  try {
    return readApprovalMulti(props.model, props.nodeId);
  } catch (e) {
    emit("error", e instanceof Error ? e.message : String(e));
    return null;
  }
}

function save(): void {
  if (props.nodeId === undefined) return;
  const el = currentNode();
  if (el === undefined) {
    // 抽屉打开期间宿主可能已删除该节点——不在此抛未捕获异常
    visible.value = false;
    return;
  }

  const trimmedName = name.value.trim();

  // ── 分支条件抽屉（#24）：只有 name + condition，条件写回可能因守卫抛错 ──
  if (isBranchHead.value) {
    try {
      setBranchCondition(props.model, props.nodeId, condition.value);
    } catch (e) {
      emit("error", e instanceof Error ? e.message : String(e));
      return;
    }
    // 条件写成功后才写 name，避免半写模型（#25 评审 C2）
    el.set("name", trimmedName === "" ? undefined : trimmedName);
    visible.value = false;
    emit("saved");
    return;
  }

  const trimmedAssignee = assignee.value.trim();
  const trimmedFormKey = formKey.value.trim();
  const trimmedRecipients = recipients.value.trim();

  // ── 前置校验（一律不写模型）：任一条不过即 emit error 返回，模型零变更 ──
  if (isTask.value && approvalKind.value !== "single") {
    if (trimmedAssignee === "") {
      emit("error", "多人审批需要填写审批人集合变量名（运行时注入名单）");
      return;
    }
    if (!isCollectionVariable(trimmedAssignee)) {
      // 文案与限制对齐（评审 S-4）：明确 ASCII-only，避免用户误以为字段不接受任何名单
      emit(
        "error",
        "审批人集合变量名仅支持英文字母/数字/下划线（如 approvers 或 dept.approvers），不接受 ${...} 表达式或逗号名单",
      );
      return;
    }
  } else if (isCcTask.value) {
    // 空白与插入占位串都拦：占位落盘会让运行时查无此人、静默丢知会（#25 评审 W4）
    if (trimmedRecipients === "" || trimmedRecipients === CC_RECIPIENTS_PLACEHOLDER) {
      emit("error", "抄送收件人不能为空白或占位文本（字面量逗号分隔或表达式）");
      return;
    }
  }

  // ── 校验通过后才写模型 ──
  if (isTask.value) {
    // 完成方式分流：single 走单实例；三档走多实例（单人→转换，档间→直改）。
    // 结构性转换已 fail-fast 校验，抛错时 name 尚未写、模型未被破坏（#25 评审 C2/W3）。
    // elementVariable 透传（评审 W-1）：不透传则 setApprovalMode 会回落 DEFAULT_ELEMENT_VARIABLE
    // 静默改写 loop.elementVariable 与 assignee 表达式，流程内引用旧变量名的地方全失效。
    const multiSpec = {
      collection: trimmedAssignee,
      mode: approvalKind.value as ApprovalMode,
      ...(elementVariable.value !== undefined ? { elementVariable: elementVariable.value } : {}),
    };
    try {
      if (approvalKind.value === "single") {
        if (readApprovalMulti(props.model, props.nodeId) !== null) {
          convertMultiToSingle(props.model, props.nodeId);
        }
      } else {
        const multi = readApprovalMulti(props.model, props.nodeId);
        if (multi === null) {
          convertApprovalToMulti(props.model, props.nodeId, multiSpec);
        } else {
          setApprovalMode(props.model, props.nodeId, multiSpec);
        }
      }
    } catch (e) {
      emit("error", e instanceof Error ? e.message : String(e));
      return;
    }
    // 转换可能同 id 重建节点——统一取当前元素，name 与字段最后写
    const current = currentNode();
    if (current !== undefined) {
      current.set("name", trimmedName === "" ? undefined : trimmedName);
      if (approvalKind.value === "single") {
        current.set("assignee", trimmedAssignee === "" ? undefined : trimmedAssignee);
      }
      // 单/多两形态同口径：formKey 清空保存同样落盘（不残留旧值）
      current.set("formKey", trimmedFormKey === "" ? undefined : trimmedFormKey);
    }
  } else if (isCcTask.value) {
    el.set("name", trimmedName === "" ? undefined : trimmedName);
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
            @click="selectKind(option.key)"
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
