<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import NodeAppearanceScene from "./NodeAppearanceScene.vue";
import FormPreviewAppearanceScene from "./FormPreviewAppearanceScene.vue";

// 双入口共享同一宿主声明；只有组合场景可以改写宿主的 EP 深色类。
const originallyDark = document.documentElement.classList.contains("dark");
const hostDark = ref(originallyDark);
const scopedDark = ref(false);

function onHostDarkChange(dark: boolean): void {
  hostDark.value = dark;
  document.documentElement.classList.toggle("dark", dark);
}

onBeforeUnmount(() => {
  document.documentElement.classList.toggle("dark", originallyDark);
});
</script>

<template>
  <section class="appearance-consumption" data-test="appearance-consumption-scene">
    <header class="appearance-consumption-header">
      <h2>Element Plus 双入口公开消费示例</h2>
      <p>
        两个入口均只使用公开包根组件、类型与 CSS。各实例可独立切换来源、主题、密度、启停和挂载状态。
      </p>
      <p>
        已适配：节点属性抽屉，以及 FormPreview
        八类字段和真实可达弹层。未适配：画布、FormManager／FormDesigner。
      </p>
      <p>
        未验证：其他 EP 组合、Firefox、Safari／WebKit、移动端及完整可访问性认证；真实 OS
        中文输入法需按接入说明单独人工复测。
      </p>
    </header>

    <NodeAppearanceScene
      :host-dark="hostDark"
      :scoped-dark="scopedDark"
      @update:host-dark="onHostDarkChange"
      @update:scoped-dark="scopedDark = $event"
    />
    <FormPreviewAppearanceScene
      :host-dark="hostDark"
      :scoped-dark="scopedDark"
      @update:host-dark="onHostDarkChange"
      @update:scoped-dark="scopedDark = $event"
    />
  </section>
</template>

<style scoped>
.appearance-consumption {
  overflow: auto;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-page);
}

.appearance-consumption-header {
  padding: 20px 24px 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.appearance-consumption-header h2 {
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
  font-size: 20px;
}

.appearance-consumption-header p {
  margin: 4px 0;
}
</style>
