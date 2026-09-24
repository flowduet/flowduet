<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from "vue";
import { ElButton, ElDialog, ElRadioGroup, ElRadioButton } from "element-plus";
import {
  BpmnModel,
  deriveBlockTree,
  flowableAdapter,
  isApprovalTask,
  resolveEffectiveForm,
} from "@flowduet/core";
import type { BlockTreeNode } from "@flowduet/core";
import { BpmnCanvas, DingtalkDesigner } from "@flowduet/designer";
import {
  exportDeployXml,
  FlowDesignSession,
  FormManager,
  FormPreview,
} from "@flowduet/form-create";
import type { FormDefinition } from "@flowduet/form-create";

/**
 * Playground 编辑区（#23）：挂 designer 组件的最小验收宿主。
 * BPMN 只读区与三区布局属 #27；导出面板用于人工验收
 * 「零坐标建模 → 竖排布局导出合法 bpmndi」。
 *
 * 设计文档闭环（#71）：FlowDesignSession 承载模型的新建 / 保存 / 原子恢复，
 * Playground 只做文件 I/O（下载 Blob、读 File）与结果展示；
 * 「下载设计文档」（带版本协议）与「导出 XML」（裸部署导出）是两个独立入口。
 *
 * 表单集成（#72）：表单目录、默认绑定与预览全部经 form-create 公开组合入口；
 * 部署导出走组合校验（流程 + 表单引用完整性）。
 */
function buildDemoModel(): BpmnModel {
  return (
    BpmnModel.create({
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
      })
      // 抄送知会（#25）：ServiceTask + flowable:ccTo，部署合法不要求 bean 在场（ADR-0004）
      .addTask("cc", { id: "cc_1", name: "抄送法务备案", recipients: "张三,李四" })
      .addExclusiveGateway({ id: "fork1", name: "金额判断" })
      // 支 1：未命中大额条件时走总监单审
      .addUserTask({ id: "a_node", name: "总监审批", assignee: "${director}" })
      // 支 2：金额大于 1000 时走并行块（财务与法务同时复核）
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
      .addSequenceFlow({
        id: "fa",
        name: "常规审批",
        sourceRef: "fork1",
        targetRef: "a_node",
        default: true,
      })
      .addSequenceFlow({
        id: "fb",
        name: "大额复核",
        sourceRef: "fork1",
        targetRef: "pfork",
        condition: "${amount > 1000}",
      })
      .addSequenceFlow({ id: "fp_fin", sourceRef: "pfork", targetRef: "fin_node" })
      .addSequenceFlow({ id: "fp_legal", sourceRef: "pfork", targetRef: "legal_node" })
      .addSequenceFlow({ id: "fin_pj", sourceRef: "fin_node", targetRef: "pjoin" })
      .addSequenceFlow({ id: "legal_pj", sourceRef: "legal_node", targetRef: "pjoin" })
      .addSequenceFlow({ id: "pj_j1", sourceRef: "pjoin", targetRef: "join1" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "a_node", targetRef: "join1" })
      .addSequenceFlow({ id: "fj", sourceRef: "join1", targetRef: "end" })
  );
}

const demoModel = buildDemoModel();
/** 组合编辑会话：模型替换的原子性、文档编解码与表单目录管理都在会话内 */
const session = new FlowDesignSession(demoModel);
/** shallowRef 避免深代理模型私有字段（designer 组件内部另做 toRaw 双保险） */
const model = shallowRef<BpmnModel>(demoModel);

