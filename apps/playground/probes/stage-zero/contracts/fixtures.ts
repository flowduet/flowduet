import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { FlowDesignSession, type FormDefinition } from "@flowduet/form-create";
import { readPropertyDraft } from "../../../../../packages/designer/src/property-editing";
import { createEntityStore, observeSession } from "./entity-store";
import { createDraftStore } from "./draft-store";
import type { DraftValue, EditTarget } from "./types";
export function branchModel(nested = false) {
  const model = BpmnModel.create({ processId: "contract", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addExclusiveGateway({ id: "fork" })
    .addUserTask({ id: "approval_1", name: "同名审批", assignee: "alice" })
    .addUserTask({ id: "tail", name: "同名审批", assignee: "bob" })
    .addUserTask({ id: "b" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sf", sourceRef: "s", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      sourceRef: "fork",
      targetRef: "approval_1",
      condition: "${amount > 100}",
    })
    .addSequenceFlow({ id: "at", sourceRef: "approval_1", targetRef: "tail" })
    .addSequenceFlow({ id: "tj", sourceRef: "tail", targetRef: "join" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b", default: true })
    .addSequenceFlow({ id: "bj", sourceRef: "b", targetRef: "join" })
    .addSequenceFlow({ id: "je", sourceRef: "join", targetRef: "e" });
  if (nested) {
    model
      .addParallelGateway({ id: "inner" })
      .addParallelGateway({ id: "inner_join" })
      .addUserTask({ id: "i1", assignee: "inner_a" })
      .addUserTask({ id: "i2", assignee: "inner_b" })
      .retargetSequenceFlow("fa", "inner")
      .addSequenceFlow({ id: "ii1", sourceRef: "inner", targetRef: "i1" })
      .addSequenceFlow({ id: "ii2", sourceRef: "inner", targetRef: "i2" })
      .addSequenceFlow({ id: "i1j", sourceRef: "i1", targetRef: "inner_join" })
      .addSequenceFlow({ id: "i2j", sourceRef: "i2", targetRef: "inner_join" })
      .addSequenceFlow({ id: "inner_tail", sourceRef: "inner_join", targetRef: "approval_1" });
  }
  return model;
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function createContext(session: FlowDesignSession, owner = "A") {
  const store = createEntityStore(owner);
  const sync = (continued: ReadonlySet<string> = new Set()) =>
    store.reconcile(observeSession(session), continued);
  sync();
  const target = (
    id: string,
    kind: "node" | "flow" | "form" | "process" = "node",
    facet: EditTarget["facet"] = kind === "form" ? "form-content" : "properties",
  ) => {
    const result = store.target(kind, id, facet);
    if (!result.ok) throw new Error(result.message);
    return result.value;
  };
  const read = (t: EditTarget): DraftValue => {
    const object = store.resolve(t.ref);
    if (!object) throw new Error("对象已失效");
    if (t.ref.kind === "form") {
      const f = object as FormDefinition;
      return { kind: "form-content", rules: f.rules, options: f.options };
    }
    if (t.facet === "default-form")
      return { kind: "default-form", formKey: session.current!.model.defaultFormKey };
    const value = readPropertyDraft(session.current!.model, t.ref.id);
    if (!value) throw new Error("对象没有可编辑字段");
    return value;
  };
  const basis = (t: EditTarget) => {
    const object = store.resolve(t.ref);
    const extra =
      t.ref.kind === "flow" && object
        ? ((object as ModdleElement).get("sourceRef") as ModdleElement).get("default") === object
        : undefined;
    return JSON.stringify([
      read(t),
      extra,
      t.ref.kind === "form" ? (object as FormDefinition | undefined)?.provider : undefined,
    ]);
  };
  const referenceId = (input: DraftValue) =>
    input.kind === "approval"
      ? input.formKey
      : input.kind === "default-form"
        ? input.formKey?.trim()
        : undefined;
  const drafts = createDraftStore(store, read, basis, {
    selection: (input) => `${input.kind}:${referenceId(input) ?? ""}`,
    current(target, input) {
      if (!store.resolve(target.ref)) return {};
      const id = referenceId(input);
      if (!id) return {};
      const ref = store.target("form", id, "form-content");
      return ref.ok ? { [id]: JSON.stringify(ref.value.ref) } : {};
    },
  });
  return { session, store, drafts, target, read, basis, sync, model: session.current!.model };
}

export function fixture(owner = "A", nested = false) {
  return createContext(new FlowDesignSession(branchModel(nested)), owner);
}
