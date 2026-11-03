<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { ElButton, ElInput } from "element-plus";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import {
  DingtalkDesigner,
  type AppearanceColorSource,
  type AppearanceDensity,
  type AppearanceMode,
  type ComponentAppearance,
  type DesignerFormOption,
} from "@flowduet/designer";

interface InstanceControls {
  enabled: boolean;
  mounted: boolean;
  colorSource: AppearanceColorSource;
  mode: AppearanceMode;
  density: AppearanceDensity;
}

const FORM_OPTIONS: readonly DesignerFormOption[] = [
  { id: "form_apply", name: "申请单" },
  { id: "form_review", name: "复核单" },
];

function buildModel(processId: string, longName = false): BpmnModel {
  const model = BpmnModel.create({ processId, adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "发起" })
    .addUserTask({
      id: "approval",
      name: longName ? "经理审批：用于核对较长中文节点名称与属性输入" : "经理审批",
      assignee: "${manager}",
    })
    .addApprovalTask({ id: "countersign", name: "合同会签", collection: "approvers", mode: "all" })
    .addTask("cc", { id: "cc", name: "抄送法务备案", recipients: "张三,李四" })
    .addExclusiveGateway({ id: "fork", name: "金额判断" })
    .addUserTask({ id: "regular", name: "总监审批", assignee: "${director}" })
    .addUserTask({ id: "large", name: "财务复核", assignee: "${finance}" })
    .addExclusiveGateway({ id: "join", name: "汇聚" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f_start", sourceRef: "start", targetRef: "approval" })
    .addSequenceFlow({ id: "f_approval", sourceRef: "approval", targetRef: "countersign" })
    .addSequenceFlow({ id: "f_cc", sourceRef: "countersign", targetRef: "cc" })
    .addSequenceFlow({ id: "f_fork", sourceRef: "cc", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      name: "常规审批",
      sourceRef: "fork",
      targetRef: "regular",
      default: true,
    })
    .addSequenceFlow({
      id: "fb",
      name: "大额复核",
      sourceRef: "fork",
      targetRef: "large",
      condition: "${amount > 1000}",
    })
    .addSequenceFlow({ id: "fa_join", sourceRef: "regular", targetRef: "join" })
    .addSequenceFlow({ id: "fb_join", sourceRef: "large", targetRef: "join" })
    .addSequenceFlow({ id: "f_end", sourceRef: "join", targetRef: "end" });
  model.setDefaultFormKey("form_apply");
  return model;
}

const firstModel = buildModel("appearance_first", true);
const secondModel = buildModel("appearance_second");
const first = reactive<InstanceControls>({
  enabled: true,
  mounted: true,
  colorSource: "host",
  mode: "light",
  density: "comfortable",
});
const second = reactive<InstanceControls>({
  enabled: true,
  mounted: true,
  colorSource: "brand",
  mode: "light",
  density: "compact",
});
const firstInvalid = ref(false);
const hostDark = ref(document.documentElement.classList.contains("dark"));
const originallyDark = hostDark.value;
const firstChanges = ref(0);
const firstDraftChanges = ref(0);

function toAppearance(controls: InstanceControls): ComponentAppearance | undefined {
  if (!controls.enabled) return undefined;
  return {
    colorSource: controls.colorSource,
    mode: controls.mode,
    density: controls.density,
  };
}

const firstAppearance = computed<ComponentAppearance | undefined>(() => {
  if (firstInvalid.value && first.enabled)
    return { mode: first.mode, density: "invalid-density" } as unknown as ComponentAppearance;
  return toAppearance(first);
});
const secondAppearance = computed(() => toAppearance(second));

function onFirstValidChange(): void {
  firstInvalid.value = false;
}

function onFirstSourceChange(): void {
  onFirstValidChange();
  if (first.colorSource === "host") first.mode = hostDark.value ? "dark" : "light";
}

function onHostThemeChange(event: Event): void {
  const dark = (event.target as HTMLInputElement).checked;
  hostDark.value = dark;
  // 这是宿主主动切换自己的 EP 深色环境，不是组件 appearance 的副作用。
  document.documentElement.classList.toggle("dark", dark);
  if (first.colorSource === "host") first.mode = dark ? "dark" : "light";
}

onBeforeUnmount(() => {
  document.documentElement.classList.toggle("dark", originallyDark);
});
</script>

<template>
  <section class="appearance-scene" data-test="appearance-scene">
    <header class="appearance-scene-header">
      <div>
        <h2>节点属性抽屉外观验收</h2>
        <p>两个公开 DingtalkDesigner 实例共享同一 Vue app，模型与编辑缓冲各自独立。</p>
      </div>
      <label>
        <input
          type="checkbox"
          :checked="hostDark"
          data-test="appearance-host-dark"
          @change="onHostThemeChange"
        />
        宿主启用 EP 深色
      </label>
    </header>

    <div class="appearance-host-control" data-test="appearance-host-control">
      <span>无关宿主控件</span>
      <ElInput data-test="appearance-host-input" model-value="宿主原值" />
      <ElButton type="primary" data-test="appearance-host-button">宿主主按钮</ElButton>
    </div>

    <div class="appearance-instance-grid">
      <section class="appearance-instance" data-test="appearance-first-instance">
        <h3>实例一：目录选择器路径</h3>
        <div class="appearance-controls">
          <label
            ><input
              v-model="first.enabled"
              type="checkbox"
              data-test="appearance-first-enabled"
            />启用适配</label
          >
          <label
            ><input
              v-model="first.mounted"
              type="checkbox"
              data-test="appearance-first-mounted"
            />挂载实例</label
          >
          <label
            >配色
            <select
              v-model="first.colorSource"
              data-test="appearance-first-source"
              @change="onFirstSourceChange"
            >
              <option value="host">跟随宿主</option>
              <option value="brand">品牌预设</option>
            </select>
          </label>
          <label
            >主题
            <select
              v-model="first.mode"
              data-test="appearance-first-mode"
              :disabled="first.colorSource === 'host'"
              @change="onFirstValidChange"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label
            >密度
            <select
              v-model="first.density"
              data-test="appearance-first-density"
              @change="onFirstValidChange"
            >
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
          <button type="button" data-test="appearance-first-invalid" @click="firstInvalid = true">
            发送非法密度
          </button>
          <span data-test="appearance-first-change-count">change {{ firstChanges }}</span>
          <span data-test="appearance-first-draft-count">draft {{ firstDraftChanges }}</span>
        </div>
        <div class="appearance-designer-viewport">
          <DingtalkDesigner
            v-if="first.mounted"
            data-test="appearance-first-designer"
            :model="firstModel"
            :form-options="FORM_OPTIONS"
            :appearance="firstAppearance"
            @change="firstChanges += 1"
            @draft-change="firstDraftChanges += 1"
          />
        </div>
      </section>

      <section class="appearance-instance" data-test="appearance-second-instance">
        <h3>实例二：手写 formKey 路径</h3>
        <div class="appearance-controls">
          <label
            ><input
              v-model="second.enabled"
              type="checkbox"
              data-test="appearance-second-enabled"
            />启用适配</label
          >
          <label
            ><input
              v-model="second.mounted"
              type="checkbox"
              data-test="appearance-second-mounted"
            />挂载实例</label
          >
          <label
            >配色
            <select v-model="second.colorSource" data-test="appearance-second-source">
              <option value="host">跟随宿主</option>
              <option value="brand">品牌预设</option>
            </select>
          </label>
          <label
            >主题
            <select
              v-model="second.mode"
              data-test="appearance-second-mode"
              :disabled="second.colorSource === 'host'"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label
            >密度
            <select v-model="second.density" data-test="appearance-second-density">
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
        </div>
        <div class="appearance-designer-viewport">
          <DingtalkDesigner
            v-if="second.mounted"
            data-test="appearance-second-designer"
            :model="secondModel"
            :appearance="secondAppearance"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.appearance-scene {
  padding: 24px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.appearance-scene-header,
.appearance-host-control,
.appearance-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.appearance-scene-header {
  justify-content: space-between;
  margin-bottom: 16px;
}

.appearance-scene-header h2,
.appearance-instance h3 {
  margin: 0 0 4px;
}

.appearance-scene-header p {
  margin: 0;
  color: var(--el-text-color-regular);
}

.appearance-host-control {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.appearance-host-control .el-input {
  width: 180px;
}

.appearance-instance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.appearance-instance {
  min-width: 0;
}

.appearance-controls {
  margin-bottom: 12px;
  font-size: 13px;
}

.appearance-controls label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.appearance-designer-viewport {
  max-height: 760px;
  overflow: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

@media (max-width: 1100px) {
  .appearance-instance-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