const view = ref<"dingtalk" | "bpmn">("dingtalk");
const xml = ref("");
const error = ref("");
/** 模型内容版本：编辑区 change 时递增，驱动画布重挂及宿主派生视图重算 */
const modelRevision = ref(0);
/** 模型整体替换（新建/打开）后的设计器重挂钥：换新实例渲染并重置抽屉状态 */
const designerKey = ref(0);
/** 设计文档链路（#71/#72）的保存结果 / 错误反馈 */
const docStatus = ref("");
const docError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
/** 表单目录换代钥：会话目录非响应式，目录操作后递增驱动视图重算 */
const formsTick = ref(0);
/** 表单管理 / 预览对话框 */
const managerVisible = ref(false);
const previewVisible = ref(false);
const previewNodeId = ref<string | undefined>(undefined);
let exportTimer: ReturnType<typeof setTimeout> | undefined;
let exportRevision = 0;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 表单目录的中立摘要（designer 的 formOptions 接缝） */
const formOptions = computed(() => {
  void formsTick.value;
  return session.formOptions();
});

/** 表单目录本体（管理面板 prop）：与会话目录同步的响应式视图 */
const formList = computed(() => {
  void formsTick.value;
  return session.current?.forms ?? [];
});

/** 审批节点清单（预览目标选择用）：从块树取审批节点 */
const approvalNodes = computed<{ id: string; label: string }[]>(() => {
  void modelRevision.value;
  const result: { id: string; label: string }[] = [];
  const walk = (items: BlockTreeNode[]): void => {
    for (const item of items) {
      if (item.kind === "block") {
        item.branches.forEach(walk);
        continue;
      }
      if (!isApprovalTask(item.element)) continue;
      result.push({
        id: item.id,
        label: String(item.element.get("name") ?? item.id) || item.id,
      });
    }
  };
  try {
    walk(deriveBlockTree(model.value));
  } catch {
    // 半损态模型：目标列表退化为空，不阻塞其他区域
  }
  return result;
});

/** 预览目标的有效表单：解析失败/引用失效时给出可读错误（不回退默认） */
const previewTarget = computed<
  { form: FormDefinition; source: "node" | "default"; key: string } | { error: string } | undefined
>(() => {
  const nodeId = previewNodeId.value;
  if (nodeId === undefined) return undefined;
  void formsTick.value;
  void modelRevision.value;
  if (!approvalNodes.value.some((node) => node.id === nodeId)) return undefined;
  const ref = resolveEffectiveForm(model.value, nodeId);
  if (ref.source === "none" || ref.key === undefined) {
    return { error: "该节点未指定表单，也没有可继承的流程默认表单" };
  }
  if (ref.key !== ref.key.trim()) {
    return { error: `表单引用失效：key「${ref.key}」含首尾空格（保留原值，请修复）` };
  }
  const form = session.current?.forms.find((candidate) => candidate.id === ref.key);
  if (form === undefined) {
    return { error: `表单引用失效：key「${ref.key}」不在表单目录中（保留原值，请修复）` };
  }
  return { form, source: ref.source, key: ref.key };
});

/** 引用诊断（保存后/导出前共用口径）：会话目录或模型变动后重算 */
const referenceIssues = computed<string[]>(() => {
  void formsTick.value;
  void modelRevision.value;
  return session.referenceIssues;
});

function refreshForms(): void {
  formsTick.value += 1;
}

function onFormCreate(name: string): void {
  try {
    session.createForm(name);
    refreshForms();
  } catch (e) {
    docError.value = messageOf(e);
  }
}

function onFormRename(id: string, name: string): void {
  try {
    session.renameForm(id, name);
    refreshForms();
  } catch (e) {
    docError.value = messageOf(e);
  }
}

function onFormUpdateContent(id: string, rules: string, options: string): void {
  session.updateFormContent(id, rules, options);
  refreshForms();
}

async function doExport(): Promise<void> {
  if (exportTimer !== undefined) clearTimeout(exportTimer);
  exportTimer = undefined;
  const revision = ++exportRevision;
  xml.value = "";
  error.value = "";
  try {
    const result = await exportDeployXml(model.value, session.current?.forms ?? []);
    if (revision === exportRevision) xml.value = result;
  } catch (e) {
    if (revision === exportRevision) {
      error.value = messageOf(e);
    }
  }
}

