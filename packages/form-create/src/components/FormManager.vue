<script setup lang="ts">
import { ref, shallowRef, nextTick, onMounted, onBeforeUnmount, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessageBox } from "element-plus";
import type { FormDefinition } from "../document.js";
import { assertFormDefinitionValid } from "../form-schema.js";
import FormDesigner from "./FormDesigner.vue";

/**
 * 表单管理面板（#72 最小形态 + #73 删除）：列表 + 新建 + 改名 + 删除 +
 * 进入设计器编辑内容。删除走两段确认（内容有设计工作量，误删代价高），
 * 引用守卫在会话侧（deleteForm），面板只经事件上抛操作，状态归
 * FlowDesignSession，宿主接线即可。
 */
const props = defineProps<{
  forms: readonly FormDefinition[];
  editingMode?: "legacy" | "retained";
}>();

import { createEditorInstanceKey } from "./editor-input-state.js";
import type { FormDesignerEditingState } from "../editor-state.js";

const emit = defineEmits<{
  create: [name: string];
  rename: [id: string, name: string];
  /** 设计器保存：内容（rules/options）成对上抛 */
  updateContent: [id: string, rules: string, options: string];
  /** 删除确认后的上抛：被引用时的拒绝与位置说明由会话 deleteForm 决定 */
  delete: [id: string];
  /** 表单编辑器尚未提交的设计变更，供宿主更新未保存状态。 */
  draftChange: [];
  editingStateChange: [state: FormDesignerEditingState | null];
}>();

const newName = ref("");
const renamingId = ref<string | null>(null);
const renamingValue = ref("");
const createError = ref("");
const renameError = ref("");
const designerRef = ref<InstanceType<typeof FormDesigner> | null>(null);
/** 两段删除确认：正在确认删除的表单 id（与改名态互斥展示） */
const deletingId = ref<string | null>(null);
const editing = ref<FormDefinition | null>(null);
const editVisible = ref(false);
const editError = ref("");
const mode = props.editingMode ?? "legacy";
const ownerKey = createEditorInstanceKey();
const modalClass = `flowduet-manager-modal-${ownerKey}`;
const contentClass = `flowduet-manager-content-${ownerKey}`;
type EditorSession = {
  key: string;
  source: FormDefinition;
  invalidated: boolean;
  closing: boolean;
  refused: boolean;
  confirming: boolean;
  handlers: Record<string, (...args: never[]) => unknown>;
  closed: () => void;
  requestClose: () => void;
  modelUpdate: (visible: boolean) => void;
  designer: InstanceType<typeof FormDesigner> | null;
  bindDesigner: (value: unknown) => void;
};
const editorSession = shallowRef<EditorSession | null>(null);
let disposed = false,
  unsupportedMode = false;
