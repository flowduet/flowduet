<script setup lang="ts">
import { onBeforeMount, onMounted, ref } from "vue";
import { ElButton } from "element-plus";
import FcDesigner from "@form-create/designer";
import { parseFormOptions } from "../form-schema.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";
import { DESIGNER_CONFIG, FIELD_MENU } from "./designer-config.js";
import { prepareCheckboxDefaults, restoreCheckboxDefaults } from "./checkbox-defaults.js";

/**
 * FormCreate 设计器封装（#72 / #74）：真实开源设计器（@form-create/designer 3.5.0）
 * 承载表单内容编辑，加载 / 保存 rules+options 成对序列化字符串。
 *
 * 组件范围收口（父规格口径，见 designer-config.ts）：菜单整体覆盖为
 * 「八类常用字段 + 栅格布局」，上传、子表单、自定义组件等超范围字段在
 * 本封装内就无从产生（导入侧另有 form-schema 守卫兜底）。配置入口同步
 * 收口：远程数据源、下拉多选、日期范围形态、事件脚本、组件联动均不提供
 * UI 入口；栅格布局只能拖入顶层（checkDrag 拒绝嵌套）。AI 模块关闭
 * （迭代三不接入 Pro / AI 助理）。
 */
const props = defineProps<{
  /** 表单名（展示用） */
  name: string;
  /** 字段规则序列化串（JSON 字符串，空内容传 "[]"） */
  rules: string;
  /** 表单配置序列化串（JSON 字符串） */
  options: string;
}>();

const emit = defineEmits<{
  /** 保存设计器当前内容（rules / options 已成对序列化） */
  save: [rules: string, options: string];
  cancel: [];
  /** 未提交输入或结构编辑也属于当前设计变更。 */
  draftChange: [];
}>();

const designerRef = ref<InstanceType<typeof FcDesigner> | null>(null);
const hostRef = ref<HTMLElement | null>(null);

/** 第三方下拉与选项表格仅发 Vue 事件，交互时保守标记潜在编辑，避免漏报。 */
function onDesignInteraction(event: MouseEvent | KeyboardEvent): void {
  const target = event.target;
  if (target instanceof Element && target.closest(".form-designer-toolbar") !== null) return;
  if (
    event instanceof KeyboardEvent &&
    (event.metaKey || event.ctrlKey || event.key === "Tab" || event.key === "Escape")
  )
    return;
  notifyDraftChange();
}

function notifyDraftChange(): void {
  emit("draftChange");
}

// 宿主未全局安装时补装（画布字段渲染依赖 elm 组件映射注册）
onBeforeMount(ensureFormCreateInstalled);

onMounted(() => {
  const designer = designerRef.value;
  if (designer === null) return;
  designer.setRule(prepareCheckboxDefaults(props.rules) as never);
  designer.setOption(parseFormOptions(props.options) as never);
});

/**
 * 导出当前设计器内容（#76 保存收集边界）：与「保存表单内容」按钮同一序列化
 * 出口，供宿主在保存设计文档前收集编辑器里尚未提交的内容。设计器实例不在场
 * （挂载未完成）时返回 null，调用方据此中止保存而不是误报成功。
 */
function exportContent(): { rules: string; options: string } | null {
  const designer = designerRef.value;
  if (designer === null) return null;
  // ValueInput 在失焦时才提交；快捷键不会自然失焦，先收集本编辑器内的焦点缓冲。
  const active = hostRef.value?.ownerDocument.activeElement;
  if (active instanceof HTMLElement && hostRef.value?.contains(active)) active.blur();
  // getJson / getOptionsJson 即「匹配版本的 FormCreate 序列化接口」成对出口
  const rules = restoreCheckboxDefaults(designer.getJson());
  return { rules: FcDesigner.designerForm.toJson(rules), options: designer.getOptionsJson() };
}

defineExpose({ exportContent });

function save(): void {
  const content = exportContent();
  if (content === null) return;
  emit("save", content.rules, content.options);
}
</script>

<template>
  <div
    ref="hostRef"
    class="form-designer-host"
    data-test="form-designer"
    @click.capture="onDesignInteraction"
    @keydown.capture="onDesignInteraction"
    @input.capture="notifyDraftChange"
    @change.capture="notifyDraftChange"
  >
    <div class="form-designer-toolbar">
      <span class="form-designer-name" data-test="form-designer-name">{{ name }}</span>
      <ElButton size="small" data-test="form-designer-cancel" @click="emit('cancel')"
        >取消</ElButton
      >
      <ElButton size="small" type="primary" data-test="form-designer-save" @click="save">
        保存表单内容
      </ElButton>
    </div>
    <FcDesigner
      ref="designerRef"
      :menu="FIELD_MENU"
      :config="DESIGNER_CONFIG"
      height="460px"
      @create="notifyDraftChange"
      @copy="notifyDraftChange"
      @delete="notifyDraftChange"
      @drag="notifyDraftChange"
      @clear="notifyDraftChange"
      @paste-rule="notifyDraftChange"
      @sort-up="notifyDraftChange"
      @sort-down="notifyDraftChange"
      @change-field="notifyDraftChange"
    />
  </div>
</template>

<style scoped>
.form-designer-host {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.form-designer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-designer-name {
  font-weight: 600;
  margin-right: auto;
}
</style>
