<script setup lang="ts">
import {
  computed,
  markRaw,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
  type DefineComponent,
} from "vue";
import { ElButton, ElConfigProvider } from "element-plus";
import formCreateFactory from "@form-create/element-ui";
import {
  createAppearanceVariables,
  readHostAppearance,
  resolveComponentAppearance,
  type ComponentAppearance,
  type HostAppearanceContext,
  type ResolvedComponentAppearance,
} from "@flowduet/designer";
import type { FormDefinition } from "../document.js";
import { parseFormOptions, parseFormRules, type FieldRule } from "../form-schema.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";
import { nextFormPreviewInstanceId } from "./form-preview-instance.js";
import { brandDatePopperCss, hostDatePopperCss } from "./date-popper-style.js";
import { explicitSelectPopperCss, hostSelectPopperCss } from "./select-popper-style.js";

/**
 * 表单预览（#72）：真实 FormCreate 渲染器（@form-create/element-ui 3.3.4）试填。
 * 试填状态与设计定义隔离：值只进本地 trialValue，不回写 rules/options、
 * 不进设计文档；切换表单或重新打开同 ID 文档时重置（A09/A10/A41 相关）。
 */
const props = defineProps<{
  form: FormDefinition;
  /** 显式启用的实例外观；省略时保持既有预览路径。 */
  appearance?: ComponentAppearance | undefined;
}>();

// markRaw：组件是工厂产物（含大量内部状态），避免被响应式代理拖累
const FormCreateRenderer = markRaw(formCreateFactory.$form());
// EP 2.14.6 声明在 exactOptionalPropertyTypes 下误把 ConfigProvider size 暴露为 prop 配置对象。
// 仅校正其公开运行时输入；旧路径省略 size，避免内层空值覆盖宿主继承。
const PreviewConfigProvider = ElConfigProvider as unknown as DefineComponent<{
  size?: "default" | "small";
}>;

// 宿主未全局安装时补装（elm 组件映射注册进实例，否则字段渲染不出来）
onBeforeMount(ensureFormCreateInstalled);

const trialValue = ref<Record<string, unknown>>({});
const rendererVersion = ref(0);
/** fApi：渲染器挂载后经 update:api 事件交付（form-create v3 约定），用于触发校验 */
const fApi = ref<{ validate?: (cb: (result: unknown) => void) => unknown } | null>(null);
const validation = ref<{ ok: boolean; message: string } | null>(null);

const hostRef = ref<HTMLElement>();
const instanceId = nextFormPreviewInstanceId();
const selectPopperClass = `flowduet-form-preview-select-${instanceId}`;
const datePopperClass = `flowduet-form-preview-date-${instanceId}`;
const selectPopperClasses = reactive<Record<string, boolean>>({
  [selectPopperClass]: false,
});
const datePopperClasses = reactive<Record<string, boolean>>({
  [datePopperClass]: false,
});
let selectPopperStyleElement: HTMLStyleElement | undefined;
let datePopperStyleElement: HTMLStyleElement | undefined;
const previewAppearance = shallowRef<ResolvedComponentAppearance>();
const hostAppearance = shallowRef<HostAppearanceContext>();
let disposed = false;
let sampleTicket = 0;
onBeforeUnmount(() => {
  disposed = true;
  removeSelectPopperStyle();
  removeDatePopperStyle();
});
function refreshHostAppearance(): void {
  if (disposed) return;
  hostAppearance.value =
    previewAppearance.value?.colorSource === "host"
      ? readHostAppearance(hostRef.value, previewAppearance.value.mode)
      : undefined;
}
watch(
  () => props.appearance,
  async (value) => {
    if (disposed) return;
    const previous = previewAppearance.value;
    const resolved = resolveComponentAppearance(value, previous);
    previewAppearance.value = resolved;
    // 非法配置保留上次有效结果及其宿主快照，合法启停才重新读取。
    if (resolved === previous) return;
    const ticket = ++sampleTicket;
    // 票据只随合法变化推进：非法输入不得取消已排队的合法采样，合法连切只保留最后一次。
    // 先移除本实例旧品牌 EP 变量再读宿主，避免迟到采样覆盖新状态。
    await nextTick();
    if (ticket === sampleTicket) refreshHostAppearance();
  },
  // 后置冲刷先完成宿主同周期主题类／变量补丁，再安排实例变量更新。
  { immediate: true, flush: "post" },
);
onMounted(() => {
  refreshHostAppearance();
  syncSelectPopperStyle();
  syncDatePopperStyle();
});
const previewClass = computed(() => {
  const appearance = previewAppearance.value;
  if (appearance === undefined) return "form-preview";
  return [
    "form-preview",
    "flowduet-appearance",
    `flowduet-appearance--${appearance.colorSource}`,
    `flowduet-appearance--${appearance.mode}`,
    `flowduet-appearance--${appearance.density}`,
  ];
});
const previewStyle = computed(() =>
  createAppearanceVariables(previewAppearance.value, hostAppearance.value),
);
const rendererConfig = computed<{ size?: "default" | "small" }>(() => {
  const appearance = previewAppearance.value;
  if (appearance === undefined) return {};
  return { size: appearance.density === "compact" ? "small" : "default" };
});
const actionSize = computed(() => {
  const appearance = previewAppearance.value;
  if (appearance === undefined || appearance.density === "compact") return "small" as const;
  return "default" as const;
});

