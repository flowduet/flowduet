<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { ElButton, ElDrawer } from "element-plus";
import type { ApprovalDraftOptions, BpmnModel } from "@flowduet/core";
import type { DesignerFormOption } from "../form-options.js";
import {
  readPropertyDraft,
  applyPropertyDraft,
  type FlowPropertyDraft,
} from "../property-editing.js";
import NodePropertyFields from "./NodePropertyFields.vue";
const props = defineProps<{
  model: BpmnModel;
  nodeId?: string | undefined;
  formOptions?: readonly DesignerFormOption[] | undefined;
}>();
const emit = defineEmits<{ saved: []; error: [message: string]; draftModified: [] }>();
const visible = defineModel<boolean>({ default: false });
const model = computed(() => toRaw(props.model));
const draft = ref<FlowPropertyDraft>();
const fieldsRef = ref<InstanceType<typeof NodePropertyFields>>();
watch(
  () => [props.nodeId, visible.value, props.model] as const,
  () => {
    if (!visible.value || props.nodeId === undefined) return;
    try {
      draft.value = readPropertyDraft(model.value, props.nodeId);
    } catch (error) {
      emit("error", error instanceof Error ? error.message : String(error));
      // 保留旧抽屉的可见回填；提交仍由共享规则再次识别真实多实例，拒绝未知配置。
      try {
        const el = model.value.elementOf(props.nodeId);
        draft.value =
          el.$type === "bpmn:UserTask"
            ? {
                kind: "approval",
                name: String(el.get("name") ?? ""),
                approvalKind: "single",
                assignee: String(el.get("assignee") ?? ""),
                formKey: String(el.get("formKey") ?? ""),
              }
            : undefined;
      } catch {
        draft.value = undefined;
      }
    }
  },
  { immediate: true },
);
function update(value: FlowPropertyDraft) {
  draft.value = value;
  emit("draftModified");
}
/** 显式草稿选项仍由调用方提供，默认确定不放宽；容器切换不改业务校验。 */
function commit(options: ApprovalDraftOptions = {}): boolean {
  if (!visible.value || props.nodeId === undefined) return true;
  try {
    model.value.elementOf(props.nodeId);
  } catch {
    visible.value = false;
    return true;
  }
  fieldsRef.value?.flush();
  const captured = fieldsRef.value?.capture();
  if (captured === null) {
    emit("error", "输入法尚未完成本次输入，请完成后重试");
    return false;
  }
  if (captured) draft.value = captured;
  try {
    if (draft.value)
      applyPropertyDraft(model.value, props.nodeId, draft.value, {
        ...options,
        integratedForms: props.formOptions !== undefined,
      });
  } catch (error) {
    emit("error", error instanceof Error ? error.message : String(error));
    return false;
  }
  visible.value = false;
  emit("saved");
  return true;
}
defineExpose({ commit });
</script>
<template>
  <ElDrawer
    v-model="visible"
    :title="draft?.kind === 'branch' ? '分支条件' : draft?.kind === 'cc' ? '抄送节点' : '审批节点'"
    size="360px"
    data-test="node-drawer"
    :modal="false"
  >
    <NodePropertyFields
      ref="fieldsRef"
      v-if="draft"
      :draft="draft"
      :form-options="formOptions"
      :default-form-key="model.defaultFormKey"
      @update:draft="update"
      @unserialized-input="emit('draftModified')"
    />
    <div v-else class="drawer-empty">该元素无可配置字段</div>
    <template #footer
      ><ElButton data-test="drawer-cancel" @click="visible = false">取消</ElButton
      ><ElButton type="primary" data-test="drawer-save" @click="commit()">确定</ElButton></template
    >
  </ElDrawer>
</template>
<style scoped>
.drawer-empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}
</style>
