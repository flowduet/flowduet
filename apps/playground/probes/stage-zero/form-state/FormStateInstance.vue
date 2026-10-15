<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef } from "vue";
import { FormDesigner } from "@flowduet/form-create";
import { targetKey, type EditTarget, type EditorLease, type DraftValue } from "../contracts/types";
import { stateSignature } from "../contracts/candidate";
import { formStateFixture, type FixtureOptions } from "./fixtures";
import { observeLiveState } from "./state-evidence";
import type { FormContent, LiveState, MountedEditor } from "./types";
const props = defineProps<{ owner: string; fixture: FixtureOptions }>();
const { controller: c, forms } = formStateFixture(props.owner, props.fixture);
const initialState = c.session.current!,
  initialModel = c.model,
  initialForms = [...initialState.forms],
  initialSignature = stateSignature(c.session);
function graphUnchanged() {
  try {
    return stateSignature(c.session) === initialSignature;
  } catch {
    return false;
  }
}
type View = {
  editor: MountedEditor;
  content: FormContent;
  vm?: InstanceType<typeof FormDesigner>;
  lease?: EditorLease;
  provisional: boolean;
  composing: boolean;
  dragging: boolean;
};
const views = shallowRef<View[]>([]),
  activeId = ref(""),
  phase = ref("forms"),
  tick = ref(0);
const resultSequence = ref(0);
const result = ref<unknown>(null),
  observation = ref<LiveState | null>(null);
let serial = 0,
  persistCalls = 0,
  disposed = false;
