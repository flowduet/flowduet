<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { ElButton, ElDrawer } from "element-plus";
import type { ApprovalDraftOptions, BpmnModel } from "@flowduet/core";
import type { DesignerFormOption } from "../form-options.js";
import type { ResolvedComponentAppearance } from "../appearance.js";
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
  appearance?: ResolvedComponentAppearance | undefined;
  appearanceStyle?: Record<string, string> | undefined;
}>();
const emit = defineEmits<{ saved: []; error: [message: string]; draftModified: [] }>();
const visible = defineModel<boolean>({ default: false });
const model = computed(() => toRaw(props.model));
const epSize = computed(() => {
  if (props.appearance === undefined) return "";
  return props.appearance.density === "compact" ? "small" : "default";
});
const drawerClass = computed(() => {
  const appearance = props.appearance;
  if (appearance === undefined) return "flowduet-node-drawer";
  return [
    "flowduet-node-drawer",
    "flowduet-appearance",
    `flowduet-appearance--${appearance.colorSource}`,
    `flowduet-appearance--${appearance.mode}`,
    `flowduet-appearance--${appearance.density}`,
  ];
});
const draft = ref<FlowPropertyDraft>();
const drawerTitle = computed(() => {
  if (draft.value?.kind === "branch") return "分支条件";
  if (draft.value?.kind === "cc") return "抄送节点";
  if (draft.value === undefined && props.appearance !== undefined) return "节点属性";
  return "审批节点";
});
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
    :title="drawerTitle"
    size="360px"
    data-test="node-drawer"
    :modal="false"
    :class="drawerClass"
    :style="appearanceStyle"
  >
    <NodePropertyFields
      ref="fieldsRef"
      v-if="draft"
      :draft="draft"
      :form-options="formOptions"
      :default-form-key="model.defaultFormKey"
      :size="epSize"
      @update:draft="update"
      @unserialized-input="emit('draftModified')"
    />
    <div v-else class="drawer-empty">该元素无可配置字段</div>
    <template #footer
      ><ElButton :size="epSize" data-test="drawer-cancel" @click="visible = false">取消</ElButton
      ><ElButton :size="epSize" type="primary" data-test="drawer-save" @click="commit()"
        >确定</ElButton
      ></template
    >
  </ElDrawer>
</template>
<style>
.flowduet-node-drawer .drawer-empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}

.flowduet-node-drawer.flowduet-appearance {
  font-family: var(--fd-font-family);
}

.flowduet-node-drawer.flowduet-appearance .el-drawer__header {
  margin-bottom: 0;
  padding: var(--fd-panel-padding);
}

.flowduet-node-drawer.flowduet-appearance .el-drawer__title {
  font-size: 20px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.flowduet-node-drawer.flowduet-appearance .el-drawer__body {
  padding: var(--fd-panel-padding);
}

.flowduet-node-drawer.flowduet-appearance .el-drawer__footer {
  padding: var(--fd-panel-padding);
  padding-top: 0;
}

.flowduet-node-drawer.flowduet-appearance .drawer-empty {
  color: var(--fd-muted);
  line-height: 1.6;
}

/* 品牌预设只改当前抽屉的 EP 本体变量，复合抽屉类使权重高于宿主 html.dark 派生规则；跟随宿主不命中。 */
.flowduet-node-drawer.flowduet-appearance--brand {
  background: var(--fd-surface);
  color: var(--fd-text);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-drawer__header {
  border-bottom: 1px solid var(--fd-border);
  color: var(--fd-text);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-drawer__close-btn {
  color: var(--fd-secondary);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-drawer__close-btn:focus-visible {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}

.flowduet-node-drawer.flowduet-appearance--brand .el-drawer__footer {
  border-top: 1px solid var(--fd-border);
  padding-top: var(--fd-panel-padding);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-input {
  --el-input-text-color: var(--fd-text);
  --el-input-bg-color: var(--fd-surface);
  --el-input-border-color: var(--fd-control-border);
  --el-input-placeholder-color: var(--fd-muted);
  --el-input-focus-border-color: var(--fd-focus);
  --el-input-hover-border-color: var(--fd-control-border);
  --el-input-border-radius: var(--fd-radius);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-input__wrapper:focus-within {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}

.flowduet-node-drawer.flowduet-appearance--brand .el-button {
  --el-button-text-color: var(--fd-text);
  --el-button-bg-color: var(--fd-surface);
  --el-button-border-color: var(--fd-control-border);
  --el-button-hover-text-color: var(--fd-text);
  --el-button-hover-bg-color: var(--fd-inset);
  --el-button-hover-border-color: var(--fd-control-border);
  --el-button-active-text-color: var(--fd-text);
  --el-button-active-bg-color: var(--fd-inset);
  --el-button-active-border-color: var(--fd-control-border);
  --el-button-disabled-text-color: var(--fd-disabled-text);
  --el-button-disabled-bg-color: var(--fd-disabled-surface);
  --el-button-disabled-border-color: var(--fd-border);
  --el-button-outline-color: var(--fd-focus);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-button--primary {
  --el-button-text-color: var(--fd-on-primary);
  --el-button-bg-color: var(--fd-primary);
  --el-button-border-color: var(--fd-primary);
  --el-button-hover-text-color: var(--fd-on-primary);
  --el-button-hover-bg-color: var(--fd-primary-hover);
  --el-button-hover-border-color: var(--fd-primary-hover);
  --el-button-active-text-color: var(--fd-on-primary);
  --el-button-active-bg-color: var(--fd-primary-pressed);
  --el-button-active-border-color: var(--fd-primary-pressed);
}

.flowduet-node-drawer.flowduet-appearance--brand .el-button:focus-visible {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}
</style>
