<script setup lang="ts">
import { computed, defineComponent, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElButton, ElDatePicker, ElInput, ElOption, ElSelect } from "element-plus";
import {
  type AppearanceColorSource,
  type AppearanceDensity,
  type AppearanceMode,
  type ComponentAppearance,
} from "@flowduet/designer";
import { FormPreview, type FormDefinition } from "@flowduet/form-create";

interface InstanceControls {
  enabled: boolean;
  mounted: boolean;
  colorSource: AppearanceColorSource;
  mode: AppearanceMode;
  density: AppearanceDensity;
}

const TEXT_FORM: FormDefinition = {
  id: "form_preview_text",
  name: "文本试填",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "input",
      field: "reason",
      title: "申请事由（用于核对较长中文标签、必填错误与换行）",
      value: "默认事由",
      validate: [
        {
          required: true,
          message: "请填写申请事由；这项长中文必填错误用于确认多行反馈不会覆盖后续字段或操作按钮。",
          trigger: "blur",
        },
      ],
    },
    {
      type: "input",
      field: "detail",
      title: "详细说明",
      value: "默认说明",
      props: { type: "textarea", rows: 4 },
    },
  ]),
  options: "{}",
};

const CONTROL_FORM: FormDefinition = {
  id: "form_preview_controls",
  name: "数字与选择控件试填",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    ...JSON.parse(TEXT_FORM.rules),
    {
      type: "inputNumber",
      field: "amount",
      title: "申请数量",
      value: 1,
      props: { min: 0, max: 3, step: 1 },
    },
    {
      type: "inputNumber",
      field: "disabledAmount",
      title: "禁用数字",
      value: 2,
      props: { min: 0, max: 3, disabled: true },
    },
    {
      type: "radio",
      field: "decision",
      title: "审批选择",
      value: "no",
      options: [
        {
          label: "同意（这是一项用于核对换行与缩放的长中文单选选项）",
          value: "yes",
        },
        { label: "拒绝", value: "no" },
        { label: "禁用选项", value: "disabled", disabled: true },
      ],
    },
    {
      type: "radio",
      field: "disabledDecision",
      title: "禁用已选单选",
      value: "disabled",
      options: [{ label: "禁用已选", value: "disabled", disabled: true }],
    },
    {
      type: "radio",
      field: "styledDecision",
      title: "仅 inline 颜色长单选",
      value: "yes",
      options: [
        {
          label: "仅设置颜色而没有显式高度的长中文选项，用于核对标签不会覆盖下一项",
          value: "yes",
          style: "--el-color-primary: rgb(18, 52, 86); --el-color-white: rgb(1, 2, 3)",
        },
      ],
    },
    {
      type: "checkbox",
      field: "tags",
      title: "通知范围",
      value: ["alpha", "disabledChecked"],
      options: [
        { label: "甲：用于核对长中文多选选项换行的通知范围", value: "alpha" },
        { label: "乙", value: "beta" },
        { label: "真实可达半选", value: "mixed", indeterminate: true },
        { label: "禁用未选", value: "disabled", disabled: true },
        { label: "禁用已选", value: "disabledChecked", disabled: true },
      ],
    },
    {
      type: "checkbox",
      field: "styledTags",
      title: "仅 inline 颜色长多选",
      value: ["a"],
      options: [
        {
          label: "仅设置勾选和文字颜色而没有显式高度的长中文多选选项，用于核对布局",
          value: "a",
          style:
            "--el-checkbox-checked-text-color: rgb(18, 52, 86); --el-checkbox-checked-icon-color: rgb(1, 2, 3)",
        },
      ],
    },
    {
      type: "switch",
      field: "notify",
      title: "状态通知",
      value: false,
      props: {
        activeValue: true,
        inactiveValue: false,
        activeText: "开启通知",
        inactiveText: "关闭通知",
      },
    },
    {
      type: "switch",
      field: "disabledNotify",
      title: "禁用开关",
      value: true,
      props: { activeValue: true, inactiveValue: false, disabled: true },
    },
    {
      type: "select",
      field: "dropdownDecision",
      title: "下拉单选（真实弹层）",
      value: "no",
      validate: [{ required: true, message: "请选择下拉审批结果", trigger: "change" }],
      props: {
        clearable: true,
        valueOnClear: "",
        placeholder: "请选择审批结果",
        popperClass: "preview-select-panel",
      },
      options: [
        { label: "同意", value: "yes" },
        { label: "拒绝", value: "no" },
        {
          label:
            "长中文选项：用于核对下拉面板在窄容器和缩放时的换行、选中与键盘高亮；继续补充一段审批说明，确保在窄屏与缩放后仍需要两行以上展示；另外保留用于校验反馈和焦点恢复的说明文字，让整项内容超过紧凑面板的单行可用宽度。",
          value: "long",
        },
        { label: "禁用选项", value: "disabled", disabled: true },
      ],
    },
    {
      type: "select",
      field: "emptyDropdown",
      title: "空选项下拉",
      props: { placeholder: "暂无可选项" },
      options: [],
    },
    {
      type: "select",
      field: "disabledDropdown",
      title: "禁用下拉",
      value: "disabled",
      props: { disabled: true },
      options: [{ label: "禁用已选", value: "disabled", disabled: true }],
    },
  ]),
  options: "{}",
};

