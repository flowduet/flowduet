<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
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
import type { FormDefinition, SaveDesignDocumentResult } from "@flowduet/form-create";

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
/** 表单管理弹窗内的操作错误：引用位置必须在删除操作处可读。 */
const formManagerError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
/** 表单目录换代钥：会话目录非响应式，目录操作后递增驱动视图重算 */
const formsTick = ref(0);
/** 表单管理 / 预览对话框 */
const managerVisible = ref(false);
const previewVisible = ref(false);
const previewNodeId = ref<string | undefined>(undefined);
let exportTimer: ReturnType<typeof setTimeout> | undefined;
let exportRevision = 0;
/** 文件选择时即换代，迟到的读取/解析成功与失败都不能改写最新反馈。 */
let documentRevision = 0;

/** 本地草稿（#76）：保存到浏览器存储的键；刷新后经同一公开文档合同恢复 */
const LOCAL_DRAFT_KEY = "flowduet.playground.design";
/**
 * 编辑世代（#76 保存竞态口径，沿用 XML 预览的版本保护经验）：
 * 每次编辑成功递增；保存发起时快照，完成后比对——不相等说明序列化期间
 * 又有新编辑，保存的只是旧快照，不能把当前状态标记为已保存。
 */
const editGeneration = ref(0);
/** 最近一次成功保存对应的世代；dirty = 世代领先于它 */
const savedGeneration = ref(0);
/** 未保存状态：新建/打开文件前据此提示替换影响 */
const dirty = computed(() => editGeneration.value > savedGeneration.value);
/** 设计器与表单管理面板的组件引用：保存前收集未提交内容的公开边界 */
const designerRef = ref<InstanceType<typeof DingtalkDesigner> | null>(null);
const formManagerRef = ref<InstanceType<typeof FormManager> | null>(null);

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
  // 目录是当前设计的一部分：目录变化同样推进编辑世代并重刷导出预览，
  // 避免把旧导出结果继续当作当前设计的有效产物（A16 的目录侧路径）
  markEdited();
  invalidateExport();
}

/** 编辑成功后推进世代：dirty 判定与保存竞态快照共用同一计数 */
function markEdited(): void {
  editGeneration.value += 1;
}

/** 状态整体替换（新建/打开/恢复成功）或保存成功后：当前世代视为已保存 */
function markClean(): void {
  savedGeneration.value = editGeneration.value;
}

/**
 * 保存前收集未提交内容（#76 公开组合边界）：抽屉与表单编辑器里已输入
 * 但未确认的变更经组件提交边界落进会话，不能只保存旧模型遗漏当前输入。
 * 任一守卫拦截即中止保存——错误详情已在对应组件内呈现，这里补指引。
 */
function collectPendingEdits(): boolean {
  if (designerRef.value !== null && !designerRef.value.commitPendingChanges()) {
    docError.value = "流程抽屉内有未通过校验的输入，请先在抽屉中修正后再保存";
    return false;
  }
  if (formManagerRef.value !== null && !formManagerRef.value.commitPendingEdit()) {
    docError.value = "表单编辑器内有未通过校验的内容，请先在编辑器中修正后再保存";
    return false;
  }
  return true;
}

/** 保存快照的统一出口：收集 → 序列化 → 竞态比对，两条存储途径共用 */
async function saveSnapshot(): Promise<
  | { ok: true; result: SaveDesignDocumentResult; raced: boolean; snapshotGeneration: number }
  | { ok: false; refused: boolean; error?: unknown }
> {
  if (!collectPendingEdits()) return { ok: false, refused: true };
  const snapshotGeneration = editGeneration.value;
  try {
    const result = await session.save();
    return {
      ok: true,
      result,
      raced: editGeneration.value !== snapshotGeneration,
      snapshotGeneration,
    };
  } catch (e) {
    return { ok: false, refused: false, error: e };
  }
}

/** 表单目录操作前清除上一次错误，避免修复后仍显示旧位置。 */
function clearFormError(): void {
  docError.value = "";
  formManagerError.value = "";
}

function reportFormError(error: unknown): void {
  const message = messageOf(error);
  docError.value = message;
  formManagerError.value = message;
}

function openFormManager(): void {
  formManagerError.value = "";
  managerVisible.value = true;
}

function onFormCreate(name: string): void {
  clearFormError();
  try {
    session.createForm(name);
    refreshForms();
  } catch (e) {
    reportFormError(e);
  }
}

