<script setup lang="ts">
import { ref } from "vue";
import { ElButton, ElDialog, ElInput } from "element-plus";
import type { FormDefinition } from "../document.js";
import { assertFormDefinitionValid } from "../form-schema.js";
import FormDesigner from "./FormDesigner.vue";

/**
 * 表单管理面板（#72 最小形态）：列表 + 新建 + 改名 + 进入设计器编辑内容。
 * 删除、同名区分与完整管理 UI 属下一票；本面板只经事件上抛操作，
 * 状态归 FlowDesignSession，宿主接线即可。
 */
defineProps<{
  forms: readonly FormDefinition[];
}>();

const emit = defineEmits<{
  create: [name: string];
  rename: [id: string, name: string];
  /** 设计器保存：内容（rules/options）成对上抛 */
  updateContent: [id: string, rules: string, options: string];
}>();

const newName = ref("");
const renamingId = ref<string | null>(null);
const renamingValue = ref("");
const createError = ref("");
const renameError = ref("");
const editing = ref<FormDefinition | null>(null);
const editVisible = ref(false);
const editError = ref("");

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
  renamingId.value = id;
  renamingValue.value = current;
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
  editError.value = "";
  editing.value = { ...form };
  editVisible.value = true;
}

function onDesignerSave(rules: string, options: string): void {
  const form = editing.value;
  if (form === null) return;
  editError.value = "";
  // 内容守卫前置到本地：Vue3 的 emit 不会向调用方 rethrow 宿主处理器的
  // 异常，若依赖宿主 updateContent 抛错，这里的 catch 是收不到的死路径。
  // 会话侧重做同一校验（最终事实），此处保证「失败不关编辑器」的交互。
  try {
    assertFormDefinitionValid({ ...form, rules, options }, new Set());
  } catch (e) {
    editError.value = e instanceof Error ? e.message : String(e);
    return;
  }
  emit("updateContent", form.id, rules, options);
  editing.value = null;
  editVisible.value = false;
}
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
          </span>
        </template>
      </li>
    </ul>

    <ElDialog
      v-model="editVisible"
      :title="editing ? `编辑表单：${editing.name}` : '编辑表单'"
      width="920px"
      data-test="form-manager-edit-dialog"
      destroy-on-close
    >
      <p v-if="editError" class="form-manager-error" data-test="form-manager-error">
        {{ editError }}
      </p>
      <FormDesigner
        v-if="editing"
        :name="editing.name"
        :rules="editing.rules"
        :options="editing.options"
        @save="onDesignerSave"
        @cancel="editing = null"
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