const DATE_FORM: FormDefinition = {
  id: "form_preview_dates",
  name: "日期单值与时间面板试填",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "datePicker",
      field: "date",
      title: "申请日期（date）",
      value: "2026-11-15",
      validate: [{ required: true, message: "请选择申请日期", trigger: "change" }],
      props: {
        type: "date",
        format: "YYYY-MM-DD",
        valueFormat: "YYYY-MM-DD",
        clearable: true,
        popperClass: "preview-date-panel",
      },
    },
    {
      type: "datePicker",
      field: "datetime",
      title: "审批时间（datetime，聚焦时间输入进入实际时间列表）",
      value: "2026-11-15 09:30:45",
      props: {
        type: "datetime",
        format: "YYYY-MM-DD HH:mm:ss",
        valueFormat: "YYYY-MM-DD HH:mm:ss",
        clearable: true,
        popperClass: "preview-datetime-panel",
      },
    },
    {
      type: "datePicker",
      field: "week",
      title: "审批周（week）",
      value: "2026-46th",
      props: {
        type: "week",
        format: "YYYY-wo",
        valueFormat: "YYYY-wo",
        clearable: true,
        popperClass: "preview-week-panel",
      },
    },
    {
      type: "datePicker",
      field: "month",
      title: "审批月份（month）",
      value: "2026-11",
      props: {
        type: "month",
        format: "YYYY-MM",
        valueFormat: "YYYY-MM",
        clearable: true,
        popperClass: "preview-month-panel",
      },
    },
    {
      type: "datePicker",
      field: "year",
      title: "审批年份（year）",
      value: "2026",
      props: {
        type: "year",
        format: "YYYY",
        valueFormat: "YYYY",
        clearable: true,
        popperClass: "preview-year-panel",
      },
    },
    {
      type: "datePicker",
      field: "disabledDate",
      title: "禁用日期",
      value: "2026-11-16",
      props: { type: "date", disabled: true, popperClass: "preview-disabled-date-panel" },
    },
  ]),
  options: "{}",
};

const OTHER_FORM: FormDefinition = {
  id: "form_preview_other",
  name: "另一份文本表单",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    { type: "input", field: "subject", title: "新表单主题", value: "新表单默认值" },
    {
      type: "input",
      field: "notes",
      title: "新表单备注",
      props: { type: "textarea" },
    },
  ]),
  options: "{}",
};

