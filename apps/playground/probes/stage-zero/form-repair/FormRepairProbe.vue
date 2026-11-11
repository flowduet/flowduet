<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef } from "vue";
import {
  FormManager,
  type FormDesigner,
  type FormDesignerEditingState,
} from "@flowduet/form-create";
import FormRepairInstance from "./FormRepairInstance.vue";
import { formStateFixture } from "../form-state/fixtures";
import { runLocalShortcut } from "../form-state/input-boundary";
import { stateSignature } from "../contracts/candidate";
import type { DraftValue, EditorAdapter } from "../contracts/types";
const textFixture = ref(false);
const savedJson = ref("");
const layout = ref<"top" | "grid">("top"),
  generation = ref(0),
  active = ref(0),
  phase = ref(true);
const instance = shallowRef(make());
function make() {
  const fixture = formStateFixture(`P1-${generation.value}`, { layout: layout.value });
  const c = fixture.controller;
  if (textFixture.value) {
    for (const target of fixture.forms) {
      const form = c.session.current!.forms.find((form) => form.id === target.ref.id)!;
      const rules = JSON.parse(form.rules);
      const fields = layout.value === "grid" ? rules[0].children[0].children : rules;
      fields.push(
        {
          type: "input",
          field: `${target.ref.id}_unset`,
          title: "未设置文字",
          props: { __flowduetTextDefault: true },
        },
        {
          type: "input",
          field: `${target.ref.id}_empty`,
          title: "装载显式空串",
          value: "",
          props: { __flowduetTextDefault: false, type: "textarea" },
        },
      );
      c.session.updateFormContent(form.id, JSON.stringify(rules), form.options);
    }
  }
  fixture.context.sync();
  fixture.forms = fixture.forms.map((target) =>
    fixture.context.target(target.ref.id, "form", "form-content"),
  );
  const contents = fixture.forms.map((target) => {
    const result = c.openEditor(target);
    if (!result.ok || result.value.kind !== "form-content") throw new Error("无法打开夹具");
    return result.value;
  });
  return { ...fixture, contents, signature: stateSignature(c.session) };
}
const peer = ref(false);
const managerStates = ref<(FormDesignerEditingState | null)[]>([null, null]);
const states = ref<(FormDesignerEditingState | null)[]>([null, null]);
const vms: Partial<Record<number, InstanceType<typeof FormDesigner>>> = {};
const liveBindings: {
  index: number;
  adapter: EditorAdapter;
  lease: ReturnType<typeof instance.value.controller.store.registerEditor>;
}[] = [];
const resultSequence = ref(0);
const faults = ref(["none", "none"]),
  calls = ref<string[]>([]),
  result = ref<unknown>(null),
  persistCalls = ref(0);
