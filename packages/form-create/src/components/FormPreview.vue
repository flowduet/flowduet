<script setup lang="ts">
import { computed, markRaw, onBeforeMount, ref, watch } from "vue";
import { ElButton } from "element-plus";
import formCreateFactory from "@form-create/element-ui";
import type { FormDefinition } from "../document.js";
import { parseFormOptions, parseFormRules } from "../form-schema.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";

/**
 * 表单预览（#72）：真实 FormCreate 渲染器（@form-create/element-ui 3.3.4）试填。
 * 试填状态与设计定义隔离：值只进本地 trialValue，不回写 rules/options、
 * 不进设计文档；切换预览目标（换 form）即重置（A09/A10/A41 相关）。
 */
const props = defineProps<{
  form: FormDefinition;
}>();

// markRaw：组件是工厂产物（含大量内部状态），避免被响应式代理拖累
const FormCreateRenderer = markRaw(formCreateFactory.$form());

// 宿主未全局安装时补装（elm 组件映射注册进实例，否则字段渲染不出来）
onBeforeMount(ensureFormCreateInstalled);

const trialValue = ref<Record<string, unknown>>({});
/** fApi：渲染器挂载后经 update:api 事件交付（form-create v3 约定），用于触发校验 */
const fApi = ref<{ validate?: (cb: (result: unknown) => void) => unknown } | null>(null);
const validation = ref<{ ok: boolean; message: string } | null>(null);

// 目标切换即重置：不同表单的试填写入不混在一起
watch(
  () => props.form.id,
  () => {
    trialValue.value = {};
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

const rule = computed(() => (contentError.value === null ? parseFormRules(props.form.rules) : []));
const option = computed(() =>
  contentError.value === null ? parseFormOptions(props.form.options) : {},
);

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
  <div class="form-preview" data-test="form-preview">
    <p v-if="contentError" class="form-preview-error" data-test="form-preview-error">
      表单内容无法解析：{{ contentError }}
    </p>
    <template v-else>
      <component
        :is="FormCreateRenderer"
        v-model="trialValue"
        :rule="rule"
        :option="option"
        data-test="form-preview-render"
        @update:api="onApi"
      />
      <div class="form-preview-actions">
        <ElButton size="small" data-test="form-preview-validate" @click="validate">
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
</style>