function current(session: EditorSession | null): session is EditorSession {
  return session !== null && editorSession.value === session && !session.closing && !disposed;
}
function definitionMatches(session: EditorSession): boolean {
  const source = props.forms.find((form) => form.id === session.source.id);
  const loaded = editing.value;
  return (
    source === session.source &&
    loaded !== null &&
    source.rules === loaded.rules &&
    source.options === loaded.options &&
    source.name === loaded.name &&
    source.provider === loaded.provider
  );
}
function activeDesigner() {
  return mode === "retained" ? (editorSession.value?.designer ?? null) : designerRef.value;
}
function readEditingState(): FormDesignerEditingState | null {
  if (editorSession.value === null && editing.value === null) return null;
  if (unsupportedMode)
    return Object.freeze({
      mode,
      revision: 0,
      canCapture: false,
      canSuspend: false,
      blockers: Object.freeze([
        { code: "unsupported-mode" as const, message: "编辑模式不可在当前挂载中切换" },
      ]),
    });
  const designer = activeDesigner();
  if (editorSession.value?.closing || !designer)
    return Object.freeze({
      mode,
      revision: 0,
      canSuspend: false,
      canCapture: false,
      blockers: Object.freeze([
        { code: "not-ready" as const, message: "表单编辑会话尚未就绪或正在收尾" },
      ]),
    });
  const child = designer.readEditingState();
  if (
    mode === "retained" &&
    editorSession.value &&
    (editorSession.value.invalidated || !definitionMatches(editorSession.value))
  )
    return Object.freeze({
      ...child,
      canSuspend: false,
      canCapture: false,
      blockers: Object.freeze([
        {
          code: "version-changed" as const,
          message: "表单定义已被替换，请由宿主确认处理后重开；当前输入仍保留",
        },
      ]),
    });
  return child;
}
function forwardState() {
  if (mode === "retained" && !disposed) emit("editingStateChange", readEditingState());
}
watch(
  () => props.editingMode,
  (value) => {
    if ((value ?? "legacy") !== mode) {
      unsupportedMode = true;
      forwardState();
    }
  },
  { flush: "sync" },
);
watch(
  () => {
    const source = props.forms.find((form) => form.id === editing.value?.id);
    return [source, source?.rules, source?.options, source?.name, source?.provider] as const;
  },
  () => {
    const session = editorSession.value;
    if (mode === "retained" && current(session) && !definitionMatches(session)) {
      session.invalidated = true;
      forwardState();
    }
  },
  { flush: "sync" },
);
function finishClose(session: EditorSession) {
  if (!current(session)) return;
  session.closing = true;
  editing.value = null;
  editVisible.value = false;
  forwardState();
}
async function requestClose(session: EditorSession) {
  if (!current(session) || session.confirming || mode !== "retained") return;
  if (session.refused) {
    session.refused = false;
    return;
  }
  let state = readEditingState();
  if (
    state?.blockers.some((b) => b.code === "pending-update") &&
    !state.blockers.some((b) => b.code === "composing" || b.code === "dragging")
  ) {
    await nextTick();
    if (!current(session) || unsupportedMode) return;
    state = readEditingState();
  }
  if (!state?.canSuspend) {
    editError.value = state?.blockers.map((b) => b.message).join("；") ?? "表单编辑器尚未准备好";
    return;
  }
  const revision = state.revision;
  session.confirming = true;
  try {
    await ElMessageBox.confirm("放弃本表单全部未提交修改并关闭？", "关闭表单", {
      confirmButtonText: "放弃并关闭",
      cancelButtonText: "继续编辑",
      type: "warning",
    });
    if (!current(session) || unsupportedMode) return;
    const after = readEditingState();
    if (!after?.canSuspend || after.revision !== revision) {
      editError.value = "确认期间编辑状态已变化，请重新确认";
      return;
    }
    // 最终复验到撤销回调资格之间没有await，授权只属于此次会话。
    finishClose(session);
  } catch {
    /* 取消、关闭确认或异常均未获得放弃授权。 */
  } finally {
    session.confirming = false;
  }
}
function closeGesture(event: Event) {
  const session = editorSession.value;
  if (mode !== "retained" || !current(session) || !editVisible.value) return;
  const path = event.composedPath();
  const ownModal = path.some(
    (el) => el instanceof HTMLElement && el.classList.contains(modalClass),
  );
  const ownContent = path.some(
    (el) => el instanceof HTMLElement && el.classList.contains(contentClass),
  );
  const ownButton = path.some(
    (el) =>
      el instanceof HTMLElement &&
      (el.dataset.formCloseOwner === session.key ||
        (ownModal && el.hasAttribute("data-form-close-control"))),
  );
  const keyboard = event instanceof KeyboardEvent;
  if (keyboard && event.key === "Tab" && ownContent && !readEditingState()?.canSuspend) {
    const content = path.find(
      (el) => el instanceof HTMLElement && el.classList.contains(contentClass),
    );
    if (!(content instanceof HTMLElement)) return;
    const controls = [
      ...content.querySelectorAll<HTMLElement>(
        "button, input, select, textarea, a[href], [tabindex]",
      ),
    ].filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-disabled") !== "true" &&
        el.getClientRects().length > 0,
    );
    const index = controls.indexOf(content.ownerDocument.activeElement as HTMLElement);
    const target =
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
    if (
      target &&
      (target.dataset.formCloseOwner === session.key ||
        target.hasAttribute("data-form-close-control"))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  if (
    (!ownModal && !ownButton) ||
    (!ownButton && ownContent) ||
    (keyboard && !["Enter", " "].includes(event.key))
  )
    return;
  session.refused = false;
  const state = readEditingState();
  if (!state?.canSuspend) {
    editError.value = state?.blockers.map((b) => b.message).join("；") ?? "表单编辑器尚未准备好";
    session.refused = true;
    event.preventDefault();
    event.stopPropagation();
  }
}
onMounted(() => {
  if (mode !== "retained") return;
  document.addEventListener("pointerdown", closeGesture, true);
  document.addEventListener("keydown", closeGesture, true);
  document.addEventListener("click", refusedClick, true);
});
function refusedClick(event: Event) {
  const session = editorSession.value;
  if (mode !== "retained" || !current(session) || !session.refused) return;
  const path = event.composedPath();
  const ownModal = path.some(
    (el) => el instanceof HTMLElement && el.classList.contains(modalClass),
  );
  const ownContent = path.some(
    (el) => el instanceof HTMLElement && el.classList.contains(contentClass),
  );
  const closeButton = path.some(
    (el) =>
      el instanceof HTMLElement &&
      (el.dataset.formCloseOwner === session.key ||
        (ownModal && el.hasAttribute("data-form-close-control"))),
  );
  const own = closeButton || (ownModal && !ownContent);
  if (!own) return;
  session.refused = false;
  event.preventDefault();
  event.stopPropagation();
}
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener("pointerdown", closeGesture, true);
  document.removeEventListener("keydown", closeGesture, true);
  document.removeEventListener("click", refusedClick, true);
});