const EXPLICIT_FORM: FormDefinition = {
  ...TEXT_FORM,
  id: "form_preview_explicit",
  name: "显式配置对照",
  rules: JSON.stringify([
    {
      type: "input",
      field: "reason",
      title: "显式右置标签",
      value: "字段尺寸保持 large",
      style: "max-width: 320px",
      props: { size: "large" },
      $required: true,
    },
    {
      type: "input",
      field: "detail",
      title: "显式多行说明",
      value: "显式 rows=4",
      props: { type: "textarea", rows: 4 },
    },
    {
      type: "inputNumber",
      field: "explicitAmount",
      title: "显式右侧数字按钮",
      value: 2,
      props: { min: 0, max: 5, controlsPosition: "right" },
    },
    {
      type: "radio",
      field: "explicitDecision",
      title: "显式单选尺寸",
      value: "yes",
      options: [
        {
          label: "保持显式高度与颜色",
          value: "yes",
          style:
            "height: 20px; --el-color-primary: rgb(18, 52, 86); --el-color-white: rgb(1, 2, 3)",
        },
      ],
    },
    {
      type: "checkbox",
      field: "explicitTags",
      title: "显式多选样式",
      value: ["a"],
      options: [
        {
          label: "保留选项 inline color",
          value: "a",
          style:
            "height: 20px; --el-checkbox-checked-text-color: rgb(18, 52, 86); --el-checkbox-checked-icon-color: rgb(1, 2, 3)",
        },
      ],
    },
    {
      type: "switch",
      field: "explicitNotify",
      title: "显式开关宽度",
      value: true,
      style: "--el-switch-on-color: rgb(18, 52, 86); --el-color-white: rgb(1, 2, 3)",
      props: { width: 56, activeText: "接收", inactiveText: "停用" },
    },
    {
      type: "radio",
      field: "groupDecision",
      title: "字段级单选颜色",
      value: "yes",
      style: "--el-color-primary: rgb(191, 0, 31); --el-color-white: rgb(10, 20, 30)",
      options: [
        { label: "继承字段颜色", value: "yes" },
        {
          label: "选项颜色优先",
          value: "override",
          style: "--el-color-primary: rgb(18, 52, 86); --el-color-white: rgb(1, 2, 3)",
        },
      ],
    },
    {
      type: "checkbox",
      field: "groupTags",
      title: "字段级多选颜色",
      value: ["a", "override"],
      props: { size: "default" },
      style:
        "--el-color-primary: rgb(191, 0, 31); --el-color-white: rgb(10, 20, 30); --el-checkbox-height: 56px",
      options: [
        { label: "继承字段颜色", value: "a" },
        {
          label: "选项颜色优先",
          value: "override",
          style:
            "--el-color-primary: rgb(18, 52, 86); --el-color-white: rgb(1, 2, 3); --el-checkbox-height: 72px",
        },
      ],
    },
    {
      type: "select",
      field: "explicitDropdown",
      title: "显式外部挂载下拉",
      value: "no",
      props: {
        size: "large",
        appendTo: "#form-appearance-explicit-popper-target",
        popperClass: ["explicit-select-panel", "explicit-select-panel-secondary"],
        popperStyle: {
          "--fd-primary": "rgb(191, 0, 31)",
          "--fd-primary-ink": "rgb(18, 52, 86)",
          "--fd-primary-soft": "rgb(230, 232, 240)",
          "--el-color-primary": "rgb(18, 52, 86)",
          "--el-text-color-regular": "rgb(52, 66, 80)",
          "--el-select-input-color": "rgb(18, 52, 86)",
        },
      },
      options: [
        { label: "显式同意", value: "yes" },
        { label: "显式拒绝", value: "no" },
      ],
    },
    {
      type: "select",
      field: "inlineDropdown",
      title: "显式原位下拉",
      value: "yes",
      props: {
        teleported: false,
        popperClass: "inline-select-panel",
        popperStyle: {
          "--el-font-size-base": "28px",
          "--el-color-primary": "rgb(18, 52, 86)",
          "--el-fill-color-light": "rgb(224, 232, 240)",
          "--el-text-color-placeholder": "rgb(113, 130, 147)",
        },
      },
      options: [
        { label: "原位同意", value: "yes" },
        {
          label: "原位拒绝",
          value: "no",
          style: { height: "20px", lineHeight: "20px", fontSize: "18px", whiteSpace: "nowrap" },
        },
        {
          label: "原位禁用",
          value: "disabled",
          disabled: true,
          style: "max-height:16px;line-height:16px;font-size:16px;white-space:nowrap",
        },
      ],
    },
    {
      type: "select",
      field: "explicitEmptyDropdown",
      title: "显式空面板字号",
      props: {
        popperClass: "explicit-empty-select-panel",
        popperStyle: { "--el-select-font-size": "26px" },
      },
      options: [],
    },
    {
      type: "datePicker",
      field: "explicitDate",
      title: "显式外部挂载日期",
      value: "15/11/2026",
      props: {
        type: "date",
        size: "large",
        format: "DD/MM/YYYY",
        valueFormat: "DD/MM/YYYY",
        appendTo: "#form-appearance-explicit-popper-target",
        popperClass: ["explicit-date-panel", "explicit-date-panel-secondary"],
        popperStyle: {
          "--el-color-primary": "rgb(18, 52, 86)",
          "--el-text-color-placeholder": "rgb(113, 130, 147)",
          "--el-datepicker-active-color": "rgb(18, 52, 86)",
          "--el-datepicker-off-text-color": "rgb(113, 130, 147)",
          "--el-datepicker-inrange-bg-color": "rgb(230, 232, 240)",
        },
      },
    },
    {
      type: "datePicker",
      field: "inlineDate",
      title: "显式原位日期",
      value: "2026-11-15",
      props: {
        type: "date",
        teleported: false,
        appendTo: "#form-appearance-explicit-popper-target",
        popperClass: "inline-date-panel",
      },
    },
  ]),
  options: JSON.stringify({
    form: {
      size: "large",
      labelPosition: "right",
      labelWidth: "96px",
      inline: false,
      style: "padding: 7px",
    },
  }),
};

