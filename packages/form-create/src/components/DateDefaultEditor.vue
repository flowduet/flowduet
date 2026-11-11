<script setup lang="ts">
import { nextTick, watch, onBeforeUnmount } from "vue";
import { ElDatePicker } from "element-plus";
import type { DefaultInputBinding } from "./editor-input-state.js";
const props = defineProps<{ modelValue?: unknown; binding: DefaultInputBinding; owner: string }>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
watch(
  () => props.modelValue,
  (value) => props.binding.echo(value),
);
function publish(value: unknown) {
  emit("update:modelValue", value);
  void nextTick(() => props.binding.echo(props.modelValue));
}
function input(event: Event) {
  props.binding.input((event.target as HTMLInputElement).value, publish);
}
function compositionEnd(event: Event) {
  props.binding.composition(false);
  input(event);
  void nextTick(() => props.binding.settled());
}
onBeforeUnmount(() => props.binding.popup(false));
function choose(value: unknown) {
  props.binding.input(value == null ? "" : String(value), publish);
}
</script>
<template>
  <div data-retained-date>
    <input
      type="text"
      :value="binding.raw"
      data-retained-input="date"
      :data-field="binding.field"
      aria-label="日期默认值原文"
      @input="input"
      @compositionstart="binding.composition(true)"
      @compositionend="compositionEnd"
    />
    <ElDatePicker
      v-if="binding.supported"
      :model-value="typeof modelValue === 'string' ? modelValue : ''"
      type="date"
      value-format="YYYY-MM-DD"
      :editable="false"
      :clearable="false"
      :popper-class="owner"
      aria-label="日历确认默认日期"
      @update:model-value="choose"
      @visible-change="binding.popup"
    />
  </div>
</template>
