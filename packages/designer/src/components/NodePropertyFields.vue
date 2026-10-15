<script setup lang="ts">
import { computed, shallowRef, watch, ref, nextTick } from "vue";
import { ElForm, ElFormItem, ElInput } from "element-plus";
import { labelFormOptions, type DesignerFormOption } from "../form-options.js";
import { KIND_OPTIONS, switchApprovalKind, type FlowPropertyDraft } from "../property-editing.js";
const props = defineProps<{
  draft: FlowPropertyDraft;
  formOptions?: readonly DesignerFormOption[] | undefined;
  defaultFormKey?: string | undefined;
}>();
const formRef = ref<InstanceType<typeof ElForm>>();
const draft = shallowRef(props.draft);
watch(
  () => props.draft,
  (value) => {
    draft.value = value;
  },
);
const emit = defineEmits<{
  "update:draft": [draft: FlowPropertyDraft];
  "unserialized-input": [];
}>();
let composing = false;
function compositionStart() {
  composing = true;
  emit("unserialized-input");
}
function compositionEnd() {
  emit("unserialized-input");
  void nextTick(() => {
    composing = false;
  });
}
const labelledFormOptions = computed(() => labelFormOptions(props.formOptions ?? []));
const inheritFormLabel = computed(() => {
  const key = props.defaultFormKey;
  if (key === undefined) return "继承默认（当前未设默认表单）";
  const label = labelledFormOptions.value.find((option) => option.id === key)?.label;
  return label === undefined ? `继承默认（${key}）` : `继承默认（${label}）`;
});
const overrideKeyInvalid = computed(() => {
  if (
    draft.value.kind !== "approval" ||
    props.formOptions === undefined ||
    draft.value.formKey === ""
  )
    return false;
  const key = draft.value.formKey;
  return key !== key.trim() || !props.formOptions.some((option) => option.id === key);
});
function publish(value: FlowPropertyDraft) {
  draft.value = value;
  emit("update:draft", value);
}
function name(value: string) {
  publish({ ...draft.value, name: value });
}
function approval(key: "assignee" | "formKey", value: string) {
  if (draft.value.kind === "approval") publish({ ...draft.value, [key]: value });
}
function selectKind(kind: Extract<FlowPropertyDraft, { kind: "approval" }>["approvalKind"]) {
  if (draft.value.kind === "approval") publish(switchApprovalKind(draft.value, kind));
}
function recipients(value: string) {
  if (draft.value.kind === "cc") publish({ ...draft.value, recipients: value });
}
function condition(value: string) {
  if (draft.value.kind === "branch") publish({ ...draft.value, condition: value });
}
function flush() {
  const root: unknown = formRef.value?.$el;
  const active = root instanceof HTMLElement ? root.ownerDocument.activeElement : null;
  if (root instanceof HTMLElement && active instanceof HTMLElement && root.contains(active))
    active.blur();
}
function capture(): FlowPropertyDraft | null {
  if (composing) return null;
  return { ...draft.value };
}
defineExpose({ flush, capture });
</script>
<template>
  <ElForm
    @compositionstart.capture="compositionStart"
    @compositionend.capture="compositionEnd"
    ref="formRef"
    label-position="top"
    data-test="node-property-fields"
  >
    <ElFormItem label="节点名称">
      <ElInput
        :model-value="draft.name"
        @update:model-value="name"
        data-test="drawer-name"
        placeholder="如：经理审批"
      />
    </ElFormItem>
    <template v-if="draft.kind === 'approval'">
      <ElFormItem :label="draft.approvalKind === 'single' ? '审批人' : '审批人（集合变量）'">
        <ElInput
          :model-value="draft.assignee"
          @update:model-value="approval('assignee', $event)"
          data-test="drawer-assignee"
          :placeholder="
            draft.approvalKind === 'single'
              ? '如 ${manager} 或 张三'
              : '如 approvers，运行时注入名单'
          "
        />
      </ElFormItem>
      <ElFormItem label="完成方式"
        ><div class="kind-cards" data-test="kind-cards">
          <button
            v-for="option in KIND_OPTIONS"
            :key="option.key"
            class="kind-card"
            :class="{ 'kind-card--on': draft.approvalKind === option.key }"
            :data-test="`kind-${option.key}`"
            type="button"
            @click="selectKind(option.key)"
          >
            <span class="kind-card-label">{{ option.label }}</span
            ><span class="kind-card-hint">{{ option.hint }}</span>
          </button>
        </div></ElFormItem
      >
      <ElFormItem v-if="formOptions" label="表单">
        <select
          class="drawer-form-select"
          data-test="drawer-form-select"
          :value="draft.formKey"
          @change="approval('formKey', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" data-test="drawer-form-inherit">{{ inheritFormLabel }}</option>
          <option
            v-for="form in labelledFormOptions"
            :key="form.id"
            :value="form.id"
            :data-test="`drawer-form-option-${form.id}`"
          >
            {{ form.label }}
          </option>
          <option v-if="overrideKeyInvalid" :value="draft.formKey">
            {{ draft.formKey }}（目录外）
          </option>
        </select>
      </ElFormItem>
      <ElFormItem v-else label="表单标识（占位）"
        ><ElInput
          :model-value="draft.formKey"
          @update:model-value="approval('formKey', $event)"
          data-test="drawer-formkey"
          placeholder="如 leave_form_v1"
      /></ElFormItem>
    </template>
    <ElFormItem v-else-if="draft.kind === 'cc'" label="收件人"
      ><ElInput
        :model-value="draft.recipients"
        @update:model-value="recipients"
        data-test="drawer-recipients"
        placeholder="字面量逗号分隔（张三,李四）或表达式（${ccUsers}）"
    /></ElFormItem>
    <ElFormItem v-else-if="draft.kind === 'branch'" label="条件表达式"
      ><ElInput
        :model-value="draft.condition"
        @update:model-value="condition"
        data-test="drawer-condition"
        placeholder="如 ${amount > 1000}；留空表示无条件"
    /></ElFormItem>
  </ElForm>
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

.drawer-form-select {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #303133;
  font-size: 13px;
}
</style>
