<script setup lang="ts">
import type { ModdleElement } from "@flowduet/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { DingtalkDesigner, BpmnCanvas } from "@flowduet/designer";
import { FormDesigner } from "@flowduet/form-create";
import NodePropertyFields from "../../../../packages/designer/src/components/NodePropertyFields.vue";
import type {
  DesignerOperationRequest,
  DesignerSelectionRequest,
} from "../../../../packages/designer/src/property-editing";
import { createContractController } from "./contracts/controller";
import { fixture } from "./contracts/fixtures";
import {
  targetKey,
  type DraftValue,
  type EditTarget,
  type EditorLease,
  type EntityRef,
  type FlowPropertyDraft,
} from "./contracts/types";
import { rulesFor } from "./fixtures";
import { record } from "./probe-log";
const props = withDefaults(
  defineProps<{
    owner: string;
    nested?: boolean;
    includeForms?: boolean;
    invalidDefault?: boolean;
  }>(),
  { includeForms: true },
);
const ctx = fixture(props.owner, props.nested);
ctx.model.elementOf("b").set("assignee", "carol");
for (let n = 1; n <= (props.includeForms === false ? 0 : 2); n++) {
  const form = ctx.session.createForm(`表单${n === 1 ? "一" : "二"}`);
  ctx.session.updateFormContent(form.id, rulesFor(n), "{}");
}
ctx.sync();
if (props.invalidDefault) ctx.model.setDefaultFormKey("missing_form");
const controller = createContractController(ctx);
const defaultTarget = ctx.target("contract", "process", "default-form");
controller.openEditor(defaultTarget);
const saveGate = shallowRef<{ resolve(): void; reject(reason: Error): void }>();
async function save() {
  feedback(
    await controller.save(
      () =>
        new Promise<void>((resolve, reject) => {
          saveGate.value = { resolve, reject };
        }),
    ),
  );
}
function finishSave(success: boolean) {
  const gate = saveGate.value;
  saveGate.value = undefined;
  if (success) gate?.resolve();
  else gate?.reject(new Error("实验宿主拒绝保存"));
}
async function validate() {
  const result = await controller.validate();
  feedback(result.ok ? { ok: true, validationCurrent: controller.validationCurrent } : result);
}
const tick = ref(0),
  phase = ref<"flow" | "bpmn" | "forms">("flow"),
  message = ref(""),
  selected = shallowRef<EditTarget>(),
  flowTarget = shallowRef<EditTarget>(),
  selectedKey = ref(""),
  formKey = ref(""),
  injectFailure = ref(false),
  snapshot = ref(""),
  pendingDelete = shallowRef<{
    request: DesignerOperationRequest;
    refs: readonly EntityRef[];
    resolve: (value: boolean) => void;
  }>();
const diagram = ref<InstanceType<typeof DingtalkDesigner>>(),
  defaultControl = ref<HTMLSelectElement>();
type View = {
  key: string;
  target: EditTarget;
  initial: DraftValue;
  archived: boolean;
  comparisonId?: string;
  composing?: boolean;
};
const views = shallowRef<View[]>([]),
  bindings = new Map<string, { vm: object; lease: EditorLease }>();
let viewSequence = 0,
  destroyed = false;
