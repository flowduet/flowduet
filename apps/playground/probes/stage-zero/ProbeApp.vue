<script setup lang="ts">
import { ref } from "vue";
import EditorRetentionProbe from "./EditorRetentionProbe.vue";
import ThemeIsolationProbe from "./ThemeIsolationProbe.vue";
import HostProtocolProbe from "./HostProtocolProbe.vue";
import ContractProbe from "./ContractProbe.vue";
import FormStateProbe from "./FormStateProbe.vue";
import FormRepairProbe from "./form-repair/FormRepairProbe.vue";
import DefaultEditorSeamProbe from "./form-repair/DefaultEditorSeamProbe.vue";
import { entries } from "./probe-log";
const selected = ref("contract");
</script>
<template>
  <div class="probe">
    <h1>FlowDuet 阶段零 · 真实组件探针</h1>
    <p>
      隔离的实验入口，不是正式工作台；只使用虚构样例。结构修复已合入 develop
      02d3474；本入口用于剩余阶段零复验。
    </p>
    <nav>
      <button @click="selected = 'contract'">编辑合同 A/B</button>
      <button @click="selected = 'form-state'">表单状态 C</button>
      <button @click="selected = 'b03-p1'">B03 P1 修复</button>
      <button @click="selected = 'b03-p0'">B03 P0 接缝</button>
      <button @click="selected = 'editor'">编辑保留</button
      ><button @click="selected = 'theme'">主题隔离</button
      ><button @click="selected = 'host'">宿主协议</button>
    </nav>
    <ContractProbe v-if="selected === 'contract'" />
    <FormStateProbe v-if="selected === 'form-state'" />
    <FormRepairProbe v-if="selected === 'b03-p1'" />
    <DefaultEditorSeamProbe v-if="selected === 'b03-p0'" />
    <EditorRetentionProbe v-if="selected === 'editor'" /><ThemeIsolationProbe
      v-if="selected === 'theme'"
    /><HostProtocolProbe v-if="selected === 'host'" />
    <details>
      <summary>探针事件记录 {{ entries.length }}</summary>
      <pre data-test="event-log">{{ JSON.stringify(entries, null, 2) }}</pre>
    </details>
  </div>
</template>
<style>
.probe {
  font:
    14px/1.5 -apple-system,
    BlinkMacSystemFont,
    "PingFang SC",
    sans-serif;
  color: #26334c;
  padding: 14px;
  background: #f5f7fb;
}
.probe h1 {
  font-size: 20px;
}
.probe button:not([class]) {
  padding: 6px 11px;
  margin: 4px;
  border: 1px solid #aeb8cf;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}
.probe pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  background: #edf0f6;
  padding: 10px;
}
.probe nav {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.probe .bar {
  background: #fff;
  padding: 8px;
  border: 1px solid #ddd;
}
.probe .editor-host {
  min-height: 540px;
  height: 600px;
  background: var(--el-bg-color, #fff);
}
.probe select {
  padding: 5px;
}
.probe .error {
  color: #a82424;
}
.probe input:not([class]) {
  padding: 5px;
}
</style>
