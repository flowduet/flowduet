<script setup lang="ts">
import { nextTick, watch } from "vue";
import type { DefaultInputBinding } from "./editor-input-state.js";
const props = defineProps<{ modelValue?: unknown; binding: DefaultInputBinding }>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
watch(
  () => props.modelValue,
  (value) => props.binding.echo(value),
);
function input(event: Event) {
  props.binding.input((event.target as HTMLInputElement).value, (value) => {
    emit("update:modelValue", value);
    void nextTick(() => props.binding.echo(props.modelValue));
  });
}
function compositionEnd(event: Event) {
  props.binding.composition(false);
  input(event);
  void nextTick(() => props.binding.settled());
}
</script>
<template>
  <input
    type="text"
    inputmode="decimal"
    :value="binding.raw"
    data-retained-input="number"
    :data-field="binding.field"
    aria-label="数值默认值原文"
    @input="input"
    @compositionstart="binding.composition(true)"
    @compositionend="compositionEnd"
  />
</template>