function submitCreate(): void {
  if (newName.value.trim() === "") {
    createError.value = "表单名称不能为空白";
    return;
  }
  createError.value = "";
  emit("create", newName.value);
  newName.value = "";
}

function startRename(id: string, current: string): void {
  createError.value = "";
  renameError.value = "";
  deletingId.value = null;
  renamingId.value = id;
  renamingValue.value = current;
}

/** 进入删除确认态：先取消可能进行中的改名（两种行内态互斥） */
function requestDelete(id: string): void {
  renamingId.value = null;
  deletingId.value = id;
}

/** 确认删除：上抛会话执行；被引用时的拒绝消息由宿主回显 */
function confirmDelete(): void {
  const id = deletingId.value;
  if (id === null) return;
  deletingId.value = null;
  emit("delete", id);
}

function submitRename(): void {
  if (renamingId.value === null) return;
  if (renamingValue.value.trim() === "") {
    renameError.value = "表单名称不能为空白";
    return;
  }
  renameError.value = "";
  emit("rename", renamingId.value, renamingValue.value);
  renamingId.value = null;
}

function openEditor(form: FormDefinition): void {
  if (mode === "retained" && current(editorSession.value)) return;
  editError.value = "";
  const session: EditorSession = {
    key: createEditorInstanceKey(),
    source: form,
    invalidated: false,
    closing: false,
    refused: false,
    confirming: false,
    handlers: {},
    closed: () => {},
    requestClose: () => {},
    modelUpdate: () => {},
    designer: null,
    bindDesigner: () => {},
  };
  session.bindDesigner = (value) => {
    const designer = value as InstanceType<typeof FormDesigner> | null;
    if (session.designer === designer) return;
    const previous = session.designer;
    session.designer = designer;
    if (designer === null && designerRef.value === previous) designerRef.value = null;
    if (editorSession.value !== session || session.closing || disposed) return;
    designerRef.value = session.designer;
    forwardState();
  };
  session.handlers = {
    save: (rules: string, options: string) => {
      if (mode === "legacy" || current(session)) submitContent(rules, options, session);
    },
    cancel: () => {
      if (mode === "legacy") cancelEdit();
      else void requestClose(session);
    },
    draftChange: () => {
      if (mode === "legacy" || current(session)) emit("draftChange");
    },
    editingStateChange: () => {
      if (mode === "retained" && current(session)) forwardState();
    },
  };
  session.requestClose = () => {
    if (mode === "retained") void requestClose(session);
  };
  // provider的v-model回调也绑定原会话；不能让旧动画回调直接写新会话的显示状态。
  session.modelUpdate = (visible) => {
    if (mode === "legacy") {
      editVisible.value = visible;
      return;
    }
    if (current(session) && !visible) void requestClose(session);
  };
  session.closed = () => {
    if (editorSession.value !== session) return;
    if (mode === "legacy") editing.value = null;
    else if (!session.closing) return;
    editorSession.value = null;
    forwardState();
  };
  editorSession.value = session;
  editing.value = { ...form };
  editVisible.value = true;
  forwardState();
}
function cancelEdit(): void {
  if (mode === "retained") {
    const session = editorSession.value;
    if (session) void requestClose(session);
    return;
  }
  editing.value = null;
  editVisible.value = false;
  editorSession.value = null;
}
function legacyModelUpdate(visible: boolean) {
  if (mode === "legacy") editVisible.value = visible;
}
function beforeClose(done: () => void) {
  if (mode === "legacy") done();
  else editorSession.value?.requestClose();
}