const first = reactive<InstanceControls>({
  enabled: true,
  mounted: true,
  colorSource: "host",
  mode: "light",
  density: "comfortable",
});
const second = reactive<InstanceControls>({
  enabled: true,
  mounted: true,
  colorSource: "brand",
  mode: "dark",
  density: "compact",
});
const firstForm = ref<FormDefinition>(TEXT_FORM);
const firstInvalid = ref(false);
const samplingRaceArmed = ref(false);
const hostDark = ref(document.documentElement.classList.contains("dark"));
const scopedDark = ref(false);
const originallyDark = hostDark.value;
const hostDecision = ref("hostA");
const hostDate = ref("2026-11-15 09:30:45");

function toAppearance(controls: InstanceControls): ComponentAppearance | undefined {
  if (!controls.enabled) return undefined;
  return {
    colorSource: controls.colorSource,
    mode: controls.mode,
    density: controls.density,
  };
}

const firstAppearance = computed<ComponentAppearance | undefined>(() => {
  if (firstInvalid.value && first.enabled)
    return { mode: first.mode, density: "invalid-density" } as unknown as ComponentAppearance;
  return toAppearance(first);
});
const secondAppearance = computed(() => toAppearance(second));

function syncHostMode(controls: InstanceControls): void {
  if (controls.colorSource === "host")
    controls.mode = hostDark.value || scopedDark.value ? "dark" : "light";
}

// 后置兄弟 watcher 在预览合法采样挂起后写入非法配置；只构造验收时序，不渲染 DOM。
const FirstSamplingRaceTrigger = defineComponent({
  props: {
    armed: { type: Boolean, required: true },
    dark: { type: Boolean, required: true },
  },
  setup(props) {
    watch(
      () => props.dark,
      (dark) => {
        if (!dark || !props.armed) return;
        firstInvalid.value = true;
        samplingRaceArmed.value = false;
      },
      { flush: "post" },
    );
    return () => null;
  },
});

function onFirstValidChange(): void {
  firstInvalid.value = false;
}