function viewFor(target: EditTarget) {
  let entry = views.value.find((v) => !v.archived && targetKey(v.target) === targetKey(target));
  if (!entry) {
    const opened = controller.openEditor(target);
    if (!opened.ok) throw new Error(opened.message);
    entry = {
      key: `${targetKey(target)}:${++viewSequence}`,
      target,
      initial: opened.value,
      archived: false,
    };
    views.value = [...views.value, entry];
  }
  return entry;
}
function refresh() {
  if (destroyed) return;
  controller.sync();
  for (const form of controller.session.current!.forms) viewFor(ctx.target(form.id, "form"));
  const retained = [...controller.drafts.conflicts(), ...controller.drafts.comparisons()].map(
    (r) => r.target,
  );
  views.value = views.value.filter((v) =>
    v.archived
      ? controller.drafts.comparisons().some((r) => r.id === v.comparisonId)
      : controller.store.resolve(v.target.ref) ||
        retained.some((t) => targetKey(t) === targetKey(v.target)),
  );
  tick.value++;
}
function feedback(value: unknown) {
  if (destroyed) return;
  message.value = JSON.stringify(value, null, 2);
  record(`contract-${props.owner}`, "result", value, undefined, controller.store.epoch);
  refresh();
}
const unsubscribe = controller.subscribe((event) => {
  if (event.type === "restored" && event.target && !controller.store.editor(event.target)) {
    const old = views.value.find(
      (v) => !v.archived && targetKey(v.target) === targetKey(event.target!),
    );
    if (old) {
      views.value = views.value.filter((v) => v !== old);
      const current = viewFor(event.target);
      if (formKey.value === old.key) formKey.value = current.key;
      if (selectedKey.value === old.key) selectedKey.value = current.key;
    }
  }
  refresh();
});
function inputFor(view: View): DraftValue {
  void tick.value;
  if (view.archived) return view.initial;
  const input = controller.drafts.input(view.target);
  if (input) return input;
  try {
    return controller.read(view.target);
  } catch {
    return view.initial;
  }
}
function propertyFor(view: View): FlowPropertyDraft | undefined {
  const input = inputFor(view);
  return input.kind === "form-content" || input.kind === "default-form" ? undefined : input;
}
function isRetained(view: View) {
  void tick.value;
  return view.archived || !controller.store.resolve(view.target.ref);
}
function active(view: View) {
  const bound = bindings.get(view.key);
  return Boolean(
    bound && !view.archived && controller.store.editor(view.target)?.lease === bound.lease,
  );
}
function touch(view: View) {
  if (active(view)) {
    controller.drafts.touch(view.target);
    tick.value++;
  }
}
function stage(view: View, draft: FlowPropertyDraft) {
  if (!active(view)) return;
  controller.drafts.stage(view.target, draft);
  refresh();
}
function composition(view: View, ending: boolean) {
  view.composing = true;
  touch(view);
  if (ending)
    void nextTick(() => {
      view.composing = false;
      tick.value++;
    });
}
function bind(view: View, raw: unknown) {
  const previous = bindings.get(view.key);
  if (raw === null) {
    if (previous) controller.store.releaseEditor(previous.lease);
    bindings.delete(view.key);
    return;
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    (previous?.vm === raw && controller.store.editor(view.target)?.lease === previous.lease) ||
    !controller.store.resolve(view.target.ref) ||
    view.archived
  )
    return;
  let cached: DraftValue | null | undefined;
  const isForm = view.initial.kind === "form-content";
  const form = raw as InstanceType<typeof FormDesigner>,
    fields = raw as InstanceType<typeof NodePropertyFields>;
  const lease = controller.store.registerEditor(view.target, {
    flush() {
      if (view.composing) throw new Error("输入法尚未完成本次输入");
      if (isForm) {
        const content = form.exportContent();
        cached = content ? { kind: "form-content", ...content } : null;
      } else fields.flush();
    },
    capture() {
      if (view.composing) throw new Error("输入法尚未完成本次输入");
      if (isForm && injectFailure.value && view.target.ref.id === "form_2")
        throw new Error("实验注入：第二张表单收集失败");
      if (!isForm) return fields.capture();
      if (cached !== undefined) {
        const value = cached;
        cached = undefined;
        return value;
      }
      const content = form.exportContent();
      return content ? { kind: "form-content", ...content } : null;
    },
  });
  bindings.set(view.key, { vm: raw, lease });
}
function choose(target: EditTarget) {
  controller.sync();
  if (!controller.store.resolve(target.ref)) {
    feedback({ code: "stale-target" });
    return;
  }
  controller.cancelLocate();
  selected.value = target;
  if (target.facet === "default-form") {
    const opened = controller.openEditor(target);
    if (!opened.ok) {
      feedback(opened);
      return;
    }
    phase.value = "forms";
    refresh();
    return;
  }
  const view = viewFor(target);
  if (target.facet === "form-content") {
    formKey.value = view.key;
    phase.value = "forms";
  } else {
    flowTarget.value = target;
    selectedKey.value = view.key;
    phase.value = "flow";
  }
  refresh();
}
function selection(request: DesignerSelectionRequest) {
  controller.sync();
  if (request.model !== controller.model || request.renderRevision !== controller.revision) {
    feedback({ code: "version-changed" });
    return;
  }
  try {
    const result = controller.target(
      controller.model.elementOf(request.id).$type === "bpmn:SequenceFlow" ? "flow" : "node",
      request.id,
      "properties",
    );
    if (result.ok) choose(result.value);
    else feedback(result);
  } catch (error) {
    feedback(String(error));
  }
}
async function operation(request: DesignerOperationRequest) {
  const result = await controller.executeOperation(
    request,
    (refs) =>
      new Promise<boolean>((resolve) => {
        pendingDelete.value = { request, refs, resolve };
      }),
  );
  feedback(result);
}
function confirmDelete(value: boolean) {
  const pending = pendingDelete.value;
  pendingDelete.value = undefined;
  pending?.resolve(value);
}
async function locate(id: string, kind: "node" | "flow" | "process" = "node") {
  const target = ctx.target(id, kind, kind === "process" ? "default-form" : "properties");
  feedback(await controller.locate(target));
}
function navigateFlow() {
  controller.cancelLocate();
  phase.value = "flow";
  if (flowTarget.value && controller.store.resolve(flowTarget.value.ref)) choose(flowTarget.value);
  else {
    selected.value = undefined;
    selectedKey.value = "";
    refresh();
  }
}
function navigateForms() {
  controller.cancelLocate();
  phase.value = "forms";
}
function navigateBpmn() {
  controller.cancelLocate();
  phase.value = "bpmn";
}
async function apply() {
  if (flowTarget.value) feedback(await controller.apply(flowTarget.value));
}
async function applyDefault() {
  const result = await controller.apply(defaultTarget);
  if (result.ok) controller.openEditor(defaultTarget);
  feedback(result);
}
const defaultValue = computed(() => {
  void tick.value;
  const input = controller.drafts.input(defaultTarget);
  return input?.kind === "default-form"
    ? input.formKey
    : controller.store.resolve(defaultTarget.ref)
      ? controller.model.defaultFormKey
      : undefined;
});
async function collect() {
  const result = await controller.prepare("draft-save");
  if (result.ok) snapshot.value = result.value.json;
  feedback(result.ok ? { ok: true, snapshotId: result.value.id } : result);
}
function unknownReplace() {
  controller.session.updateFormContent("form_2", "[]", '{"formName":"外部内容"}');
  refresh();
}
function resolve(id: string, action: "discard-local" | "restart-on-current") {
  controller.sync();
  const conflict = controller.drafts.conflicts().find((r) => r.id === id);
  if (!conflict) return;
  const result = controller.resolveConflict(id, action);
  if (result.ok) {
    const old = views.value.find(
      (v) => !v.archived && targetKey(v.target) === targetKey(conflict.target),
    );
    if (old && action === "restart-on-current") {
      old.initial = conflict.input ?? old.initial;
      old.archived = true;
      old.comparisonId = id;
    } else if (old) {
      // 明确放弃后旧组件必须销毁，重新从当前对象建立字段、基线与租约。
      views.value = views.value.filter((v) => v !== old);
    }
    if (controller.store.resolve(conflict.target.ref)) choose(conflict.target);
  }
  feedback(result);
}
const selectedReadonly = computed(() => {
  void tick.value;
  const view = views.value.find((v) => v.key === selectedKey.value);
  return (
    Boolean(view && (view.archived || !controller.store.resolve(view.target.ref))) ||
    Boolean(flowTarget.value && !controller.store.resolve(flowTarget.value.ref))
  );
});
// 仅实验页提供故障入口，原始异常与恢复都经过同一控制器接缝观察。
function externalProperty(unreadable: boolean) {
  controller.model.elementOf("approval_1").set("extraFlag", unreadable ? 1n : undefined);
  feedback(controller.sync());
}
function mismatchedDraft() {
  feedback(controller.stage(ctx.target("approval_1"), { kind: "process", name: "错误类型" }));
}
function externalDefault() {
  controller.model.setDefaultFormKey("external_form");
  refresh();
}
function unknownNode() {
  controller.model.elementOf("approval_1").set("name", "外部节点名称");
  refresh();
}
function showComparison(id: string) {
  const v = views.value.find((v) => v.comparisonId === id);
  if (v) {
    selected.value = v.target;
    selectedKey.value = v.key;
    if (v.target.ref.kind === "form") {
      formKey.value = v.key;
      phase.value = "forms";
    } else phase.value = "flow";
    refresh();
  }
}
function closeComparison(id: string) {
  controller.drafts.closeComparison(id);
  refresh();
}
function showOriginal(target: EditTarget) {
  const view = views.value.find((v) => !v.archived && targetKey(v.target) === targetKey(target));
  if (!view) return;
  selected.value = target;
  selectedKey.value = view.key;
  if (target.ref.kind === "form") {
    formKey.value = view.key;
    phase.value = "forms";
  } else phase.value = "flow";
  refresh();
}
const state = computed(() => {
  void tick.value;
  return {
    owner: props.owner,
    generation: controller.generation,
    savedGeneration: controller.savedGeneration,
    dirty: controller.dirty,
    hasPersisted: controller.hasPersisted,
    validationCurrent: controller.validationCurrent,
    saving: Boolean(saveGate.value),
    epoch: controller.store.epoch,
    revision: controller.revision,
    selected: selected.value,
    actualSelectedId: diagram.value?.actualSelectedId,
    forms: controller.session.current!.forms,
    defaultFormKey: controller.model.defaultFormKey,
    modelElements: ((controller.model.process.get("flowElements") as ModdleElement[]) ?? []).map(
      (el) => ({
        id: el.get("id"),
        type: el.$type,
        name: el.get("name"),
        assignee: el.get("assignee"),
        source: (el.get("sourceRef") as ModdleElement | undefined)?.get("id"),
        target: (el.get("targetRef") as ModdleElement | undefined)?.get("id"),
        condition: (el.get("conditionExpression") as ModdleElement | undefined)?.get("body"),
        default: (el.get("default") as ModdleElement | undefined)?.get("id"),
        outgoing: ((el.get("outgoing") as ModdleElement[] | undefined) ?? []).map((f) =>
          f.get("id"),
        ),
      }),
    ),
    buffers: controller.drafts.buffers().map((r) => ({
      id: r.id,
      target: r.target,
      input: r.input,
      status: r.status,
      retained: Boolean(r.retained),
    })),
    conflicts: controller.drafts.conflicts().map((r) => ({
      id: r.id,
      status: r.status,
      target: r.target,
      input: r.input,
      retained: Boolean(r.retained),
    })),
    mountedEditors: bindings.size,
  };
});
onMounted(() => {
  refresh();
  choose(ctx.target("approval_1"));
  controller.attachView({
    async route(target) {
      if (target.facet === "default-form" && target.ref !== defaultTarget.ref)
        throw new Error("默认配置视图属于旧文档，请重建宿主视图");
      selected.value = target;
      if (target.facet === "default-form") phase.value = "forms";
      else {
        phase.value = "flow";
        flowTarget.value = target;
        selectedKey.value = viewFor(target).key;
      }
      refresh();
      await nextTick();
    },
    async focus(target, signal) {
      if (target.facet === "default-form") {
        await nextTick();
        if (signal?.aborted) return { status: "cancelled" };
        defaultControl.value?.focus();
        return defaultControl.value?.ownerDocument.activeElement === defaultControl.value
          ? { status: "focused", selectedId: String(controller.model.process.get("id")) }
          : { status: "missing" };
      }
      return diagram.value?.focusElement(target.ref.id, signal) ?? { status: "missing" };
    },
    selectedId() {
      return phase.value === "forms" &&
        selected.value?.facet === "default-form" &&
        defaultControl.value?.ownerDocument.activeElement === defaultControl.value
        ? String(controller.model.process.get("id"))
        : diagram.value?.actualSelectedId;
    },
  });
});
onBeforeUnmount(() => {
  destroyed = true;
  unsubscribe();
  controller.dispose();
  finishSave(false);
  confirmDelete(false);
});
defineExpose({ controller, refresh });
</script>
<template>
  <section class="contract-instance" :data-contract-owner="owner">
    <h2>实例 {{ owner }} · 候选编辑合同</h2>
    <div class="bar">
      <button @click="navigateFlow">流程实验</button><button @click="navigateBpmn">BPMN 只读</button
      ><button @click="navigateForms">表单实验</button>
      <button @click="locate('approval_1')">定位首节点</button
      ><button @click="locate('tail')">定位同名后继</button
      ><button @click="locate('fa', 'flow')">定位支路 fa</button
      ><button @click="locate('contract', 'process')">定位默认表单</button
      ><button @click="collect">收集候选</button><button @click="validate">显式校验</button
      ><button @click="save" :disabled="Boolean(saveGate)">请求宿主保存</button
      ><button v-if="saveGate" @click="finishSave(true)">模拟宿主确认</button
      ><button v-if="saveGate" @click="finishSave(false)">模拟宿主失败</button>
      <label><input type="checkbox" v-model="injectFailure" />注入第二张收集失败</label
      ><button @click="unknownNode">实验：外部改首节点名称</button
      ><button @click="externalProperty(true)">实验：不可序列化外部属性</button
      ><button @click="externalProperty(false)">实验：恢复外部属性</button
      ><button @click="mismatchedDraft">实验：错误类型输入</button
      ><button @click="externalDefault">实验：外部改默认表单</button
      ><button :disabled="includeForms === false" @click="unknownReplace">
        实验：外部替换表单二
      </button>
    </div>
    <div v-if="pendingDelete" class="bar" data-test="delete-confirmation">
      将删除
      {{
        pendingDelete.refs.map((r) => `${r.kind}:${r.id}`).join("、")
      }}；这些对象的未应用输入会一并放弃，存续支路输入保留。确认后才提交。<button
        @click="confirmDelete(true)"
      >
        确认删除</button
      ><button @click="confirmDelete(false)">取消删除</button>
    </div>
    <div class="contract-flow" v-show="phase === 'flow'">
      <DingtalkDesigner
        ref="diagram"
        :model="controller.model"
        :model-revision="controller.revision"
        property-editing="external"
        :selected-id="
          flowTarget && controller.store.resolve(flowTarget.ref) ? flowTarget.ref.id : undefined
        "
        :show-default-form="false"
        :form-options="controller.session.formOptions()"
        @selection-request="selection"
        @operation-request="operation"
      />
      <aside>
        <p>固定面板实验：应用/还原只作用于所选对象。</p>
        <div
          v-for="view in views.filter((v) => propertyFor(v))"
          :key="view.key"
          v-show="selectedKey === view.key"
          :inert="isRetained(view) || undefined"
          :data-property-target="view.target.ref.id"
        >
          <NodePropertyFields
            v-if="propertyFor(view)"
            :ref="(value) => bind(view, value)"
            :draft="propertyFor(view)!"
            :form-options="controller.session.formOptions()"
            :default-form-key="controller.model.defaultFormKey"
            @update:draft="stage(view, $event)"
            @unserialized-input="touch(view)"
          />
        </div>
        <button @click="apply" :disabled="!flowTarget || selectedReadonly">应用</button
        ><button
          :disabled="!flowTarget || selectedReadonly"
          @click="flowTarget && feedback(controller.restore(flowTarget))"
        >
          还原
        </button>
      </aside>
    </div>
    <div v-if="phase === 'bpmn'" style="height: 430px">
      <p>流程级只读摘要：{{ controller.model.process.get("id") }}</p>
      <BpmnCanvas :model="controller.model" :version="controller.revision" />
    </div>
    <div v-show="phase === 'forms'">
      <label
        >唯一流程默认表单入口
        <select
          ref="defaultControl"
          data-test="contract-default-form"
          :disabled="!controller.store.resolve(defaultTarget.ref)"
          :value="defaultValue ?? ''"
          @change="
            controller.stage(defaultTarget, {
              kind: 'default-form',
              formKey: ($event.target as HTMLSelectElement).value || undefined,
            });
            refresh();
          "
        >
          <option value="">无</option>
          <option
            v-if="
              defaultValue && !controller.session.current!.forms.some((f) => f.id === defaultValue)
            "
            :value="defaultValue"
          >
            {{ defaultValue }}（目录外，原值保留）
          </option>
          <option v-for="form in controller.session.current!.forms" :key="form.id" :value="form.id">
            {{ form.name }}
          </option>
        </select></label
      ><button @click="applyDefault()">应用默认表单</button>
      <div>
        <button
          v-for="form in controller.session.current!.forms"
          :key="form.id"
          @click="choose(ctx.target(form.id, 'form'))"
        >
          编辑 {{ form.name }} · {{ form.id }}</button
        ><button
          :disabled="includeForms === false"
          @click="feedback(controller.renameForm(ctx.target('form_2', 'form'), '目录改名'))"
        >
          受控改名表单二
        </button>
      </div>
      <button
        :disabled="
          selected?.facet !== 'form-content' ||
          !controller.store.resolve(selected.ref) ||
          views.some((v) => v.key === formKey && v.archived)
        "
        @click="selected && feedback(controller.restore(selected))"
      >
        还原当前表单（实验）
      </button>
      <div
        v-for="view in views.filter((v) => v.initial.kind === 'form-content')"
        :key="view.key"
        v-show="formKey === view.key"
        :inert="isRetained(view) || undefined"
        :data-form-lifetime="view.target.ref.lifetime"
        :data-form-id="view.target.ref.id"
        class="contract-form"
        @compositionstart.capture="composition(view, false)"
        @compositionend.capture="composition(view, true)"
      >
        <FormDesigner
          :ref="(value) => bind(view, value)"
          :name="view.target.ref.id"
          :rules="view.initial.kind === 'form-content' ? view.initial.rules : '[]'"
          :options="view.initial.kind === 'form-content' ? view.initial.options : '{}'"
          @draft-change="touch(view)"
          @save="
            (rules, options) => {
              if (!active(view)) return;
              controller.drafts.stage(view.target, { kind: 'form-content', rules, options });
              refresh();
            }
          "
        />
      </div>
    </div>
    <div data-test="contract-conflicts">
      <article v-for="conflict in controller.drafts.conflicts()" :key="conflict.id">
        <b>{{ conflict.status }} · {{ conflict.target.ref.id }}</b
        ><button @click="showOriginal(conflict.target)">查看保留输入</button
        ><button
          :disabled="conflict.status === 'detached'"
          @click="resolve(conflict.id, 'restart-on-current')"
        >
          基于当前值重新编辑</button
        ><button @click="resolve(conflict.id, 'discard-local')">明确放弃旧输入</button>
      </article>
    </div>
    <article
      v-for="comparison in controller.drafts.comparisons()"
      :key="comparison.id"
      data-test="contract-comparison"
    >
      已明确处置的原输入 · {{ comparison.target.ref.id
      }}<button @click="showComparison(comparison.id)">查看对比输入</button
      ><button @click="closeComparison(comparison.id)">关闭对比材料</button>
    </article>
    <pre data-test="contract-result">{{ message }}</pre>
    <details>
      <summary>当前真实状态</summary>
      <pre data-test="contract-state">{{ JSON.stringify(state, null, 2) }}</pre>
    </details>
    <details>
      <summary>候选文档（不是宿主已保存）</summary>
      <pre data-test="contract-snapshot">{{ snapshot }}</pre>
    </details>
  </section>
</template>
<style scoped>
.contract-instance {
  border: 1px solid #aeb8cf;
  margin: 16px 0;
  padding: 12px;
}
.contract-flow {
  display: grid;
  grid-template-columns: minmax(400px, 1fr) 320px;
  gap: 12px;
}
aside {
  padding: 12px;
  background: white;
}
.contract-form {
  height: 620px;
}
</style>
