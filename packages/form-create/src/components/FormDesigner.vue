<script setup lang="ts">
import { nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElButton } from "element-plus";
import FcDesigner from "@form-create/designer";
import { parseFormOptions } from "../form-schema.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";
import { DESIGNER_CONFIG, FIELD_MENU, retainedDesignerConfig } from "./designer-config.js";
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
import type {
  FormDesignerBlocker,
  FormDesignerEditingState,
  FormDesignerCaptureResult,
} from "../editor-state.js";
import { createEditorInputState, createEditorInstanceKey } from "./editor-input-state.js";
import NumberDefaultEditor from "./NumberDefaultEditor.vue";
import DateDefaultEditor from "./DateDefaultEditor.vue";

const props = defineProps<{
  /** 表单名（展示用） */
  name: string;
  editingMode?: "legacy" | "retained";
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
  editingStateChange: [state: FormDesignerEditingState];
}>();

const designerRef = ref<InstanceType<typeof FcDesigner> | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const mode = props.editingMode ?? "legacy";
const owner = `flowduet-calendar-${createEditorInstanceKey()}`;
let revision = 0,
  ready = false,
  disposed = false,
  dragging = false,
  dragSettling = false,
  foreignComposition = false;
let changedMode = false,
  replaced = false;
const pendingControls = new Map<Element, symbol>();
const focusValues = new WeakMap<Element, string>();
const captureError = ref("");
const inputState = createEditorInputState((edited) => {
  if (edited) {
    revision++;
    emit("draftChange");
  }
  notifyState();
});
const config =
  mode === "retained"
    ? {
        ...retainedDesignerConfig((source) => inputState.bind(source), owner),
        // 普通字段的delete事件晚于属性区移除；公开前置钩子先记录仍在场的控件。
        beforeRemoveRule: releaseRemovedControls,
      }
    : DESIGNER_CONFIG;
