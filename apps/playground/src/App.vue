<script setup lang="ts">
import { ref } from "vue";
import { ElButton, ElRadioGroup, ElRadioButton } from "element-plus";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { BpmnCanvas, DingtalkDesigner, exportXml } from "@flowduet/designer";

/**
 * Playground 编辑区（#23）：挂 designer 组件的最小验收宿主。
 * BPMN 只读区与三区布局属 #27；导出面板用于人工验收
 * 「零坐标建模 → 竖排布局导出合法 bpmndi」。
 *
 * 演示场景包含（本 PR 评审 W-4）：
 *   ・单签审批（经理审批 / 总监审批 / 财务复核 / 法务复核）
 *   ・多人会签（addApprovalTask + collection="approvers" mode="all"）
 *   ・抄送知会（addTask("cc") + recipients）
 * 以便手验 #25 多人审批与抄送的导出部署链路。
 */
const model = BpmnModel.create({
  processId: "playground_demo",
  processName: "演示审批流",
  adapter: flowableAdapter,
})
  .addStartEvent({ id: "start", name: "开始" })
  .addUserTask({ id: "approval_1", name: "经理审批", assignee: "${manager}" })
  // 多人会签（#25）：集合变量 approvers 运行时注入名单，会签完成条件内核固化
  .addApprovalTask({
    id: "approval_mi",
    name: "合同会签",
    collection: "approvers",
    mode: "all",
    formKey: "contract_review_v1",
  })
  // 抄送知会（#25）：ServiceTask + flowable:ccTo，部署合法不要求 bean 在场（ADR-0004）
  .addTask("cc", { id: "cc_1", name: "抄送法务备案", recipients: "张三,李四" })
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
  .addSequenceFlow({ id: "f1b", sourceRef: "approval_1", targetRef: "approval_mi" })
  .addSequenceFlow({ id: "f1c", sourceRef: "approval_mi", targetRef: "cc_1" })
  .addSequenceFlow({ id: "f2", sourceRef: "cc_1", targetRef: "fork1" })
  .addSequenceFlow({ id: "fa", sourceRef: "fork1", targetRef: "a_node" })
  .addSequenceFlow({ id: "fb", sourceRef: "fork1", targetRef: "pfork" })
  .addSequenceFlow({ id: "fp_fin", sourceRef: "pfork", targetRef: "fin_node" })
  .addSequenceFlow({ id: "fp_legal", sourceRef: "pfork", targetRef: "legal_node" })
  .addSequenceFlow({ id: "fin_pj", sourceRef: "fin_node", targetRef: "pjoin" })
  .addSequenceFlow({ id: "legal_pj", sourceRef: "legal_node", targetRef: "pjoin" })
  .addSequenceFlow({ id: "pj_j1", sourceRef: "pjoin", targetRef: "join1" })
  .addSequenceFlow({ id: "fa_j", sourceRef: "a_node", targetRef: "join1" })
  .addSequenceFlow({ id: "fj", sourceRef: "join1", targetRef: "end" });

const view = ref<"dingtalk" | "bpmn">("dingtalk");
const xml = ref("");
const error = ref("");
/** 画布重挂钥：编辑区 change 时递增，BPMN 只读区随之重渲染（互切零转换的联动形态） */
const canvasKey = ref(0);
let exportTimer: ReturnType<typeof setTimeout> | undefined;

async function doExport(): Promise<void> {
  try {
    error.value = "";
    xml.value = await exportXml(model);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

/** 编辑区 change → 画布重挂 + XML 防抖自动刷新（#27 三区联动） */
function onDesignerChange(): void {
  canvasKey.value += 1;
  if (exportTimer !== undefined) clearTimeout(exportTimer);
  exportTimer = setTimeout(() => void doExport(), 250);
}
</script>

<template>
  <div class="playground">
    <header class="playground-header">
      <h1>FlowDuet Playground</h1>
      <ElRadioGroup v-model="view" data-test="view-switch" size="small">
        <ElRadioButton value="dingtalk" data-test="view-dingtalk">钉钉式</ElRadioButton>
        <ElRadioButton value="bpmn" data-test="view-bpmn">BPMN 视图</ElRadioButton>
      </ElRadioGroup>
      <ElButton type="primary" data-test="export-btn" @click="doExport">导出 XML</ElButton>
    </header>
    <main class="playground-main">
      <section class="playground-editor">
        <!-- 互切 = 同一模型实例换投影组件；v-if 挂卸即重挂，读视图总是最新 -->
        <DingtalkDesigner v-if="view === 'dingtalk'" :model="model" @change="onDesignerChange" />
        <BpmnCanvas v-else :key="canvasKey" :model="model" />
      </section>
      <section class="playground-xml" data-test="xml-zone">
        <pre v-if="xml" data-test="xml-preview">{{ xml }}</pre>
        <p v-if="error" class="playground-error" data-test="xml-error">
          {{ error }}
        </p>
        <p v-else class="playground-hint" data-test="xml-hint">
          点击「导出 XML」或编辑流程后自动生成
        </p>
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
  width: 380px;
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

.playground-hint {
  color: #909399;
  font-size: 13px;
}
</style>