/** 编辑区 change → 画布重挂 + XML 防抖自动刷新（#27 三区联动） */
function onDesignerChange(): void {
  modelRevision.value += 1;
  if (
    previewNodeId.value !== undefined &&
    !approvalNodes.value.some((node) => node.id === previewNodeId.value)
  ) {
    previewNodeId.value = undefined;
  }
  // 编辑一发生，旧导出结果就不再代表当前模型；递增序号使迟到的 Promise 失效。
  exportRevision += 1;
  xml.value = "";
  error.value = "";
  if (exportTimer !== undefined) clearTimeout(exportTimer);
  exportTimer = setTimeout(() => void doExport(), 250);
}

/** 模型整体替换（新建/打开成功后）：换实例 + 重挂双视图 + 立即刷新导出预览 */
function adoptModel(next: BpmnModel): void {
  model.value = next;
  designerKey.value += 1;
  refreshForms();
  onDesignerChange();
}

function onNewDesign(): void {
  docStatus.value = "";
  docError.value = "";
  try {
    adoptModel(session.newDesign());
    docStatus.value = "已新建设计（最小流程），可直接编辑或下载设计文档";
  } catch (e) {
    docError.value = messageOf(e);
  }
}

function triggerDownload(json: string): void {
  const processId = String(model.value.process.get("id") ?? "flowduet-design");
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${processId}.flowduet.json`;
  anchor.click();
  // 异步释放：个别浏览器在 click 同步 revoke 会截断尚未开始的下载
  setTimeout(() => URL.revokeObjectURL(url));
}

/** 下载设计文档：保存允许业务草稿与引用失效，待修复项随保存结果一并提示 */
async function onDownloadDocument(): Promise<void> {
  docStatus.value = "";
  docError.value = "";
  try {
    const { json, pendingIssues, referenceIssues: refs } = await session.save();
    triggerDownload(json);
    const notes = [...pendingIssues, ...refs];
    docStatus.value =
      notes.length > 0
        ? `已保存设计文档；待修复 ${notes.length} 项（部署导出仍会被拦截）：\n${notes.join("\n")}`
        : "已保存设计文档，当前无待修复项";
  } catch (e) {
    docError.value = messageOf(e);
  }
}

/** 从文件打开：读取失败或校验失败都如实报错，当前编辑不被部分覆盖 */
async function onOpenFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // 先取引用再复位选择器：再次选择同一文件也要触发 change
  input.value = "";
  if (file === undefined) return;
  docStatus.value = "";
  docError.value = "";
  try {
    const text = await file.text();
    const state = await session.open(text);
    adoptModel(state.model);
    docStatus.value = `已打开设计文档（流程 ${String(state.model.process.get("name") ?? state.model.process.get("id"))}），可继续编辑`;
  } catch (e) {
    docError.value = messageOf(e);
  }
}

onUnmounted(() => {
  exportRevision += 1;
  if (exportTimer !== undefined) clearTimeout(exportTimer);
});
</script>

<template>
  <div class="playground">
    <header class="playground-header">
      <h1>FlowDuet Playground</h1>
      <div class="playground-toolbar">
        <ElRadioGroup v-model="view" data-test="view-switch" size="small">
          <ElRadioButton value="dingtalk" data-test="view-dingtalk">钉钉式</ElRadioButton>
          <ElRadioButton value="bpmn" data-test="view-bpmn">BPMN 视图</ElRadioButton>
        </ElRadioGroup>
        <ElButton data-test="new-design-btn" @click="onNewDesign">新建设计</ElButton>
        <ElButton data-test="open-doc-btn" @click="fileInput?.click()">打开文档</ElButton>
        <!-- 真实文件选择器：隐藏但保留可编程点击，测试经 change 事件直接注入 File -->
        <input
          ref="fileInput"
          class="playground-file-input"
          type="file"
          accept=".json,application/json"
          data-test="open-doc-input"
          @change="onOpenFile"
        />
        <ElButton data-test="form-manager-btn" @click="managerVisible = true">表单管理</ElButton>
        <ElButton data-test="form-preview-btn" @click="previewVisible = true">预览表单</ElButton>
        <ElButton type="primary" data-test="save-doc-btn" @click="onDownloadDocument">
          下载设计文档
        </ElButton>
        <ElButton type="primary" data-test="export-btn" @click="doExport">导出 XML</ElButton>
      </div>
    </header>
    <main class="playground-main">
      <section class="playground-editor">
        <!-- 互切 = 同一模型实例换投影组件；v-if 挂卸即重挂，读视图总是最新 -->
        <DingtalkDesigner
          v-if="view === 'dingtalk'"
          :key="designerKey"
          :model="model"
          :form-options="formOptions"
          @change="onDesignerChange"
        />
        <BpmnCanvas v-else :key="modelRevision" :model="model" />
      </section>
      <section class="playground-xml" data-test="xml-zone">
        <div v-if="docStatus || docError" class="playground-doc">
          <p v-if="docStatus" data-test="doc-status">{{ docStatus }}</p>
          <p v-if="docError" class="playground-error" data-test="doc-error">{{ docError }}</p>
        </div>
        <div v-if="referenceIssues.length > 0" class="playground-doc playground-doc--warn">
          <p data-test="reference-issues">
            表单引用待修复 {{ referenceIssues.length }} 项（部署导出会拦截）：
            {{ referenceIssues.join("；") }}
          </p>
        </div>
        <pre v-if="xml" data-test="xml-preview">{{ xml }}</pre>
        <p v-if="error" class="playground-error" data-test="xml-error">
          {{ error }}
        </p>
        <p v-else-if="!xml" class="playground-hint" data-test="xml-hint">
          点击「导出 XML」或编辑流程后自动生成
        </p>
      </section>
    </main>

    <ElDialog
      v-model="managerVisible"
      title="表单管理"
      width="520px"
      data-test="form-manager-dialog"
    >
      <FormManager
        :forms="formList"
        @create="onFormCreate"
        @rename="onFormRename"
        @update-content="onFormUpdateContent"
      />
    </ElDialog>

    <ElDialog
      v-model="previewVisible"
      title="按节点预览表单"
      width="640px"
      data-test="form-preview-dialog"
    >
      <div class="playground-preview-target">
        <label for="preview-node">审批节点</label>
        <select
          id="preview-node"
          v-model="previewNodeId"
          data-test="preview-node-select"
          :class="{ 'is-empty': approvalNodes.length === 0 }"
        >
          <option v-if="approvalNodes.length === 0" :value="undefined" disabled>
            当前流程没有审批节点
          </option>
          <option v-for="node in approvalNodes" :key="node.id" :value="node.id">
            {{ node.label }}
          </option>
        </select>
      </div>
      <p
        v-if="previewTarget && 'error' in previewTarget"
        class="playground-error"
        data-test="preview-target-error"
      >
        {{ previewTarget.error }}
      </p>
      <FormPreview
        v-else-if="previewTarget && 'form' in previewTarget"
        :key="previewNodeId"
        :form="previewTarget.form"
      />
      <p v-else class="playground-hint" data-test="preview-target-hint">
        选择一个审批节点后试填其有效表单。
      </p>
    </ElDialog>
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
  flex-wrap: wrap;
  gap: 8px;
}

.playground-header h1 {
  margin: 0;
  font-size: 16px;
  color: #2d3e97;
}

.playground-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 文件选择器由工具栏按钮代触发，视觉上隐藏但保留可聚焦性 */
.playground-file-input {
  display: none;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playground-doc {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  background: #f5f7fa;
}

.playground-doc--warn {
  background: #fdf6ec;
  border-color: #f3d19e;
}

.playground-doc p {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
}

.playground-preview-target {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.playground-preview-target label {
  font-size: 13px;
  color: #606266;
}

.playground-preview-target select {
  flex: 1;
  max-width: 260px;
  height: 28px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 13px;
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
  white-space: pre-wrap;
}

.playground-hint {
  color: #909399;
  font-size: 13px;
}
</style>