function blockers(): FormDesignerBlocker[] {
  if (disposed) return [{ code: "disposed", message: "编辑器已销毁" }];
  if (mode !== "retained" || changedMode)
    return [
      { code: "unsupported-mode", message: "编辑模式仅在挂载时确定；legacy请使用exportContent" },
    ];
  if (!ready) return [{ code: "not-ready", message: "编辑器尚未准备好" }];
  if (replaced)
    return [{ code: "version-changed", message: "外部定义发生替换，请保留输入并确认替换" }];
  const result = inputState.blockers();
  // visible-change在弹层动画结束后才通知；公开ARIA展开状态覆盖动画开始的窗口。
  if (
    hostRef.value?.querySelector(
      '[role="combobox"][aria-expanded="true"], input[aria-expanded="true"]',
    )
  )
    result.push({ code: "pending-update", message: "请先确认或关闭本编辑器的弹层" });

  if (foreignComposition) result.push({ code: "composing", message: "属性输入法组合尚未确认" });
  if (dragging || dragSettling)
    result.push({ code: "dragging", message: "拖动尚未确认结束，P3取消能力尚未提供" });
  if (pendingControls.size)
    result.push({ code: "pending-update", message: "请先在原属性控件中确认当前输入" });
  return result;
}
function readEditingState(): FormDesignerEditingState {
  const issues = blockers();
  return Object.freeze({
    mode,
    revision,
    canSuspend: issues.every((b) => b.code === "pending-input" || b.code === "unsupported-input"),
    canCapture: issues.length === 0,
    blockers: Object.freeze(issues.map((b) => Object.freeze(b))),
  });
}
function notifyState() {
  if (mode === "retained" && !disposed) emit("editingStateChange", readEditingState());
}
watch(
  () => props.editingMode,
  (value) => {
    if ((value ?? "legacy") !== mode) {
      changedMode = true;
      revision++;
      notifyState();
    }
  },
  { flush: "sync" },
);
watch(
  () => [props.rules, props.options],
  () => {
    if (mode === "retained") {
      replaced = true;
      revision++;
      notifyState();
    }
  },
  { flush: "sync" },
);
function nativeInput(event: Event) {
  // 自有输入已由缓冲控制器记账；失焦产生的change不是新的设计修改。
  if (
    mode === "retained" &&
    event.target instanceof Element &&
    event.target.matches("[data-retained-input]")
  )
    return;
  if (
    mode === "retained" &&
    event.target instanceof Element &&
    !event.target.matches("[data-retained-input]")
  ) {
    const target = event.target;
    const token = Symbol();
    pendingControls.set(target, token);
    // 恢复聚焦前原值时浏览器不会发change；仍须等本次公开输入回填完成。
    if (
      event.type === "change" ||
      (controlValue(target) !== undefined && controlValue(target) === focusValues.get(target))
    )
      confirmControl(target, token);
    notifyState();
  }
  notifyDraftChange();
}
function controlValue(target: Element): string | undefined {
  // 原生number的非法中间串也可能显示为空；不能把badInput误判成恢复空值。
  if (hasBadInput(target)) return undefined;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
    ? target.value
    : undefined;
}
function hasBadInput(target: Element): boolean {
  return target instanceof HTMLInputElement && target.validity.badInput;
}
function confirmControl(target: Element, token: symbol) {
  const value = controlValue(target);
  void nextTick(() => {
    // 旧change/恢复回调不能放行同一控件在该tick内更新后的输入。
    if (
      disposed ||
      hasBadInput(target) ||
      pendingControls.get(target) !== token ||
      controlValue(target) !== value
    )
      return;
    pendingControls.delete(target);
    if (value !== undefined) focusValues.set(target, value);
    notifyState();
  });
}
function focusIn(event: FocusEvent) {
  if (mode !== "retained") return;
  const target = event.target;
  if (target instanceof Element && !pendingControls.has(target)) {
    const value = controlValue(target);
    if (value !== undefined) focusValues.set(target, value);
  }
  void nextTick(notifyState);
}
function releaseRemovedControls() {
  // 仅在已确认delete/clear的结构操作中回收其实际移除的控件；K隐藏、切字段不走此路。
  const connected = [...pendingControls].filter(([target]) => hostRef.value?.contains(target));
  queueMicrotask(() => {
    // 前置钩子早于provider排入Vue更新；先让同步删除结束，再等待那一次刷新。
    void nextTick(() => {
      if (disposed) return;
      for (const [target, token] of connected)
        if (!hostRef.value?.contains(target) && pendingControls.get(target) === token) {
          pendingControls.delete(target);
          focusValues.delete(target);
        }
      notifyState();
    });
  });
}
function composition(event: CompositionEvent) {
  if (
    mode !== "retained" ||
    (event.target instanceof Element && event.target.matches("[data-retained-input]"))
  )
    return;
  foreignComposition = true;
  revision++;
  notifyState();
  if (event.type === "compositionend")
    void nextTick(() => {
      foreignComposition = false;
      notifyState();
    });
}
function drag(event: DragEvent) {
  if (mode !== "retained") return;
  if (event.type === "dragstart") {
    dragging = true;
    revision++;
    notifyState();
  } else {
    dragging = false;
    dragSettling = true;
    notifyState();
    void nextTick(() => {
      dragSettling = false;
      notifyState();
    });
  }
}
function removeField(source: Parameters<typeof inputState.release>[0]) {
  if (mode === "retained") {
    releaseRemovedControls();
    inputState.release(source);
  }
  notifyDraftChange();
}
function clearFields() {
  if (mode === "retained") {
    releaseRemovedControls();
    inputState.clear();
  }
  notifyDraftChange();
}
onBeforeUnmount(() => {
  disposed = true;
  inputState.clear();
  pendingControls.clear();
});

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
  if (mode === "retained") void nextTick(notifyState);
}

function notifyDraftChange(): void {
  if (mode === "retained") {
    revision++;
    notifyState();
  }
  emit("draftChange");
}

