<script setup lang="ts">
import { computed, ref } from "vue";
import FormStateInstance from "./form-state/FormStateInstance.vue";
import { fields } from "./form-state/fixtures";
import type { FieldCaseId } from "./form-state/types";
const field = ref<FieldCaseId | "all">("all"),
  layout = ref<"top" | "grid">("top"),
  variant = ref("normal-default"),
  dateType = ref("date"),
  sequence = ref(0);
const fixture = computed(() => ({
  field: field.value,
  layout: layout.value,
  variant: variant.value,
  dateType: dateType.value,
}));
</script>
<template>
  <section data-test="form-state-probe">
    <h2>C组：真实表单内部状态</h2>
    <p>
      虚构夹具；重置会丢弃当前实验输入。Alt+O仅只读观察，Alt+S在当前实例收集。这里不是正式工作台。
    </p>
    <label
      >字段
      <select v-model="field" data-test="c-field">
        <option value="all">八类字段</option>
        <option v-for="item in fields" :key="item.id" :value="item.id">
          {{ item.id }} {{ item.label }}
        </option>
        <option value="L01">L01 栅格</option>
        <option value="I01">I01 日期兼容</option>
      </select></label
    >
    <label
      >布局
      <select v-model="layout" data-test="c-layout">
        <option value="top">顶层</option>
        <option value="grid">列内</option>
      </select></label
    >
    <label
      >值
      <select v-model="variant" data-test="c-variant">
        <option
          v-for="value in [
            'normal-default',
            'unset',
            'empty',
            'zero',
            'string-zero',
            'normal',
            'negative',
            'decimal',
            'false',
            'true',
            'empty-array',
            'selected-array',
          ]"
          :key="value"
        >
          {{ value }}
        </option>
      </select></label
    >
    <label
      >日期
      <select v-model="dateType" data-test="c-date-type">
        <option
          v-for="value in ['', 'date', 'datetime', 'week', 'month', 'year']"
          :key="value"
          :value="value"
        >
          {{ value || "省略" }}
        </option>
      </select></label
    >
    <button data-test="c-reset" @click="sequence++">重置虚构会话</button>
    <FormStateInstance :key="`A:${sequence}`" owner="C-A" :fixture="fixture" />
    <details>
      <summary>第二控制器 C-B（同ID隔离）</summary>
      <FormStateInstance :key="`B:${sequence}`" owner="C-B" :fixture="fixture" />
    </details>
  </section>
</template>
