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
  .addExclusiveGateway({ id: "fork1", name: "金额判断" })
  // 支 1：小额走总监单审
  .addUserTask({ id: "a_node", name: "总监审批", assignee: "${director}" })
  // 支 2：大额走并行块（财务与法务同时复核）
  .addParallelGateway({ id: "pfork", name: "并行开始" })
  .addParallelGateway({ id: "pjoin", name: "并行结束" })
  .addUserTask({ id: "fin_node", name: "财务复核", assignee: "${finance}" })
  .addUserTask({ id: "legal_node", name: "法务复核", assignee: "${legal}" })
  .addExclusiveGateway({ id: "join1", name: "汇聚" })
  .addEndEvent({ id: "end", name: "结束" })
  .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
  .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "fork1" })
  .addSequenceFlow({ id: "fa", sourceRef: "fork1", targetRef: "a_node" })
  .addSequenceFlow({ id: "fb", sourceRef: "fork1", targetRef: "pfork" })
  .addSequenceFlow({ id: "fp_fin", sourceRef: "pfork", targetRef: "fin_node" })
  .addSequenceFlow({ id: "fp_legal", sourceRef: "pfork", targetRef: "legal_node" })
  .addSequenceFlow({ id: "fin_pj", sourceRef: "fin_node", targetRef: "pjoin" })
  .addSequenceFlow({ id: "legal_pj", sourceRef: "legal_node", targetRef: "pjoin" })
  .addSequenceFlow({ id: "pj_j1", sourceRef: "pjoin", targetRef: "join1" })
  .addSequenceFlow({ id: "fa_j", sourceRef: "a_node", targetRef: "join1" })
  .addSequenceFlow({ id: "fj", sourceRef: "join1", targetRef: "end" });

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
