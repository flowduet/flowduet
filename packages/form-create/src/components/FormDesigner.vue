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
}>();

const designerRef = ref<InstanceType<typeof FcDesigner> | null>(null);

// 宿主未全局安装时补装（画布字段渲染依赖 elm 组件映射注册）
onBeforeMount(ensureFormCreateInstalled);

onMounted(() => {
  const designer = designerRef.value;
  if (designer === null) return;
  designer.setRule(prepareCheckboxDefaults(props.rules) as never);
  designer.setOption(parseFormOptions(props.options) as never);
});

function save(): void {
  const designer = designerRef.value;
  if (designer === null) return;
  // getJson / getOptionsJson 即「匹配版本的 FormCreate 序列化接口」成对出口
  const rules = restoreCheckboxDefaults(designer.getJson());
  emit("save", FcDesigner.designerForm.toJson(rules), designer.getOptionsJson());
}
</script>

<template>
  <div class="form-designer-host" data-test="form-designer">
    <div class="form-designer-toolbar">
      <span class="form-designer-name" data-test="form-designer-name">{{ name }}</span>
      <ElButton size="small" data-test="form-designer-cancel" @click="emit('cancel')"
        >取消</ElButton
      >
      <ElButton size="small" type="primary" data-test="form-designer-save" @click="save">
        保存表单内容
      </ElButton>
    </div>
    <FcDesigner ref="designerRef" :menu="FIELD_MENU" :config="DESIGNER_CONFIG" height="460px" />
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