// 宿主未全局安装时补装（画布字段渲染依赖 elm 组件映射注册）
onBeforeMount(() => {
  ensureFormCreateInstalled();
  if (mode === "retained") {
    FcDesigner.component("flowduetNumberDefault", NumberDefaultEditor);
    FcDesigner.component("flowduetDateDefault", DateDefaultEditor);
  }
});

onMounted(() => {
  const designer = designerRef.value;
  if (designer === null) return;
  designer.setRule(prepareCheckboxDefaults(props.rules) as never);
  designer.setOption(parseFormOptions(props.options) as never);
  void nextTick(() => {
    ready = true;
    notifyState();
  });
});

/**
 * 导出当前设计器内容（#76 保存收集边界）：与「保存表单内容」按钮同一序列化
 * 出口，供宿主在保存设计文档前收集编辑器里尚未提交的内容。设计器实例不在场
 * （挂载未完成）时返回 null，调用方据此中止保存而不是误报成功。
 */
function exportContent(): { rules: string; options: string } | null {
  if (mode === "retained") {
    const result = captureContent();
    if (result.status === "captured") return result.content;
    if (result.status === "failed") throw new Error(result.message);
    captureError.value = result.blockers.map((b) => b.message).join("；");
    return null;
  }
  const designer = designerRef.value;
  if (designer === null) return null;
  // ValueInput 在失焦时才提交；快捷键不会自然失焦，先收集本编辑器内的焦点缓冲。
  const active = hostRef.value?.ownerDocument.activeElement;
  if (active instanceof HTMLElement && hostRef.value?.contains(active)) active.blur();
  // getJson / getOptionsJson 即「匹配版本的 FormCreate 序列化接口」成对出口
  const rules = restoreCheckboxDefaults(designer.getJson());
  return { rules: FcDesigner.designerForm.toJson(rules), options: designer.getOptionsJson() };
}

function captureContent(): FormDesignerCaptureResult {
  const before = readEditingState();
  if (!before.canCapture) return { status: "blocked", blockers: before.blockers };
  const designer = designerRef.value;
  if (!designer)
    return { status: "blocked", blockers: [{ code: "not-ready", message: "编辑器尚未准备好" }] };
  try {
    const rules = restoreCheckboxDefaults(designer.getJson());
    const content = {
      rules: FcDesigner.designerForm.toJson(rules),
      options: designer.getOptionsJson(),
    };
    const after = readEditingState();
    if (after.revision !== before.revision || !after.canCapture)
      return {
        status: "blocked",
        blockers: [{ code: "version-changed", message: "捕获期间输入已变化，请重新收集" }],
      };
    return { status: "captured", revision: before.revision, content };
  } catch (error) {
    return { status: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}
defineExpose({ exportContent, readEditingState, captureContent });

function save(): void {
  let content;
  try {
    content = exportContent();
  } catch (error) {
    if (mode === "legacy") throw error;
    captureError.value = error instanceof Error ? error.message : String(error);
    return;
  }
  if (content === null) return;
  captureError.value = "";
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
    @input.capture="nativeInput"
    @change.capture="nativeInput"
    @compositionstart.capture="composition"
    @compositionend.capture="composition"
    @focusin.capture="focusIn"
    @dragstart.capture="drag"
    @dragend.capture="drag"
  >
    <div class="form-designer-toolbar">
      <span class="form-designer-name" data-test="form-designer-name">{{ name }}</span>
      <ElButton
        size="small"
        data-test="form-designer-cancel"
        data-form-close-control
        @click="emit('cancel')"
        >取消</ElButton
      >
      <ElButton size="small" type="primary" data-test="form-designer-save" @click="save">
        保存表单内容
      </ElButton>
    </div>
    <p v-if="captureError" role="alert">{{ captureError }}</p>
    <FcDesigner
      ref="designerRef"
      :menu="FIELD_MENU"
      :config="config"
      height="460px"
      @create="notifyDraftChange"
      @copy="notifyDraftChange"
      @delete="removeField"
      @drag="notifyDraftChange"
      @clear="clearFields"
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
