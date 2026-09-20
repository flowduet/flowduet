<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDrawer, ElForm, ElFormItem, ElInput } from "element-plus";
import type { BpmnModel } from "@flowduet/core";

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
}>();

const visible = defineModel<boolean>({ default: false });

const name = ref("");
const assignee = ref("");

const isTask = computed(() => {
  if (props.nodeId === undefined) return false;
  return props.model.elementOf(props.nodeId).$type === "bpmn:UserTask";
});

watch(
  () => [props.nodeId, visible.value] as const,
  () => {
    if (visible.value && props.nodeId !== undefined) {
      const el = props.model.elementOf(props.nodeId);
      name.value = String(el.get("name") ?? "");
      assignee.value = String(el.get("assignee") ?? "");
    }
  },
);

function save(): void {
  if (props.nodeId === undefined) return;
  // 抽屉打开期间宿主可能已删除该节点——不在此抛未捕获异常
  try {
    const el = props.model.elementOf(props.nodeId);
    el.set("name", name.value.trim() === "" ? undefined : name.value);
    el.set("assignee", assignee.value.trim() === "" ? undefined : assignee.value);
  } catch {
    visible.value = false;
    return;
  }
  visible.value = false;
  emit("saved");
}
</script>

<template>
  <ElDrawer v-model="visible" title="审批节点" size="360px" data-test="node-drawer">
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
    <template #footer>
      <ElButton data-test="drawer-cancel" @click="visible = false">取消</ElButton>
      <ElButton type="primary" data-test="drawer-save" @click="save">确定</ElButton>
    </template>
  </ElDrawer>
</template>
