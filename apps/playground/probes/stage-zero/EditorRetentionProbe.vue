<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue";
import { FormDesigner, FlowDesignSession, type FormDefinition } from "@flowduet/form-create";
import { DingtalkDesigner, collectDraftIssues } from "@flowduet/designer";
import {
  insertCcAfter,
  CC_RECIPIENTS_PLACEHOLDER,
} from "../../../../packages/designer/src/operations";
import NodeDrawer from "../../../../packages/designer/src/components/NodeDrawer.vue";
import { rulesFor } from "./fixtures";
import { record } from "./probe-log";
import { ProbeDesignState, entityKey, type ProbeEditor, type FormContent } from "./design-state";
import type { EntityRef } from "./probe-contracts";

const session = new FlowDesignSession();
const model = session.newDesign({ processId: "editor_probe", processName: "编辑保留复验" });
const state = new ProbeDesignState(session);
const forms = shallowRef<readonly FormDefinition[]>([]),
  active = ref(0),
  mode = ref("keep"),
  stage = ref("form"),
  result = ref(""),
  error = ref(""),
  injectFailure = ref(false),
  drawerOpen = ref(false),
  drawerNode = ref("approval_1"),
  version = ref(0);
const drawer = ref<InstanceType<typeof NodeDrawer> | null>(null);
let ccId: string | undefined;
const views = computed(() => {
  void version.value;
  return forms.value.map((form) => {
    const entity = state.registry.ref("form", form.id);
    return { form, entity, key: entityKey(entity) };
  });
});
const options = computed(() => forms.value.map((f) => ({ id: f.id, name: f.name })));
function log(action: string, observed: unknown, entity?: EntityRef) {
  record("retention", action, observed, entity, state.registry.documentEpoch);
}
function refreshForms() {
  forms.value = session.current!.forms;
  version.value++;
}
function setInitialContent(id: string, n: number) {
  session.updateFormContent(id, rulesFor(n), "{}");
  state.reconcile(new Set([id]));
  refreshForms();
}
function addForm() {
  const entity = state.createForm(`表单${forms.value.length + 1}`);
  setInitialContent(entity.id, forms.value.length + 1);
}
addForm();
addForm();
model.setDefaultFormKey(forms.value[0]!.id);
function setEditor(entity: EntityRef, value: unknown) {
  const editor = value as ProbeEditor | null;
  state.registerEditor(
    entity,
    editor
      ? {
          exportContent: () => {
            if (injectFailure.value && entity.id === forms.value[1]?.id)
              throw new Error("注入的表单2导出失败，验证控制器失败边界");
            return editor.exportContent();
          },
        }
      : null,
  );
}
function snapshot(entity: EntityRef): FormContent | undefined {
  return state.buffer(entity)?.input as FormContent | undefined;
}
async function select(index: number) {
  error.value = "";
  if (mode.value === "snapshot") {
    try {
      state.capture(views.value[active.value]!.entity);
    } catch (e) {
      error.value = String(e);
      log("switch-blocked", {
        error: error.value,
        active: active.value,
        mounted: state.editorCount,
      });
      return;
    }
  }
  active.value = index;
  await nextTick();
  log("switch", { index, mode: mode.value, mounted: state.editorCount });
}
async function changeMode() {
  mode.value = mode.value === "keep" ? "snapshot" : "keep";
  for (const item of views.value) state.registry.put(item.entity, undefined);
  active.value = 0;
  version.value++;
  await nextTick();
  log("reset-mode", mode.value);
}
function collect(save = false) {
  try {
    error.value = "";
    const candidates = save ? state.applyAll() : state.collectAll();
    if (save) refreshForms();
    result.value = JSON.stringify(
      {
        savedToSession: save,
        candidates,
        session: session.current!.forms,
        entities: views.value.map((v) => v.entity),
        mountedEditors: state.editorCount,
      },
      null,
      2,
    );
    log(save ? "apply-all" : "capture-all", { count: candidates.length, sessionUnchanged: !save });
  } catch (e) {
    error.value = String(e);
    result.value = JSON.stringify(
      {
        failed: true,
        error: error.value,
        session: session.current!.forms,
        mountedEditors: state.editorCount,
      },
      null,
      2,
    );
    log("capture-failed", { error: error.value, mounted: state.editorCount });
  }
}
async function recreateActive() {
  const old = views.value[active.value]!.entity;
  try {
    state.deleteForm(old.id);
    const created = state.createForm("重建表单");
    setInitialContent(created.id, 100);
    active.value = forms.value.findIndex((f) => f.id === created.id);
    await nextTick();
    result.value = JSON.stringify(
      {
        old,
        created,
        oldBuffer: state.buffer(old) ?? null,
        oldResolvable: !!state.registry.resolve(old),
        session: session.current!.forms,
        mountedEditors: state.editorCount,
      },
      null,
      2,
    );
    log("form-recreated", { old, created, oldResolvable: !!state.registry.resolve(old) }, created);
  } catch (e) {
    error.value = String(e);
    log("delete-failed", { error: error.value, oldStillAlive: !!state.registry.resolve(old) }, old);
  }
}
function renameActive() {
  const f = forms.value[active.value]!;
  state.renameForm(f.id, f.name + "改名");
  refreshForms();
  log("rename", { id: f.id }, state.registry.ref("form", f.id));
}
async function cycle() {
  for (let n = 0; n < 20; n++) await select(n % forms.value.length);
  measure();
}
function measure() {
  result.value = JSON.stringify(
    {
      forms: forms.value.length,
      mountedEditors: state.editorCount,
      domNodes: document.querySelectorAll("*").length,
      designerHosts: document.querySelectorAll(".form-designer-host").length,
    },
    null,
    2,
  );
  log("measure", JSON.parse(result.value));
}
function openCc() {
  if (!ccId)
    state.mutateModel(() => {
      ccId = insertCcAfter(model, "approval_1", { recipients: CC_RECIPIENTS_PLACEHOLDER });
    });
  drawerNode.value = ccId!;
  drawerOpen.value = true;
}
function applyDrawer() {
  const ok = drawer.value?.commit({ allowIncomplete: true });
  state.reconcile();
  result.value = JSON.stringify(
    {
      ok,
      nodeId: drawerNode.value,
      recipients: model.elementOf(drawerNode.value).get("ccTo"),
      pendingIssues: collectDraftIssues(model),
      modelName: model.elementOf(drawerNode.value).get("name"),
      collection: (
        model.elementOf(drawerNode.value).get("loopCharacteristics") as
          { get(k: string): unknown } | undefined
      )?.get("collection"),
    },
    null,
    2,
  );
}
</script>
<template>
  <section
    @keydown.meta.s.prevent="collect(false)"
    @keydown.ctrl.s.prevent="collect(false)"
    @keydown.alt.enter.prevent="applyDrawer()"
  >
    <div class="bar">
      <b>策略：{{ mode === "keep" ? "按生命期保持挂载" : "单编辑器导出再恢复" }}</b>
      <button @click="changeMode">切换策略（重置探针）</button
      ><button @click="stage = stage === 'form' ? 'flow' : 'form'">切换设计阶段</button>
      <button @click="addForm">增加表单</button><button @click="cycle">往返切换20次并测量</button>
      <button @click="collect(false)">收集全部缓冲</button
      ><button @click="collect(true)">全部写入实验 session</button
      ><button @click="measure">测量资源</button>
      <label><input type="checkbox" v-model="injectFailure" />注入表单2收集失败</label>
      <button @click="renameActive">受控改名当前表单</button
      ><button @click="recreateActive">删除并重建当前表单（实验确认）</button>
    </div>
    <p class="error" role="alert">{{ error }}</p>
    <div v-show="stage === 'form'">
      <div class="bar">
        <button v-for="(item, i) in views" :key="item.key" @click="select(i)">
          {{ item.form.name }}{{ i === active ? "（当前）" : "" }}
        </button>
        <label
          >流程默认表单<select
            :value="model.defaultFormKey"
            @change="
              model.setDefaultFormKey(($event.target as HTMLSelectElement).value || undefined)
            "
          >
            <option value="">无</option>
            <option v-for="f in forms" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select></label
        >
      </div>
      <template v-for="(item, i) in views" :key="mode + item.key">
        <div
          v-if="mode === 'keep' || i === active"
          v-show="i === active"
          class="editor-host"
          :data-form-entity="item.key"
        >
          <FormDesigner
            :ref="(el) => setEditor(item.entity, el)"
            :name="item.form.name"
            :rules="snapshot(item.entity)?.rules ?? item.form.rules"
            :options="snapshot(item.entity)?.options ?? item.form.options"
            @save="
              (rules, options) => {
                state.stage(item.entity, { rules, options });
                result = '已收集到对象缓冲，尚未写session';
              }
            "
            @cancel="result = '保留编辑器与输入'"
          />
        </div>
      </template>
    </div>
    <div v-show="stage === 'flow'">
      <p>
        当前独立组件没有已发布的默认表单入口隐藏接缝；下面保留真实默认行为，不沿用旧分支实验属性。
      </p>
      <DingtalkDesigner :model="model" :form-options="options" />
    </div>
    <div class="bar">
      <button
        @click="
          drawerNode = 'approval_1';
          drawerOpen = true;
        "
      >
        打开现有节点抽屉</button
      ><button @click="openCc">打开抄送抽屉</button
      ><button @click="applyDrawer">调用草稿级提交</button
      ><span>抽屉内 Alt+Enter 测试草稿级提交</span>
    </div>
    <NodeDrawer
      ref="drawer"
      v-model="drawerOpen"
      :model="model"
      :node-id="drawerNode"
      @error="error = $event"
    />
    <pre data-test="retention-result">{{ result }}</pre>
  </section>
</template>