/**
 * 提交编辑器内容（守卫 + 上抛 + 收尾）的单一出口：按钮保存与宿主收集
 * （#76 commitPendingEdit）共用。守卫失败返回 false 且编辑器保持打开。
 */
function submitContent(rules: string, options: string, session = editorSession.value): boolean {
  if (
    unsupportedMode ||
    (mode === "retained" &&
      (!current(session) || session.invalidated || !definitionMatches(session)))
  ) {
    editError.value = "表单编辑会话已变化，请由宿主确认处理后重开";
    return false;
  }
  const form = editing.value;
  if (form === null) return false;
  editError.value = "";
  // 内容守卫前置到本地：Vue3 的 emit 不会向调用方 rethrow 宿主处理器的
  // 异常，若依赖宿主 updateContent 抛错，这里的 catch 是收不到的死路径。
  // 会话侧重做同一校验（最终事实），此处保证「失败不关编辑器」的交互。
  try {
    assertFormDefinitionValid({ ...form, rules, options }, new Set());
  } catch (e) {
    editError.value = e instanceof Error ? e.message : String(e);
    return false;
  }
  emit("updateContent", form.id, rules, options);
  if (mode === "retained" && session) finishClose(session);
  else {
    editing.value = null;
    editVisible.value = false;
    editorSession.value = null;
  }
  return true;
}

/**
 * 保存前收集编辑器里的未提交内容（#76 公开组合边界）：编辑对话框打开时
 * 经真实设计器序列化并走与「保存表单内容」同一守卫；守卫拦截返回 false，
 * 宿主应中止保存而非绕过守卫。对话框未打开时无未提交内容，视为成功。
 */
function commitPendingEdit(): boolean {
  if (!hasOpenEditor()) return true;
  if (unsupportedMode) {
    editError.value = "编辑模式不可在当前挂载中切换，请确认处理后另开实例";
    return false;
  }
  try {
    if (mode === "retained") {
      const result = activeDesigner()?.captureContent();
      if (result?.status !== "captured") {
        editError.value =
          result?.status === "blocked"
            ? result.blockers.map((b) => b.message).join("；")
            : result?.status === "failed"
              ? result.message
              : "表单编辑器尚未准备好，请稍后重试";
        return false;
      }
      return submitContent(result.content.rules, result.content.options);
    }
    const content = designerRef.value?.exportContent();
    if (content === null || content === undefined) {
      editError.value = "表单编辑器尚未准备好，请稍后重试";
      return false;
    }
    return submitContent(content.rules, content.options);
  } catch (e) {
    // 第三方序列化失败不关闭编辑器，避免错误提示之外再次丢失输入。
    editError.value = e instanceof Error ? e.message : String(e);
    return false;
  }
}

/** 编辑对话框是否开着（#76）：宿主据此在替换当前设计前提示未提交内容 */
function hasOpenEditor(): boolean {
  return editVisible.value && editing.value !== null;
}

defineExpose({ commitPendingEdit, hasOpenEditor, readEditingState });
</script>