function observe(v: View) {
  return v.vm
    ? observeLiveState(v.vm.$el as HTMLElement, v, targetKey(v.editor.target))
    : {
        selectedField: null,
        configPage: null,
        pendingControls: [],
        openLayers: [],
        composing: v.composing,
        dragging: v.dragging,
        ownerKnown: false,
      };
}
function busy(v: View) {
  if (v.composing) throw new Error("输入法尚未完成");
  if (v.dragging) throw new Error("拖拽尚未完成");
  const state = observe(v);
  if (!state.ownerKnown || state.openLayers.length) throw new Error("弹层输入尚未确认或归属不明");
}
function bind(v: View, value: unknown) {
  if (!value || typeof value !== "object") return;
  v.vm = value as InstanceType<typeof FormDesigner>;
}
function make(target: EditTarget, content: FormContent, provisional = false) {
  let cached: DraftValue | null | undefined;
  const editor: MountedEditor = {
    target,
    instanceId: `${props.owner}:${++serial}`,
    adapter: {
      flush() {
        cached = undefined;
        busy(v);
        const output = v.vm?.exportContent();
        cached = output ? { kind: "form-content", ...output } : null;
      },
      capture() {
        busy(v);
        if (cached !== undefined) {
          const value = cached;
          cached = undefined;
          return value;
        }
        const output = v.vm?.exportContent();
        return output ? { kind: "form-content", ...output } : null;
      },
    },
  };
  const v: View = { editor, content, provisional, composing: false, dragging: false };
  views.value = [...views.value, v];
  return v;
}
async function mountActive(target: EditTarget) {
  const old = views.value.find(
    (v) =>
      !v.provisional &&
      targetKey(v.editor.target) === targetKey(target) &&
      c.store.editor(target)?.lease === v.lease,
  );
  if (old) return old.editor;
  const opened = c.openEditor(target);
  if (!opened.ok || opened.value.kind !== "form-content")
    throw new Error(opened.ok ? "不是表单" : opened.message);
  const v = make(target, opened.value);
  await nextTick();
  if (disposed || !c.store.resolve(target.ref)) throw new Error("目标已失效");
  v.lease = c.store.registerEditor(target, v.editor.adapter);
  return v.editor;
}
function show(editor: MountedEditor) {
  activeId.value = editor.instanceId;
  phase.value = "forms";
  tick.value++;
}
async function choose(target: EditTarget) {
  try {
    show(await mountActive(target));
    result.value = { ok: true, actual: "kept", active: target.ref };
  } catch (error) {
    result.value = { ok: false, message: String(error) };
  }
}
function touch(v: View) {
  if (
    !v.provisional &&
    v.lease &&
    c.store.editor(v.editor.target)?.lease === v.lease &&
    c.store.resolve(v.editor.target.ref)
  ) {
    c.drafts.touch(v.editor.target);
    tick.value++;
  }
}
function composition(v: View, ending: boolean) {
  v.composing = true;
  touch(v);
  if (ending)
    void nextTick(() => {
      v.composing = false;
      tick.value++;
    });
}
function current() {
  return views.value.find((v) => v.editor.instanceId === activeId.value);
}
function snapshot() {
  const view = current();
  observation.value = view ? observe(view) : null;
}
async function collect() {
  result.value = await c.prepare("draft-save");
  resultSequence.value++;
  tick.value++;
}
async function validate() {
  result.value = await c.validate();
  resultSequence.value++;
  tick.value++;
}
async function save() {
  result.value = await c.save(async () => {
    persistCalls++;
  });
  tick.value++;
}
function keys(event: KeyboardEvent) {
  if (!event.altKey) return;
  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    snapshot();
  } else if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    void collect();
  }
}
function state() {
  void tick.value;
  return {
    owner: props.owner,
    sameSession: c.session.current === initialState,
    sameModel: c.model === initialModel,
    sameForms:
      c.session.current!.forms.every((form, i) => form === initialForms[i]) &&
      c.session.current!.forms.length === initialForms.length,
    sameGraph: graphUnchanged(),
    activeId: activeId.value,
    phase: phase.value,
    persistCalls,
    generation: c.generation,
    dirty: c.dirty,
    validationCurrent: c.validationCurrent,
    forms: c.session.current!.forms,
    views: views.value.map((v) => ({
      id: v.editor.instanceId,
      target: v.editor.target.ref,
      live: Boolean(v.lease && c.store.editor(v.editor.target)?.lease === v.lease),
      provisional: v.provisional,
    })),
    conflicts: c.drafts.conflicts(),
    result: result.value,
    resultSequence: resultSequence.value,
  };
}
onBeforeUnmount(() => {
  disposed = true;
  c.dispose();
});
void choose(forms[0]!);
// 暴露仅供组件集成回归的现有对象；浏览器验收经可见实验控件操作。
defineExpose({
  controller: c,
  forms,
  current,
  observe: () => (current() ? observe(current()!) : null),
  collect,
});
</script>
<template>
  <section class="c-instance" :data-c-owner="owner" @keydown.capture="keys">
    <h2>{{ owner }} · 表单状态实验</h2>
    <div class="c-controls">
      <button
        v-for="(target, i) in forms"
        :key="i"
        :data-test="`c-select-${i}`"
        @click="choose(target)"
      >
        表单{{ i === 0 ? "甲" : "乙" }}
      </button>
      <button data-test="c-phase" @click="phase = phase === 'forms' ? 'flow' : 'forms'">
        切换表单/流程阶段
      </button>
      <button data-test="c-observe" @mousedown.prevent @click="snapshot">只读观察（Alt+O）</button>
      <button data-test="c-collect" @click="collect">收集候选（Alt+S）</button>
      <button data-test="c-validate" @click="validate">显式校验</button>
      <button data-test="c-save" @click="save">内存宿主保存</button>
    </div>
    <p v-show="phase === 'flow'" data-test="c-flow">流程阶段占位：隐藏表单实例，不提交输入。</p>
    <div v-show="phase === 'forms'">
      <div
        v-for="v in views"
        :key="v.editor.instanceId"
        v-show="v.editor.instanceId === activeId && !v.provisional"
        :data-c-view="v.editor.instanceId"
        :data-form-id="v.editor.target.ref.id"
        :data-lifetime="v.editor.target.ref.lifetime"
        @compositionstart.capture="composition(v, false)"
        @compositionend.capture="composition(v, true)"
      >
        <FormDesigner
          :ref="(value) => bind(v, value)"
          :name="v.editor.target.ref.id"
          :rules="v.content.rules"
          :options="v.content.options"
          @draft-change="touch(v)"
        />
      </div>
    </div>
    <details>
      <summary>五层观察与会话状态</summary>
      <pre data-test="c-observation">{{ JSON.stringify(observation, null, 2) }}</pre>
      <pre data-test="c-state">{{ JSON.stringify(state(), null, 2) }}</pre>
    </details>
  </section>
</template>
<style scoped>
.c-instance {
  border: 1px solid #aeb8cf;
  padding: 8px;
  margin-top: 12px;
}
.c-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
pre {
  overflow: auto;
  max-height: 440px;
}
</style>