function onSourceChange(controls: InstanceControls): void {
  if (controls === first) onFirstValidChange();
  syncHostMode(controls);
}

function onHostThemeChange(event: Event): void {
  const dark = (event.target as HTMLInputElement).checked;
  hostDark.value = dark;
  // 宿主主动切换自己的 EP 深色环境，组件本身不操作 html/body。
  document.documentElement.classList.toggle("dark", dark);
  syncHostMode(first);
  syncHostMode(second);
}

function onScopedDarkChange(): void {
  onFirstValidChange();
  syncHostMode(first);
  syncHostMode(second);
}

function onFirstSamplingRace(): void {
  onFirstValidChange();
  first.enabled = true;
  first.colorSource = "host";
  samplingRaceArmed.value = true;
  scopedDark.value = true;
  syncHostMode(first);
  syncHostMode(second);
}

onBeforeUnmount(() => {
  document.documentElement.classList.toggle("dark", originallyDark);
});
</script>

<template>
  <section
    class="form-appearance-scene"
    :class="{ 'form-appearance-scoped-dark': scopedDark }"
    data-test="form-appearance-scene"
  >
    <header class="form-appearance-header">
      <div>
        <h2>FormPreview 字段与真实弹层外观验收</h2>
        <p>两个公开预览实例共享同一 Vue app；试填、校验反馈与设计定义各自独立。</p>
      </div>
      <div class="form-appearance-controls">
        <label>
          <input
            type="checkbox"
            :checked="hostDark"
            data-test="form-appearance-host-dark"
            @change="onHostThemeChange"
          />
          宿主启用 EP 深色
        </label>
        <label>
          <input
            v-model="scopedDark"
            type="checkbox"
            data-test="form-appearance-scoped-dark"
            @change="onScopedDarkChange"
          />
          声明式局部深色宿主
        </label>
      </div>
    </header>

    <div class="form-appearance-host-control" data-test="form-appearance-host-control">
      <span>无关宿主控件</span>
      <ElInput data-test="form-appearance-host-input" model-value="宿主原值" />
      <ElButton type="primary" data-test="form-appearance-host-button">宿主主按钮</ElButton>
      <ElSelect v-model="hostDecision" data-test="form-appearance-host-select">
        <ElOption label="宿主甲" value="hostA" />
        <ElOption label="宿主乙" value="hostB" />
      </ElSelect>
      <span data-test="form-appearance-host-date-control">
        <ElDatePicker
          v-model="hostDate"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          popper-class="host-date-panel"
        />
      </span>
    </div>

    <div class="form-appearance-grid">
      <section class="form-appearance-instance" data-test="form-appearance-first-instance">
        <h3>实例一：缺省配置补默认</h3>
        <div class="form-appearance-controls">
          <label>
            <input
              v-model="first.enabled"
              type="checkbox"
              data-test="form-appearance-first-enabled"
            />启用适配
          </label>
          <label>
            <input
              v-model="first.mounted"
              type="checkbox"
              data-test="form-appearance-first-mounted"
            />挂载实例
          </label>
          <label>
            配色
            <select
              v-model="first.colorSource"
              data-test="form-appearance-first-source"
              @change="onSourceChange(first)"
            >
              <option value="host">跟随宿主</option>
              <option value="brand">品牌预设</option>
            </select>
          </label>
          <label>
            主题
            <select
              v-model="first.mode"
              data-test="form-appearance-first-mode"
              :disabled="first.colorSource === 'host'"
              @change="onFirstValidChange"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label>
            密度
            <select
              v-model="first.density"
              data-test="form-appearance-first-density"
              @change="onFirstValidChange"
            >
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
          <button
            type="button"
            data-test="form-appearance-first-invalid"
            @click="firstInvalid = true"
          >
            发送非法密度
          </button>
          <button
            type="button"
            data-test="form-appearance-first-sampling-race"
            @click="onFirstSamplingRace"
          >
            同周期切深并发送非法密度
          </button>
          <button
            type="button"
            data-test="form-appearance-first-controls"
            @click="firstForm = CONTROL_FORM"
          >
            控件与下拉样例
          </button>
          <button
            type="button"
            data-test="form-appearance-first-reopen-controls"
            @click="firstForm = { ...CONTROL_FORM }"
          >
            控件与下拉同 ID 重开
          </button>
          <button
            type="button"
            data-test="form-appearance-first-dates"
            @click="firstForm = DATE_FORM"
          >
            日期与时间样例
          </button>
          <button
            type="button"
            data-test="form-appearance-first-reopen-dates"
            @click="firstForm = { ...DATE_FORM }"
          >
            日期与时间同 ID 重开
          </button>
          <button
            type="button"
            data-test="form-appearance-first-reopen"
            @click="firstForm = { ...TEXT_FORM }"
          >
            同 ID 重开
          </button>
          <button
            type="button"
            data-test="form-appearance-first-other"
            @click="firstForm = OTHER_FORM"
          >
            换另一表单
          </button>
          <button
            type="button"
            data-test="form-appearance-first-explicit"
            @click="firstForm = EXPLICIT_FORM"
          >
            显式配置样例
          </button>
          <span data-test="form-appearance-first-form-id">{{ firstForm.id }}</span>
        </div>
        <FormPreview v-if="first.mounted" :form="firstForm" :appearance="firstAppearance" />
        <FirstSamplingRaceTrigger :armed="samplingRaceArmed" :dark="scopedDark" />
      </section>

      <section class="form-appearance-instance" data-test="form-appearance-second-instance">
        <h3>实例二：显式配置与异主题品牌预设</h3>
        <div class="form-appearance-controls">
          <label>
            <input
              v-model="second.enabled"
              type="checkbox"
              data-test="form-appearance-second-enabled"
            />启用适配
          </label>
          <label>
            <input
              v-model="second.mounted"
              type="checkbox"
              data-test="form-appearance-second-mounted"
            />挂载实例
          </label>
          <label>
            配色
            <select
              v-model="second.colorSource"
              data-test="form-appearance-second-source"
              @change="onSourceChange(second)"
            >
              <option value="host">跟随宿主</option>
              <option value="brand">品牌预设</option>
            </select>
          </label>
          <label>
            主题
            <select
              v-model="second.mode"
              data-test="form-appearance-second-mode"
              :disabled="second.colorSource === 'host'"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label>
            密度
            <select v-model="second.density" data-test="form-appearance-second-density">
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
        </div>
        <FormPreview v-if="second.mounted" :form="EXPLICIT_FORM" :appearance="secondAppearance" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.form-appearance-scene {
  padding: 24px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.form-appearance-header,
.form-appearance-host-control,
.form-appearance-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.form-appearance-header {
  justify-content: space-between;
  margin-bottom: 16px;
}

.form-appearance-header h2,
.form-appearance-instance h3 {
  margin: 0 0 4px;
}

.form-appearance-header p {
  margin: 0;
  color: var(--el-text-color-regular);
}

.form-appearance-host-control {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.form-appearance-host-control .el-input,
.form-appearance-host-control .el-select {
  width: 180px;
}

.form-appearance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.form-appearance-instance {
  min-width: 0;
}

.form-appearance-controls {
  margin-bottom: 12px;
  font-size: 13px;
}

.form-appearance-controls label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.form-appearance-scoped-dark {
  --el-bg-color-page: #101817;
  --el-bg-color: #162220;
  --el-bg-color-overlay: #162220;
  --el-fill-color-light: #1f302d;
  --el-text-color-primary: #e6f2f0;
  --el-text-color-regular: #b8ceca;
  --el-border-color-light: #2d4440;
  --el-disabled-text-color: #7d9692;
  --el-disabled-bg-color: #1f302d;
  --el-color-primary: #7fcfc7;
  --el-color-primary-light-3: #99dad3;
  --el-color-primary-dark-2: #5fb3aa;
  --el-color-white: #0c1f1d;
}

@media (max-width: 1100px) {
  .form-appearance-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
