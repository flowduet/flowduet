<script setup lang="ts">
import { ref } from "vue";
import AppearanceConsumptionScene from "./scenes/AppearanceConsumptionScene.vue";

const visible = ref(false);
</script>

<template>
  <main>
    <h1>FlowDuet 双入口安装包消费检查</h1>
    <button type="button" data-test="appearance-scene-btn" @click="visible = true">
      双入口外观
    </button>
    <button type="button" data-test="form-appearance-scene-btn" @click="visible = true">
      预览外观
    </button>
    <AppearanceConsumptionScene v-if="visible" />
  </main>
</template>
