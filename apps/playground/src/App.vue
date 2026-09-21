<script setup lang="ts">
import { ref } from "vue";
import { ElButton } from "element-plus";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { DingtalkDesigner, exportXml } from "@flowduet/designer";

/**
 * Playground 编辑区（#23）：挂 designer 组件的最小验收宿主。
 * BPMN 只读区与三区布局属 #27；导出面板用于人工验收
 * 「零坐标建模 → 竖排布局导出合法 bpmndi」。
 */
const model = BpmnModel.create({
  processId: "playground_demo",
  processName: "演示审批流",
  adapter: flowableAdapter,
})
  .addStartEvent({ id: "start", name: "开始" })
  .addUserTask({ id: "approval_1", name: "经理审批", assignee: "${manager}" })
  .addUserTask({ id: "approval_2", name: "总监审批", assignee: "${director}" })
  .addEndEvent({ id: "end", name: "结束" })
  .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
  .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "approval_2" })
  .addSequenceFlow({ id: "f3", sourceRef: "approval_2", targetRef: "end" });

const xml = ref("");
const error = ref("");

async function doExport(): Promise<void> {
  try {
    error.value = "";
    xml.value = await exportXml(model);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="playground">
    <header class="playground-header">
      <h1>FlowDuet Playground</h1>
      <ElButton type="primary" data-test="export-btn" @click="doExport">导出 XML</ElButton>
    </header>
    <main class="playground-main">
      <section class="playground-editor">
        <DingtalkDesigner :model="model" />
      </section>
      <section v-if="xml || error" class="playground-xml">
        <pre v-if="xml" data-test="xml-preview">{{ xml }}</pre>
        <p v-else class="playground-error" data-test="xml-error">{{ error }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.playground {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.playground-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.playground-header h1 {
  margin: 0;
  font-size: 16px;
  color: #2d3e97;
}

.playground-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.playground-editor {
  flex: 1;
  overflow: auto;
}

.playground-xml {
  width: 420px;
  border-left: 1px solid #e4e7ed;
  background: #fff;
  overflow: auto;
  padding: 12px;
}

.playground-xml pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.playground-error {
  color: #e5484d;
  font-size: 13px;
}
</style>