// 定义换代时重建渲染器：相同默认值会被旧实例视为未变而省略更新通知。
watch(
  () => props.form,
  () => {
    rendererVersion.value += 1;
    trialValue.value = {};
    fApi.value = null;
    validation.value = null;
  },
);

const contentError = computed<string | null>(() => {
  try {
    parseFormRules(props.form.rules);
    parseFormOptions(props.form.options);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
});

const appearanceEnabled = computed(() => previewAppearance.value !== undefined);

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type PopperRuleType = "select" | "datePicker";

function globalPopperProps(type: PopperRuleType): Record<string, unknown> {
  const options = parseFormOptions(props.form.options);
  const global = record(options.global);
  // 与 FormCreate 的全局默认→组件默认→字段配置顺序一致，不能让实例标识遮住全局业务类。
  return {
    ...record(record(global["*"] || global.default).props),
    ...record(record(global[type]).props),
  };
}

// 仅修改解析后的临时规则树：实例标识稳定，规则身份只随定义换代。
function adaptPopperRules(
  rules: FieldRule[],
  type: PopperRuleType,
  defaults: Record<string, unknown>,
  instanceClasses: Record<string, boolean>,
): FieldRule[] {
  return rules.map((item) => {
    const children = Array.isArray(item.children)
      ? adaptPopperRules(item.children as FieldRule[], type, defaults, instanceClasses)
      : item.children;
    if (item.type !== type) return children === item.children ? item : { ...item, children };
    if (
      item.props !== undefined &&
      (typeof item.props !== "object" || item.props === null || Array.isArray(item.props))
    )
      return item;
    const fieldProps = (item.props ?? {}) as Record<string, unknown>;
    const businessClass =
      fieldProps.popperClass === undefined ? defaults.popperClass : fieldProps.popperClass;
    const popperClass =
      businessClass === undefined ? instanceClasses : [businessClass, instanceClasses];
    return {
      ...item,
      ...(children === item.children ? {} : { children }),
      props: { ...fieldProps, popperClass },
    };
  });
}

const rule = computed(() => {
  if (contentError.value !== null) return [];
  const parsed = parseFormRules(props.form.rules);
  const selected = adaptPopperRules(
    parsed,
    "select",
    globalPopperProps("select"),
    selectPopperClasses,
  );
  return adaptPopperRules(
    selected,
    "datePicker",
    globalPopperProps("datePicker"),
    datePopperClasses,
  );
});

function containsRuleType(rules: FieldRule[], type: PopperRuleType): boolean {
  return rules.some(
    (item) =>
      item.type === type ||
      (Array.isArray(item.children) && containsRuleType(item.children as FieldRule[], type)),
  );
}
const hasSelectRule = computed(() => containsRuleType(rule.value, "select"));
const hasDateRule = computed(() => containsRuleType(rule.value, "datePicker"));

function removeDatePopperStyle(): void {
  datePopperStyleElement?.remove();
  datePopperStyleElement = undefined;
}

function removeSelectPopperStyle(): void {
  selectPopperStyleElement?.remove();
  selectPopperStyleElement = undefined;
}

// Teleport 后面板不继承预览根；用唯一类承载实例变量，业务 inline popperStyle 仍自然优先。
function syncSelectPopperStyle(): void {
  const appearance = previewAppearance.value;
  const host = hostRef.value;
  selectPopperClasses[selectPopperClass] = appearance !== undefined;
  if (disposed || appearance === undefined || !hasSelectRule.value || host === undefined) {
    removeSelectPopperStyle();
    return;
  }
  const owner = `.el-select__popper.${selectPopperClass}`;
  const variables = Object.entries(previewStyle.value ?? {})
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  const brand = appearance.colorSource === "brand";
  // 密度只补缺省行高；显式高度／最大高度需解除新增下限，文本继续继承选项的换行约定。
  const css = `
${owner}{${variables}}
${owner} .el-select-dropdown__item{display:flex;align-items:center;box-sizing:border-box;min-height:var(--fd-control-height);height:auto;font-size:var(--fd-control-font-size);line-height:1.6;white-space:normal;overflow-wrap:anywhere}
${owner} .el-select-dropdown__item:is([style^="height:"],[style*="; height:"],[style^="max-height:"],[style*="; max-height:"]){min-height:0}
${owner} .el-select-dropdown__item>span{min-width:0;white-space:inherit;overflow-wrap:inherit}
${owner} .el-select-dropdown__empty{font-size:var(--fd-control-font-size)}
${
  brand
    ? `${owner} .el-select-dropdown__item.is-hovering{background-color:var(--fd-inset)}
${owner} .el-select-dropdown__item.is-selected{color:var(--fd-primary-ink);background-color:var(--fd-primary-soft)}
${owner} .el-select-dropdown__item.is-disabled{color:var(--fd-disabled-text)}
${explicitSelectPopperCss(owner)}`
    : hostAppearance.value === undefined
      ? ""
      : hostSelectPopperCss(owner, host, hostAppearance.value)
}`;
  if (selectPopperStyleElement === undefined) {
    selectPopperStyleElement = host.ownerDocument.createElement("style");
    host.ownerDocument.head.append(selectPopperStyleElement);
  }
  selectPopperStyleElement.textContent = css;
}
watch([previewAppearance, previewStyle, hasSelectRule], syncSelectPopperStyle, {
  immediate: true,
  flush: "post",
});

// 日期与实际时间子面板同属一个 Popper；外层实例类覆盖两者，无需额外 DOM 监听。
function syncDatePopperStyle(): void {
  const appearance = previewAppearance.value;
  const host = hostRef.value;
  datePopperClasses[datePopperClass] = appearance !== undefined;
  if (disposed || appearance === undefined || !hasDateRule.value || host === undefined) {
    removeDatePopperStyle();
    return;
  }
  const owner = `.el-picker__popper.${datePopperClass}`;
  const variables = Object.entries(previewStyle.value ?? {})
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  const css = `
${owner}{${variables}}
${
  appearance.colorSource === "brand"
    ? brandDatePopperCss(owner)
    : hostAppearance.value === undefined
      ? ""
      : hostDatePopperCss(owner, host, hostAppearance.value)
}`;
  if (datePopperStyleElement === undefined) {
    datePopperStyleElement = host.ownerDocument.createElement("style");
    host.ownerDocument.head.append(datePopperStyleElement);
  }
  datePopperStyleElement.textContent = css;
}
watch([previewAppearance, previewStyle, hasDateRule], syncDatePopperStyle, {
  immediate: true,
  flush: "post",
});

const option = computed(() => {
  if (contentError.value !== null) return {};
  const parsed = parseFormOptions(props.form.options);
  if (!appearanceEnabled.value) return parsed;
  const form = parsed.form;
  // 只给缺省标签位置补 R2 顶置；异常形态与所有显式值继续交给原渲染器处理。
  if (form !== undefined && (typeof form !== "object" || form === null || Array.isArray(form)))
    return parsed;
  return { ...parsed, form: { labelPosition: "top", ...form } };
});

function onApi(api: unknown): void {
  fApi.value = api as { validate?: (cb: (result: unknown) => void) => unknown };
}

function validate(): void {
  const api = fApi.value?.validate;
  if (typeof api !== "function") return;
  const updateValidation = (result: unknown): void => {
    // form-create 合同：校验通过回调收字面 true；失败收 truthy 的错误对象
    validation.value =
      result === true
        ? { ok: true, message: "校验通过" }
        : { ok: false, message: "校验未通过：请按字段提示补填（见上方错误信息）" };
  };
  try {
    // FormCreate 同时用回调反馈结果、用 Promise 表示校验成败；失败时两条通道都会触发。
    // 消费 Promise 拒绝，避免预览已显示字段错误后仍向浏览器泄漏未处理异常。
    void Promise.resolve(api.call(fApi.value, updateValidation)).catch(updateValidation);
  } catch (e) {
    updateValidation(e);
  }
}
</script>

<template>
  <div ref="hostRef" :class="previewClass" :style="previewStyle" data-test="form-preview">
    <p v-if="contentError" class="form-preview-error" data-test="form-preview-error">
      表单内容无法解析：{{ contentError }}
    </p>
    <template v-else>
      <PreviewConfigProvider v-bind="rendererConfig">
        <component
          :is="FormCreateRenderer"
          :key="rendererVersion"
          v-model="trialValue"
          :rule="rule"
          :option="option"
          data-test="form-preview-render"
          @update:api="onApi"
        />
      </PreviewConfigProvider>
      <div class="form-preview-actions">
        <ElButton :size="actionSize" data-test="form-preview-validate" @click="validate">
          触发校验
        </ElButton>
        <span
          v-if="validation"
          class="form-preview-validation"
          :class="{ 'form-preview-validation--ok': validation.ok }"
          data-test="form-preview-validation"
        >
          {{ validation.message }}
        </span>
      </div>
      <div class="form-preview-values">
        <span class="form-preview-values-label">当前试填值（与设计默认值隔离，不随文档保存）</span>
        <pre data-test="form-preview-values">{{ JSON.stringify(trialValue, null, 2) }}</pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.form-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-preview-error {
  color: #e5484d;
  font-size: 13px;
  white-space: pre-wrap;
}

.form-preview-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-preview-validation {
  color: #e5484d;
  font-size: 13px;
}

.form-preview-validation--ok {
  color: #529b2e;
}

.form-preview-values {
  border-top: 1px dashed #dcdfe6;
  padding-top: 8px;
}

.form-preview-values-label {
  font-size: 12px;
  color: #909399;
}

.form-preview-values pre {
  margin: 4px 0 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
}

/* 新适配只作用于公开 FormPreview 实例；旧路径继续消费上方原值。 */
.form-preview.flowduet-appearance {
  box-sizing: border-box;
  padding: var(--fd-panel-padding);
  border-radius: var(--fd-radius);
  background: var(--fd-surface);
  color: var(--fd-text);
  font-family: var(--fd-font-family);
}

.form-preview.flowduet-appearance .form-preview-error,
.form-preview.flowduet-appearance .form-preview-validation {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.form-preview.flowduet-appearance .form-preview-error,
.form-preview.flowduet-appearance .form-preview-validation:not(.form-preview-validation--ok) {
  color: var(--fd-danger);
}

.form-preview.flowduet-appearance .form-preview-validation--ok {
  color: var(--fd-success);
}

.form-preview.flowduet-appearance .form-preview-actions {
  flex-wrap: wrap;
  gap: var(--fd-row-gap);
}

.form-preview.flowduet-appearance .form-preview-values {
  border-top-color: var(--fd-border);
}

.form-preview.flowduet-appearance .form-preview-values-label {
  color: var(--fd-secondary);
  line-height: 1.6;
}

.form-preview.flowduet-appearance .form-preview-values pre {
  background: var(--fd-inset);
  color: var(--fd-text);
  border-radius: var(--fd-radius);
}

/* EP 的 border 简写在宿主根解析；品牌实例需局部重建，不能只改 border-color。 */
.form-preview.flowduet-appearance--brand {
  --el-border: 1px solid var(--fd-control-border);
}

/* FormCreate 深层 EP 节点必须带预览根作用域，权重不依赖宿主样式导入顺序。 */
:global(.form-preview.flowduet-appearance .el-form-item) {
  margin-bottom: var(--fd-field-gap);
}

:global(.form-preview.flowduet-appearance .el-form-item__label) {
  color: var(--fd-secondary);
  font-family: var(--fd-font-family);
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

:global(.form-preview.flowduet-appearance .el-form-item__error) {
  position: static;
  padding-top: 4px;
  color: var(--fd-danger);
  line-height: 1.6;
  white-space: normal;
  overflow-wrap: anywhere;
}

:global(.form-preview.flowduet-appearance :is(.el-radio-group, .el-checkbox-group)) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fd-row-gap);
  max-width: 100%;
}

/* 高度由标签行高和上下 padding 组成，长标签自然撑开；显式 height 在 border-box 下保持原值。 */
:global(.form-preview.flowduet-appearance :is(.el-radio, .el-checkbox)) {
  box-sizing: border-box;
  height: auto;
  max-width: 100%;
  margin-right: 0;
  padding-block: 4.8px;
  white-space: normal;
}

/* EP 已开放的高度变量仍优先；未指定时才让长标签自然撑开。 */
:global(.form-preview.flowduet-appearance .el-checkbox) {
  height: var(--el-checkbox-height, auto);
}

:global(.form-preview.flowduet-appearance :is(.el-radio--small, .el-checkbox--small)) {
  padding-block: 2.4px;
}

:global(.form-preview.flowduet-appearance :is(.el-radio--large, .el-checkbox--large)) {
  padding-block: 8.8px;
}

:global(.form-preview.flowduet-appearance :is(.el-radio__label, .el-checkbox__label)) {
  min-width: 0;
  line-height: 1.6;
  white-space: normal;
  overflow-wrap: anywhere;
}

:global(.form-preview.flowduet-appearance--brand :is(.el-input, .el-textarea)) {
  --el-input-text-color: var(--fd-text);
  --el-input-bg-color: var(--fd-surface);
  --el-input-border-color: var(--fd-control-border);
  --el-input-placeholder-color: var(--fd-muted);
  --el-input-focus-border-color: var(--fd-focus);
  --el-input-hover-border-color: var(--fd-control-border);
  --el-input-border-radius: var(--fd-radius);
}

:global(.form-preview.flowduet-appearance--brand .el-input__wrapper:focus-within),
:global(.form-preview.flowduet-appearance--brand .el-select__wrapper:focus-within) {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}

:global(.form-preview.flowduet-appearance--brand .el-textarea__inner:focus-visible) {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}

:global(
  .form-preview.flowduet-appearance--brand
    :is(.el-input__clear, .el-textarea__icon, .el-input__count, .el-input__count-inner)
) {
  color: var(--fd-muted);
}

/* 在表单边界补标记前景，字段和选项可继续用原有 EP 变量覆盖；不在子选项重设通用主色。 */
:global(.form-preview.flowduet-appearance--brand .el-form) {
  --el-color-white: var(--fd-on-primary);
}

/* EP 在 .el-select 本体初始化这些变量，需在同一层补默认；用户 inline 样式仍优先。 */
:global(.form-preview.flowduet-appearance--brand .el-select) {
  --el-select-input-color: var(--fd-text);
  --el-select-input-focus-border-color: var(--fd-focus);
  --el-select-disabled-color: var(--fd-disabled-text);
  --el-select-disabled-border: var(--fd-border);
  --el-select-close-hover-color: var(--fd-secondary);
}

:global(.form-preview.flowduet-appearance--brand .el-checkbox) {
  --el-checkbox-text-color: var(--fd-secondary);
  --el-checkbox-bg-color: var(--fd-surface);
  --el-checkbox-input-border: 1px solid var(--fd-control-border);
  --el-checkbox-input-border-color-hover: var(--fd-focus);
  --el-checkbox-checked-text-color: var(--el-color-primary);
  --el-checkbox-checked-input-border-color: var(--el-color-primary);
  --el-checkbox-checked-bg-color: var(--el-color-primary);
  --el-checkbox-checked-icon-color: var(--el-color-white);
  --el-checkbox-disabled-border-color: var(--fd-border);
  --el-checkbox-disabled-input-fill: var(--fd-disabled-surface);
  --el-checkbox-disabled-icon-color: var(--fd-disabled-text);
  --el-checkbox-disabled-checked-input-fill: var(--fd-disabled-surface);
  --el-checkbox-disabled-checked-input-border-color: var(--fd-border);
  --el-checkbox-disabled-checked-icon-color: var(--fd-disabled-text);
}

:global(.form-preview.flowduet-appearance--brand .el-radio) {
  --el-text-color-placeholder: var(--fd-disabled-text);
  --el-radio-text-color: var(--fd-secondary);
  --el-radio-input-bg-color: var(--fd-surface);
  --el-radio-input-border: 1px solid var(--fd-control-border);
  --el-radio-input-border-color: var(--fd-control-border);
  --el-radio-input-border-color-hover: var(--fd-focus);
}

:global(.form-preview.flowduet-appearance--brand .el-switch) {
  --el-switch-on-color: var(--fd-primary);
  --el-switch-off-color: var(--fd-control-border);
  --el-color-white: var(--fd-surface);
}

:global(.form-preview.flowduet-appearance--brand .el-switch.is-checked) {
  --el-color-white: var(--fd-on-primary);
}

/* 颜色仍由 EP 各自变量提供；这里只统一焦点几何，显式 inline 变量保持优先。 */
:global(
  .form-preview.flowduet-appearance--brand .el-checkbox input:focus-visible + .el-checkbox__inner
),
:global(
  .form-preview.flowduet-appearance--brand .el-radio__original:focus-visible + .el-radio__inner
),
:global(
  .form-preview.flowduet-appearance--brand .el-switch__input:focus-visible ~ .el-switch__core
) {
  outline-width: 2px;
  outline-style: solid;
  outline-offset: 3px;
}

:global(.form-preview.flowduet-appearance--brand .el-button) {
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

:global(.form-preview.flowduet-appearance--brand .el-button--primary) {
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

:global(.form-preview.flowduet-appearance--brand .el-button:focus-visible) {
  outline: 2px solid var(--fd-focus);
  outline-offset: 3px;
}
</style>