<template>
  <div class="form-manager" data-test="form-manager">
    <div class="form-manager-create">
      <ElInput
        v-model="newName"
        size="small"
        placeholder="新表单名（如：申请单）"
        data-test="form-manager-new-name"
        @input="createError = ''"
        @keyup.enter="submitCreate"
      />
      <ElButton
        size="small"
        type="primary"
        data-test="form-manager-create-btn"
        @click="submitCreate"
      >
        新建表单
      </ElButton>
    </div>

    <p v-if="createError" class="form-manager-error" data-test="form-manager-name-error">
      {{ createError }}
    </p>

    <p v-if="forms.length === 0" class="form-manager-empty" data-test="form-manager-empty">
      尚无表单：新建一张后可在流程中设为默认表单。
    </p>

    <ul v-else class="form-manager-list" data-test="form-manager-list">
      <li
        v-for="form in forms"
        :key="form.id"
        class="form-manager-item"
        :data-test="`form-item-${form.id}`"
      >
        <template v-if="renamingId === form.id">
          <span class="form-manager-rename-field">
            <ElInput
              v-model="renamingValue"
              size="small"
              :data-test="`form-rename-input-${form.id}`"
              @input="renameError = ''"
              @keyup.enter="submitRename"
            />
            <span
              v-if="renameError"
              class="form-manager-error"
              :data-test="`form-rename-error-${form.id}`"
            >
              {{ renameError }}
            </span>
          </span>
          <ElButton size="small" data-test="form-manager-rename-ok" @click="submitRename">
            确定
          </ElButton>
        </template>
        <template v-else-if="deletingId === form.id">
          <span class="form-manager-item-name">删除后不可恢复，确认删除？</span>
          <span class="form-manager-item-actions">
            <ElButton
              size="small"
              type="danger"
              :data-test="`form-delete-confirm-${form.id}`"
              @click="confirmDelete"
            >
              确认删除
            </ElButton>
            <ElButton
              size="small"
              :data-test="`form-delete-cancel-${form.id}`"
              @click="deletingId = null"
            >
              取消
            </ElButton>
          </span>
        </template>
        <template v-else>
          <span class="form-manager-item-name" :title="form.id">
            {{ form.name }}
            <code class="form-manager-item-id">{{ form.id }}</code>
          </span>
          <span class="form-manager-item-actions">
            <ElButton
              link
              size="small"
              :data-test="`form-rename-btn-${form.id}`"
              @click="startRename(form.id, form.name)"
            >
              改名
            </ElButton>
            <ElButton
              link
              size="small"
              type="primary"
              :data-test="`form-edit-btn-${form.id}`"
              @click="openEditor(form)"
            >
              编辑内容
            </ElButton>
            <ElButton
              link
              size="small"
              type="danger"
              :data-test="`form-delete-btn-${form.id}`"
              @click="requestDelete(form.id)"
            >
              删除
            </ElButton>
          </span>
        </template>
      </li>
    </ul>

    <ElDialog
      :model-value="editVisible"
      :key="mode === 'retained' ? (editorSession?.key ?? 'closed') : 'legacy'"
      :class="contentClass"
      :modal-class="modalClass"
      :show-close="mode === 'legacy'"
      :close-on-press-escape="mode === 'legacy'"
      :before-close="
        mode === 'retained' ? (editorSession?.requestClose ?? (() => {})) : beforeClose
      "
      v-bind="{
        onClosed: editorSession?.closed,
        'onUpdate:modelValue': editorSession?.modelUpdate ?? legacyModelUpdate,
      }"
      :title="editing ? `编辑表单：${editing.name}` : '编辑表单'"
      width="920px"
      data-test="form-manager-edit-dialog"
      destroy-on-close
    >
      <template v-if="mode === 'retained'" #header>
        <span>{{ editing ? `编辑表单：${editing.name}` : "编辑表单" }}</span>
        <button
          :data-form-close-owner="editorSession?.key"
          data-test="form-manager-close"
          v-bind="{ onClick: editorSession?.requestClose ?? (() => {}) }"
        >
          关闭
        </button>
      </template>
      <p v-if="editError" class="form-manager-error" data-test="form-manager-error">
        {{ editError }}
      </p>
      <FormDesigner
        v-if="editing"
        :ref="editorSession?.bindDesigner ?? (() => {})"
        :key="editorSession?.key ?? 'closed'"
        :editing-mode="mode"
        v-on="editorSession?.handlers ?? {}"
        :name="editing.name"
        :rules="editing.rules"
        :options="editing.options"
      />
    </ElDialog>
  </div>
</template>

<style scoped>
.form-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-manager-create {
  display: flex;
  gap: 8px;
}

.form-manager-empty {
  color: #909399;
  font-size: 13px;
}

.form-manager-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-manager-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.form-manager-rename-field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-manager-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.form-manager-item-id {
  margin-left: 6px;
  font-size: 11px;
  color: #909399;
}

.form-manager-item-actions {
  display: flex;
  gap: 4px;
}

.form-manager-error {
  color: #e5484d;
  font-size: 13px;
  margin: 0 0 8px;
  white-space: pre-wrap;
}
</style>
