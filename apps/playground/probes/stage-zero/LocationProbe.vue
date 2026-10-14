<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from "vue";
import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { FlowDesignSession } from "@flowduet/form-create";
import { DingtalkDesigner, BpmnCanvas } from "@flowduet/designer";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  insertApprovalAfter,
  removeApprovalNode,
  removeBlock,
} from "../../../../packages/designer/src/operations";
import { ProbeDesignState } from "./design-state";
import type { EntityRef } from "./probe-contracts";
import { record } from "./probe-log";

const props = defineProps<{
  nested?: boolean;
  beforeLocate?: (state: ProbeDesignState) => Promise<void>;
}>();
const model = shallowRef<BpmnModel>(),
  state = shallowRef<ProbeDesignState>(),
  view = ref("bpmn"),
  root = ref<HTMLElement>(),
  message = ref("准备带DI的真实模型"),
  renderKey = ref(0),
  version = ref(0),
  armed = ref(false);
let nodeRef: EntityRef, branchRef: EntityRef;
function log(action: string, observed: unknown, entity?: EntityRef) {
  record(
    "location",
    action,
    { probeCase: props.nested ? "nested" : "chain", observed },
    entity,
    state.value?.registry.documentEpoch,
  );
}
function sync(remount = false) {
  state.value!.reconcile();
  model.value = state.value!.session.current!.model;
  version.value++;
  if (remount) renderKey.value++;
}
const observed = computed(() => {
  void version.value;
  void message.value;
  const p = state.value;
  if (!p || !model.value) return {};
  const flow = p.registry.resolve(branchRef) as ModdleElement | undefined;
  return {
    documentEpoch: p.registry.documentEpoch,
    view: view.value,
    node: nodeRef,
    branch: branchRef,
    nodeAlive: !!p.registry.resolve(nodeRef),
    branchAlive: !!flow,
    branchBuffer: p.buffer(branchRef) ?? null,
    nodeBuffer: p.buffer(nodeRef) ?? null,
    headTarget: flow ? (flow.get("targetRef") as ModdleElement).get("id") : null,
    branchOrder: flow
      ? ((flow.get("sourceRef") as ModdleElement).get("outgoing") as ModdleElement[]).map((f) =>
          f.get("id"),
        )
      : [],
    defaultFormKey: model.value.defaultFormKey ?? null,
  };
});
onMounted(async () => {
  try {
    const m = BpmnModel.create({ processId: "location_probe", adapter: flowableAdapter })
      .addStartEvent({ id: "s" })
      .addExclusiveGateway({ id: "fork" })
      .addUserTask({ id: "approval_1", name: "采购审批", assignee: "alice" })
      .addUserTask({ id: "tail", name: "财务复核", assignee: "bob" })
      .addUserTask({ id: "b", name: "其他审批", assignee: "carol" })
      .addExclusiveGateway({ id: "join" })
      .addEndEvent({ id: "e" });
    for (const [id, sourceRef, targetRef] of [
      ["sf", "s", "fork"],
      ["fa", "fork", "approval_1"],
      ["at", "approval_1", "tail"],
      ["tj", "tail", "join"],
      ["fb", "fork", "b"],
      ["bj", "b", "join"],
      ["je", "join", "e"],
    ] as const)
      m.addSequenceFlow({
        id,
        sourceRef,
        targetRef,
        ...(id === "fa"
          ? { name: "金额分支", condition: "${amount > 100}" }
          : id === "fb"
            ? { name: "默认分支", default: true }
            : {}),
      });
    if (props.nested) {
      m.addParallelGateway({ id: "inner" })
        .addParallelGateway({ id: "ij" })
        .addUserTask({ id: "i1", name: "采购审批", assignee: "alice" })
        .addUserTask({ id: "i2", assignee: "bob" });
      m.retargetSequenceFlow("fa", "inner");
      m.removeNode("approval_1");
      for (const [id, sourceRef, targetRef] of [
        ["ii1", "inner", "i1"],
        ["ii2", "inner", "i2"],
        ["i1j", "i1", "ij"],
        ["i2j", "i2", "ij"],
        ["jt", "ij", "tail"],
      ] as const)
        m.addSequenceFlow({ id, sourceRef, targetRef });
    }
    const session = new FlowDesignSession(m);
    session.createForm("默认申请单");
    session.createForm("备选申请单");
    m.setDefaultFormKey("form_1");
    await session.open((await session.save()).json);
    const p = new ProbeDesignState(session);
    state.value = p;
    model.value = session.current!.model;
    nodeRef = p.registry.ref("node", props.nested ? "i1" : "approval_1");
    branchRef = p.registry.ref("flow", "fa");
    p.stage(nodeRef, { name: "未应用节点名" });
    p.stage(branchRef, { condition: "${amount > 200}" });
    message.value = "就绪：使用内部DOM桥接，并核对实际抽屉；不是公开定位API。";
  } catch (e) {
    message.value = String(e);
  }
});
function perform(action: string, operation: () => void) {
  try {
    state.value!.mutateModel(operation);
    sync(true);
    message.value = action;
    log("structure", { action, state: observed.value }, branchRef);
  } catch (e) {
    message.value = String(e);
    log("structure-rejected", { error: message.value });
  }
}
function recreateNode() {
  const m = model.value!;
  removeApprovalNode(m, nodeRef.id);
  insertApprovalAfter(m, "tail", { name: "新对象", assignee: "new" });
}
async function locate(kind: "node" | "flow") {
  const p = state.value;
  if (!p) return;
  sync();
  const target = kind === "node" ? nodeRef : branchRef;
  const rejectStale = () => {
    message.value = "定位目标生命期已失效，拒绝跳转";
    log("stale-rejected", { kind }, target);
  };
  if (!p.registry.resolve(target)) {
    rejectStale();
    return;
  }
  view.value = "edit";
  await nextTick();
  // 人工异步门与真实结构操作验证切换期间失效，不把开始时的检查当最终归属。
  if (props.beforeLocate) {
    try {
      await props.beforeLocate(p);
    } catch (error) {
      sync();
      message.value = `定位请求失败，保留当前编辑状态：${String(error)}`;
      log("request-failed", { error: String(error) }, target);
      return;
    }
    sync(true);
    await nextTick();
  }
  if (armed.value) {
    armed.value = false;
    perform("异步期间删除再复用节点ID", recreateNode);
    await nextTick();
  }
  sync();
  if (!p.registry.resolve(target)) {
    rejectStale();
    return;
  }
  const object = p.registry.resolve(target) as ModdleElement;
  let element: HTMLElement | null;
  if (kind === "node")
    element =
      root.value
        ?.querySelector(`[data-test="node-delete-${target.id}"]`)
        ?.closest<HTMLElement>('[data-test="node-card"]') ?? null;
  else {
    const source = object.get("sourceRef") as ModdleElement;
    const outgoing = source.get("outgoing") as ModdleElement[];
    const index = outgoing.indexOf(object);
    element =
      root.value?.querySelector(`[data-test="branch-head-${source.get("id")}-${index}"]`) ?? null;
  }
  if (!element) {
    message.value = "已切回编辑视图，但未找到定位接缝";
    log("not-found", { kind }, target);
    return;
  }
  element.scrollIntoView?.({ block: "center" });
  element.click();
  await nextTick();
  sync();
  if (!p.registry.resolve(target)) {
    rejectStale();
    return;
  }
  const drawer = root.value?.querySelector(".el-drawer.open");
  const name = drawer?.querySelector<HTMLInputElement>('[data-test="drawer-name"]');
  const condition = drawer?.querySelector<HTMLInputElement>('[data-test="drawer-condition"]');
  const match =
    !!drawer &&
    name?.value === String(object.get("name") ?? "") &&
    (kind === "flow" ? !!condition : !condition);
  if (!match) {
    message.value = "定位请求已派发，但未确认目标选中；原抽屉或输入仍在，请检查未完成配置";
    log("selection-unconfirmed", { kind, name: name?.value ?? null }, target);
    return;
  }
  message.value = `已确认选中 ${target.id} 的实际配置抽屉（内部DOM桥接）`;
  log("selection-confirmed", { kind, id: target.id, actualName: name!.value }, target);
}
function locateDefault() {
  view.value = "form";
  message.value = "已进入真实默认表单配置控件";
  log("default-form-route", { documentEpoch: state.value?.registry.documentEpoch });
}
function changeDefault(event: Event) {
  model.value!.setDefaultFormKey((event.target as HTMLSelectElement).value || undefined);
  sync();
  log("default-form-change", { key: model.value!.defaultFormKey });
}
</script>
<template>
  <section :data-location-case="nested ? 'nested' : 'chain'">
    <h3>结构修复后的真实定位与对象缓冲</h3>
    <div class="bar">
      <button @click="view = 'bpmn'">回到 BPMN 只读</button
      ><button @click="locate('node')">定位采购审批</button
      ><button @click="locate('flow')">定位金额分支</button
      ><button @click="locateDefault">定位默认表单问题</button>
      <button
        @click="
          perform('原位转会签', () =>
            convertApprovalToMulti(model!, nodeRef.id, { collection: 'people', mode: 'all' }),
          )
        "
      >
        切为会签
      </button>
      <button @click="perform('原位转单签', () => convertMultiToSingle(model!, nodeRef.id))">
        切回单签
      </button>
      <button
        v-if="!nested"
        @click="perform('删除首节点，原支路保留', () => removeApprovalNode(model!, nodeRef.id))"
      >
        删除首节点（保留支路）
      </button>
      <button
        v-if="nested"
        @click="perform('删除嵌套块，外层支路保留', () => removeBlock(model!, 'inner'))"
      >
        删除嵌套块（保留外层支路）
      </button>
      <button v-if="!nested" @click="perform('删除并复用节点ID', recreateNode)">
        删除并复用节点 ID
      </button>
      <label
        ><input type="checkbox" v-model="armed" />下一次定位期间删除再复用节点（实验确认）</label
      >
    </div>
    <p data-test="location-result">{{ message }}</p>
    <div v-if="model" ref="root" style="height: 500px; overflow: auto; background: white">
      <BpmnCanvas v-if="view === 'bpmn'" :version="version" :model="model" />
      <DingtalkDesigner :key="renderKey" v-show="view === 'edit'" :model="model" @change="sync()" />
      <div v-show="view === 'form'">
        <h4>表单阶段 · 流程默认表单配置</h4>
        <label
          >流程默认表单<select
            data-test="location-default-form"
            :value="model.defaultFormKey ?? ''"
            @change="changeDefault"
          >
            <option value="">无</option>
            <option v-for="form in state?.session.current?.forms" :key="form.id" :value="form.id">
              {{ form.name }}
            </option>
          </select></label
        >
      </div>
    </div>
    <pre data-test="location-state">{{ JSON.stringify(observed, null, 2) }}</pre>
  </section>
</template>
