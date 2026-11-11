<script setup lang="ts">
import { nextTick, watch } from "vue";
import type { DefaultInputBinding } from "./editor-input-state.js";
const props = defineProps<{
  modelValue?: unknown;
  binding: DefaultInputBinding;
  multiline?: boolean;
}>();
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
</script>
<template>
  <div>
    <label
      ><input
        type="checkbox"
        :checked="binding.enabled"
        data-retained-input="text-toggle"
        :data-field="binding.field"
        aria-label="设置文字默认值"
        @change="binding.setEnabled(($event.target as HTMLInputElement).checked, publish)"
      />设置默认值</label
    >
    <component
      :is="multiline ? 'textarea' : 'input'"
      v-if="binding.enabled"
      :value="binding.raw"
      data-retained-input="text"
      :data-field="binding.field"
      aria-label="文字默认值原文"
      @input="input"
      @compositionstart="binding.composition(true)"
      @compositionend="compositionEnd"
    />
  </div>
</template>
