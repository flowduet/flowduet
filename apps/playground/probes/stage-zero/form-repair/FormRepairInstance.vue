<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { FormDesigner } from "@flowduet/form-create";
import type { FormDesignerEditingState } from "@flowduet/form-create";
defineProps<{ name: string; rules: string; owner: string }>();
const emit = defineEmits<{
  ready: [vm: InstanceType<typeof FormDesigner>];
  draft: [];
  state: [state: FormDesignerEditingState];
}>();
const vm = ref<InstanceType<typeof FormDesigner>>();
onMounted(() => {
  if (vm.value) emit("ready", vm.value);
});
onBeforeUnmount(() => {
  vm.value = undefined;
});
</script>
<template>
  <div :data-repair-instance="owner">
    <FormDesigner
      ref="vm"
      editing-mode="retained"
      :name="name"
      :rules="rules"
      options="{}"
      @draft-change="emit('draft')"
      @editing-state-change="emit('state', $event)"
    />
  </div>
</template>
