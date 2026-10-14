<script setup lang="ts">
import { ref } from "vue";
import { ElSelect, ElOption, ElInput, ElDatePicker } from "element-plus";
import { FormDesigner, FormPreview } from "@flowduet/form-create";
import { rulesFor } from "./fixtures";
import { record } from "./probe-log";
const width = ref(1024),
  density = ref("compact"),
  themes = ref(["light", "dark"]),
  showDesigner = ref(false),
  localTeleport = ref(false),
  chosen = ref<Record<string, string>>({ host: "", "0": "", "1": "" }),
  date = ref<Record<string, string>>({ "0": "", "1": "" }),
  result = ref("");
const form = {
  id: "theme_form",
  name: "主题表单",
  provider: "form-create/element-plus" as const,
  rules: rulesFor(1),
  options: "{}",
};
function measure() {
  const nodes = [...document.querySelectorAll<HTMLElement>("[data-theme-instance]")];
  const values = nodes.map((n) => ({
    theme: n.dataset.themeInstance,
    width: n.getBoundingClientRect().width,
    client: n.clientWidth,
    scroll: n.scrollWidth,
    color: getComputedStyle(n).color,
    bg: getComputedStyle(n).backgroundColor,
    primary: getComputedStyle(n).getPropertyValue("--el-color-primary"),
  }));
  result.value = JSON.stringify(values, null, 2);
  record("theme", "measure", values);
}
</script>
<template>
  <div class="bar">
    <label
      >容器宽度<select v-model.number="width">
        <option v-for="n in [1440, 1280, 1024, 900, 768]" :key="n">{{ n }}</option>
      </select></label
    ><label
      >密度<select v-model="density">
        <option value="compact">紧凑</option>
        <option value="comfortable">舒适</option>
      </select></label
    ><label
      ><input type="checkbox" v-model="localTeleport" />直接 EP 控件使用局部挂载（不影响 FormCreate
      内部）</label
    ><button @click="showDesigner = !showDesigner">切换设计器/试填</button
    ><button @click="themes.reverse()">交换实例主题</button
    ><button @click="measure">测量容器</button>
  </div>
  <div class="host-control">
    宿主对照 <ElInput placeholder="宿主输入" /><ElSelect
      v-model="chosen.host"
      placeholder="宿主下拉"
      ><ElOption label="宿主选项" value="host"
    /></ElSelect>
  </div>
  <div class="theme-scroll">
    <section
      v-for="(theme, index) in themes"
      :key="index"
      class="theme-host"
      :class="[theme, density]"
      :data-theme-instance="theme"
      :style="{ width: width + 'px' }"
    >
      <h3>{{ theme === "dark" ? "深色实例" : "浅色实例" }} · 真实 FormCreate / Element Plus</h3>
      <ElInput placeholder="实例输入" /><ElSelect
        v-model="chosen[String(index)]"
        :teleported="!localTeleport"
        :popper-class="'probe-' + theme + '-popper'"
        placeholder="实例下拉"
        ><ElOption label="研发部门" value="dev" /><ElOption
          label="采购部门"
          value="buy" /></ElSelect
      ><ElDatePicker
        :model-value="date[String(index)] ?? ''"
        @update:model-value="date[String(index)] = String($event ?? '')"
        :teleported="!localTeleport"
        placeholder="选择日期"
      />
      <div v-if="showDesigner" class="editor-host">
        <FormDesigner :name="form.name" :rules="form.rules" :options="form.options" />
      </div>
      <FormPreview v-else :form="form" />
    </section>
  </div>
  <pre data-test="theme-result">{{ result }}</pre>
</template>
<style scoped>
.host-control {
  padding: 12px;
  background: #fff;
}
.host-control :deep(.el-input) {
  width: 240px;
}
.theme-scroll {
  overflow: auto;
}
.theme-host {
  padding: 16px;
  margin: 14px 0;
  border: 1px solid var(--el-border-color);
  box-sizing: border-box;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  --el-color-primary: #2d3e97;
  --el-bg-color: #fff;
  --el-text-color-primary: #26334c;
}
.theme-host :deep(.el-select) {
  width: 230px;
}
.theme-host :deep(.el-input) {
  max-width: 340px;
}
.dark {
  color-scheme: dark;
  --el-color-primary: #a5b2ff;
  --el-color-primary-light-9: #303a62;
  --el-color-primary-light-7: #4a567d;
  --el-bg-color: #202735;
  --el-bg-color-overlay: #252e3f;
  --el-fill-color-blank: #202735;
  --el-fill-color-light: #2c3548;
  --el-text-color-primary: #e4e9f3;
  --el-text-color-regular: #c4cede;
  --el-text-color-placeholder: #a8b3c9;
  --el-border-color: #59677e;
  --el-border-color-light: #47546b;
}
.compact {
  --el-component-size: 28px;
  --el-font-size-base: 13px;
}
.comfortable {
  --el-component-size: 36px;
  --el-font-size-base: 14px;
}
</style>