function onFormRename(id: string, name: string): void {
  clearFormError();
  try {
    session.renameForm(id, name);
    refreshForms();
  } catch (e) {
    reportFormError(e);
  }
}

function onFormUpdateContent(id: string, rules: string, options: string): void {
  clearFormError();
  session.updateFormContent(id, rules, options);
  refreshForms();
}

/** 删除表单：被引用时会被会话拒绝，引用位置随错误就地反馈（A06） */
function onFormDelete(id: string): void {
  clearFormError();
  try {
    session.deleteForm(id);
    refreshForms();
  } catch (e) {
    reportFormError(e);
  }
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
  markEdited();
  invalidateExport();
}

/** 编辑一发生，旧导出结果就不再代表当前模型；递增序号使迟到的 Promise 失效。 */
function invalidateExport(): void {
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
  // 整体替换后的状态是新的起点：不把替换动作本身记为未保存编辑
  markClean();
}

function onNewDesign(): void {
  confirmDiscard(() => {
    documentRevision += 1;
    docStatus.value = "";
    docError.value = "";
    try {
      adoptModel(session.newDesign());
      docStatus.value = "已新建设计（最小流程），可直接编辑或下载设计文档";
    } catch (e) {
      docError.value = messageOf(e);
    }
  });
}

/** 未保存替换确认（#76）：有未保存修改时先弹确认；取消则什么都不动 */
const discardVisible = ref(false);
let discardAction: (() => void) | null = null;

function confirmDiscard(action: () => void): void {
  // 表单编辑器开着（设计器内容无法逐输入感知）也按有未提交内容处理
  if (!dirty.value && !(formManagerRef.value?.hasOpenEditor() ?? false)) {
    action();
    return;
  }
  discardAction = action;
  discardVisible.value = true;
}

function onDiscardCancelled(): void {
  discardVisible.value = false;
  discardAction = null;
}

function onDiscardConfirmed(): void {
  const action = discardAction;
  discardVisible.value = false;
  discardAction = null;
  action?.();
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
  const shot = await saveSnapshot();
  if (!shot.ok) {
    if (!shot.refused) docError.value = messageOf(shot.error);
    return;
  }
  triggerDownload(shot.result.json);
  savedGeneration.value = shot.snapshotGeneration;
  if (shot.raced) {
    docStatus.value = "已下载保存发起时的快照；序列化期间又有新编辑，当前内容尚未保存";
    return;
  }
  const notes = [...shot.result.pendingIssues, ...shot.result.referenceIssues];
  docStatus.value =
    notes.length > 0
      ? `已保存设计文档；待修复 ${notes.length} 项（部署导出仍会被拦截）：\n${notes.join("\n")}`
      : "已保存设计文档，当前无待修复项";
}

/** Cmd/Ctrl+S：保存草稿的快捷键入口（防浏览器默认保存页行为） */
function onSaveShortcut(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
  event.preventDefault();
  void onSaveLocalDraft();
}

/** 保存草稿到浏览器本地存储（#76）：与下载/打开复用同一公开文档合同 */
async function onSaveLocalDraft(): Promise<void> {
  docStatus.value = "";
  docError.value = "";
  const shot = await saveSnapshot();
  if (!shot.ok) {
    if (!shot.refused) docError.value = messageOf(shot.error);
    return;
  }
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, shot.result.json);
  } catch (e) {
    // 存储被拒或容量不足：如实反馈，不显示保存成功（A14）
    docError.value = `本地存储写入失败（可能被浏览器设置拒绝或容量已满）：${messageOf(e)}`;
    return;
  }
  savedGeneration.value = shot.snapshotGeneration;
  if (shot.raced) {
    docStatus.value = "快照已保存到本地；序列化期间又有新编辑，当前内容尚未保存";
    return;
  }
  const notes = [...shot.result.pendingIssues, ...shot.result.referenceIssues];
  docStatus.value =
    notes.length > 0
      ? `已保存到本地；待修复 ${notes.length} 项（部署导出仍会被拦截）：\n${notes.join("\n")}`
      : "已保存到本地，刷新后可恢复本草稿";
}