function bind(index: number, vm: InstanceType<typeof FormDesigner>) {
  vms[index] = vm;
  const { controller: c, forms } = instance.value;
  let cached: DraftValue | null = null;
  const adapter: EditorAdapter = {
    flush() {
      calls.value.push(`${index}:flush`);
      const capture = vm.captureContent();
      if (capture.status === "failed") throw new Error(capture.message);
      cached = capture.status === "captured" ? { kind: "form-content", ...capture.content } : null;
    },
    capture() {
      calls.value.push(`${index}:capture`);
      const fault = faults.value[index];
      if (fault === "throw") throw new Error(`injected-${index}`);
      if (fault === "null") return null;
      if (fault === "json") return { kind: "form-content", rules: "[", options: "{}" };
      if (fault === "kind") return { kind: "default-form", formKey: undefined };
      if (fault === "schema")
        return { kind: "form-content", rules: '[{"type":"upload","field":"bad"}]', options: "{}" };
      return cached;
    },
  };
  const lease = c.store.registerEditor(forms[index]!, adapter);
  liveBindings.push({ index, adapter, lease });
}
function touch(index: number) {
  instance.value.controller.drafts.touch(instance.value.forms[index]!);
}
function navigate(index?: number) {
  const state = vms[active.value]?.readEditingState();
  if (!state?.canSuspend) {
    result.value = { action: "navigation-blocked", state };
    return;
  }
  if (index === undefined) phase.value = !phase.value;
  else active.value = index;
}
async function collect() {
  // UI入口只等待一次Vue公开回显；同步EditorAdapter与A/B版本屏障保持原合同。
  await nextTick();
  calls.value = [];
  const prepared = await instance.value.controller.prepare("draft-save");
  result.value = { prepared, ...integrity() };
  resultSequence.value++;
}
function integrity() {
  return {
    calls: calls.value,
    liveUnchanged: stateSignature(instance.value.controller.session) === instance.value.signature,
    persistCalls: persistCalls.value,
    adaptersAndLeasesCurrent: liveBindings.every((b) => {
      const current = instance.value.controller.store.editor(instance.value.forms[b.index]!);
      return current?.adapter === b.adapter && current.lease === b.lease;
    }),
  };
}
async function requestSave() {
  await nextTick();
  calls.value = [];
  const saved = await instance.value.controller.save(async (snapshot) => {
    savedJson.value = snapshot.json;
    persistCalls.value++;
  });
  result.value = { saved, ...integrity() };
  resultSequence.value++;
}
let reopenRequest = 0;
async function reopenSaved() {
  if (!savedJson.value) return;
  const previous = instance.value,
    request = ++reopenRequest;
  const next = formStateFixture(`P2-reopen-${generation.value}`);
  try {
    await next.controller.session.open(savedJson.value);
    next.context.sync();
    const forms = next.controller.session.current!.forms.map((form) =>
      next.context.target(form.id, "form", "form-content"),
    );
    const contents = forms.map((target) => {
      const opened = next.controller.openEditor(target);
      if (!opened.ok || opened.value.kind !== "form-content") throw new Error("重开失败");
      return opened.value;
    });
    if (request !== reopenRequest || instance.value !== previous) {
      next.controller.dispose();
      return;
    }
    // 公开打开成功后显式替换实验实例；不把销毁称作K隐藏或R保真策略。
    previous.controller.dispose();
    liveBindings.length = 0;
    delete vms[0];
    delete vms[1];
    states.value = [null, null];
    generation.value++;
    instance.value = {
      ...next,
      forms,
      contents,
      signature: stateSignature(next.controller.session),
    };
  } catch (error) {
    next.controller.dispose();
    if (request === reopenRequest && instance.value === previous)
      result.value = { action: "reopen-failed", message: String(error) };
    return;
  }
  active.value = 0;
  phase.value = true;
  result.value = { action: "reopened-saved-document" };
}
function observe() {
  result.value = {
    states: [0, 1].map((i) => vms[i]?.readEditingState()),
    captures: [0, 1].map((i) => vms[i]?.captureContent()),
    ...integrity(),
  };
  resultSequence.value++;
}
function reload() {
  reopenRequest++;
  instance.value.controller.dispose();
  liveBindings.length = 0;
  delete vms[0];
  delete vms[1];
  states.value = [null, null];
  generation.value++;
  instance.value = make();
  active.value = 0;
  phase.value = true;
  result.value = null;
}
onBeforeUnmount(() => {
  reopenRequest++;
  instance.value.controller.dispose();
});
</script>
<template>
  <section
    data-test="form-repair-probe"
    @keydown.capture="runLocalShortcut($event, { observe, collect })"
  >
    <h2>B03 P1/P2 · retained 数值/日期/文字真实组件（K保持挂载）</h2>
    <select v-model="layout" data-test="repair-layout">
      <option>top</option>
      <option>grid</option>
    </select>
    <label
      ><input
        v-model="textFixture"
        type="checkbox"
        data-test="repair-text-fixture"
      />文字存在性夹具（重装生效）</label
    >
    <button data-test="repair-reopen" @click="reopenSaved">显式重开已保存文档</button>
    <button data-test="repair-reload" @click="reload">明确放弃并重装夹具</button>
    <button
      v-for="i in [0, 1]"
      :key="i"
      :data-test="`repair-nav-${i}`"
      @pointerdown.prevent="navigate(i)"
      @keydown.enter.prevent="navigate(i)"
    >
      表单{{ i + 1 }}
    </button>
    <button
      data-test="repair-phase"
      @pointerdown.prevent="navigate()"
      @keydown.enter.prevent="navigate()"
    >
      阶段切换
    </button>
    <button data-test="repair-observe" @pointerdown.prevent="observe">只读观察</button>
    <button data-test="repair-save" @pointerdown.prevent="requestSave">请求宿主保存</button>
    <button data-test="repair-capture" @pointerdown.prevent="collect">准备候选</button>
    <label v-for="i in [0, 1]" :key="`fault${i}`"
      >故障{{ i
      }}<select v-model="faults[i]" :data-test="`repair-fault-${i}`">
        <option v-for="value in ['none', 'throw', 'null', 'json', 'kind', 'schema']" :key="value">
          {{ value }}
        </option>
      </select></label
    >
    <div v-show="!phase">流程阶段占位，不是工作台</div>
    <FormRepairInstance
      v-for="(content, index) in instance.contents"
      v-show="phase && active === index"
      :key="`${generation}:${index}`"
      :name="`表单${index + 1}`"
      :owner="String(index)"
      :rules="content.rules"
      @ready="bind(index, $event)"
      @draft="touch(index)"
      @state="states[index] = $event"
    />
    <pre data-test="repair-states">{{ JSON.stringify(states) }}</pre>
    <pre data-test="repair-result" :data-sequence="resultSequence">{{
      JSON.stringify(result)
    }}</pre>
    <h3>真实FormManager（关闭是销毁，不提供K隐藏）</h3>
    <label
      ><input v-model="peer" type="checkbox" data-test="repair-peer" />第二个同ID
      FormManager（仅实验）</label
    >
    <div
      v-for="index in peer ? [0, 1] : [0]"
      :key="`${generation}:manager:${index}`"
      :data-repair-manager="index"
    >
      <FormManager
        editing-mode="retained"
        :forms="instance.controller.session.current!.forms"
        @editing-state-change="managerStates[index] = $event"
      />
    </div>
    <pre data-test="repair-manager-states">{{ JSON.stringify(managerStates) }}</pre>
  </section>
</template>
