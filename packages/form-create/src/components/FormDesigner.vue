<script setup lang="ts">
import { onBeforeMount, onMounted, ref } from "vue";
import { ElButton } from "element-plus";
import FcDesigner from "@form-create/designer";
import type { Config } from "@form-create/designer/types/index.d";
import { parseFormOptions } from "../form-schema.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";

/**
 * FormCreate 设计器封装（#72）：真实开源设计器（@form-create/designer 3.5.0）
 * 承载表单内容编辑，加载 / 保存 rules+options 成对序列化字符串。
 *
 * 组件范围收口：menu 整体覆盖为「仅文本字段」——拖拽面板只有 input 一项，
 * 超范围字段在本封装内就无从产生（导入侧另有 form-schema 守卫兜底）。
 * AI 模块关闭（迭代三不接入 Pro / AI 助理）。
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

/** 菜单列表整体覆盖：只有文本字段（name 对应 DragRule 的 name，icon 为包内样式类） */
const TEXT_ONLY_MENU = [
  {
    name: "main",
    title: "文本字段",
    list: [{ label: "文本", name: "input", icon: "icon-input" }],
  },
];

const DESIGNER_CONFIG: Config = {
  // 不接入 AI 助理（Pro 能力红线，ADR-0006）
  showAi: false,
  // 验证面板只保留必填：本票字段配置面就是「默认值 + 必填」
  validateOnlyRequired: true,
  showSaveBtn: false,
  showDevice: false,
  showLanguage: false,
};

// 宿主未全局安装时补装（画布字段渲染依赖 elm 组件映射注册）
onBeforeMount(ensureFormCreateInstalled);

onMounted(() => {
  const designer = designerRef.value;
  if (designer === null) return;
  designer.setRule(props.rules);
  designer.setOption(parseFormOptions(props.options) as never);
});

function save(): void {
  const designer = designerRef.value;
  if (designer === null) return;
  // getJson / getOptionsJson 即「匹配版本的 FormCreate 序列化接口」成对出口
  emit("save", designer.getJson(), designer.getOptionsJson());
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
    <FcDesigner ref="designerRef" :menu="TEXT_ONLY_MENU" :config="DESIGNER_CONFIG" height="460px" />
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