/** 刷新恢复（#76）：挂载时读取本地草稿，经同一 open 合同原子替换演示模型 */
onMounted(() => {
  // 保存快捷键：抽屉/表单编辑器（非模态）本体会遮挡工具栏按钮，Cmd/Ctrl+S
  // 是编辑中途触达保存入口的稳定路径；先收集未提交内容再序列化。
  window.addEventListener("keydown", onSaveShortcut);
  void (async () => {
    let text: string | null;
    try {
      text = localStorage.getItem(LOCAL_DRAFT_KEY);
    } catch (e) {
      docError.value = `本地存储读取失败，已载入演示流程：${messageOf(e)}`;
      return;
    }
    if (text === null || text.trim() === "") return;
    const revision = ++documentRevision;
    docStatus.value = "";
    docError.value = "";
    try {
      const state = await session.open(Promise.resolve(text));
      if (revision !== documentRevision) return;
      adoptModel(state.model);
      docStatus.value = "已恢复本地草稿（最近一次保存的内容），可继续编辑";
    } catch (e) {
      if (revision === documentRevision) {
        docError.value = `本地草稿无法恢复，已保留当前演示流程：${messageOf(e)}`;
      }
    }
  })();
});

/** 从文件打开：读取失败或校验失败都如实报错，当前编辑不被部分覆盖 */
async function onOpenFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // 先取引用再复位选择器：再次选择同一文件也要触发 change
  input.value = "";
  if (file === undefined) return;
  confirmDiscard(() => void readFileIntoSession(file));
}

async function readFileIntoSession(file: File): Promise<void> {
  const revision = ++documentRevision;
  docStatus.value = "";
  docError.value = "";
  try {
    // 会话在读取前登记请求；同步读取异常也作为 Promise 拒绝统一处理。
    const state = await session.open(Promise.resolve().then(() => file.text()));
    if (revision !== documentRevision) return;
    adoptModel(state.model);
    docStatus.value = `已打开设计文档（流程 ${String(state.model.process.get("name") ?? state.model.process.get("id"))}），可继续编辑`;
  } catch (e) {
    if (revision === documentRevision) docError.value = messageOf(e);
  }
}

onUnmounted(() => {
  documentRevision += 1;
  exportRevision += 1;
  if (exportTimer !== undefined) clearTimeout(exportTimer);
  window.removeEventListener("keydown", onSaveShortcut);
});
</script>

<template>
  <div class="playground">
    <header class="playground-header">
      <h1>FlowDuet Playground</h1>
      <div class="playground-toolbar">
        <span v-if="dirty" class="playground-dirty" data-test="dirty-badge">有未保存修改</span>
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
        <ElButton data-test="form-manager-btn" @click="openFormManager">表单管理</ElButton>
        <ElButton data-test="form-preview-btn" @click="previewVisible = true">预览表单</ElButton>
        <ElButton plain type="primary" data-test="save-local-btn" @click="onSaveLocalDraft">
          保存草稿
        </ElButton>
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
          ref="designerRef"
          :key="designerKey"
          :model="model"
          :form-options="formOptions"
          @change="onDesignerChange"
          @draft-change="markEdited"
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
      v-model="discardVisible"
      title="放弃未保存的修改？"
      width="440px"
      data-test="discard-dialog"
    >
      <p class="playground-discard-hint">
        当前设计有未保存的修改（含抽屉与表单编辑器中已输入的内容）。继续将丢弃这些修改，且无法找回。
      </p>
      <template #footer>
        <ElButton data-test="discard-cancel" @click="onDiscardCancelled">取消</ElButton>
        <ElButton type="primary" data-test="discard-ok" @click="onDiscardConfirmed">
          放弃并继续
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="managerVisible"
      title="表单管理"
      width="520px"
      data-test="form-manager-dialog"
    >
      <p
        v-if="formManagerError"
        class="playground-error form-manager-action-error"
        data-test="form-manager-error"
        role="alert"
      >
        {{ formManagerError }}
      </p>
      <FormManager
        ref="formManagerRef"
        :forms="formList"
        @create="onFormCreate"
        @rename="onFormRename"
        @update-content="onFormUpdateContent"
        @delete="onFormDelete"
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

.playground-dirty {
  font-size: 12px;
  color: #b88230;
  background: #fdf6ec;
  border: 1px solid #f3d19e;
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.playground-discard-hint {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
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

.form-manager-action-error {
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}

.playground-hint {
  color: #909399;
  font-size: 13px;
}
</style>
