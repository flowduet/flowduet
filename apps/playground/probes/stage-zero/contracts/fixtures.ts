import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { FlowDesignSession, type FormDefinition } from "@flowduet/form-create";
import { readApprovalMulti } from "../../../../../packages/designer/src/operations";
import { createEntityStore, observeSession } from "./entity-store";
import { createDraftStore } from "./draft-store";
import type { DraftValue, EditTarget } from "./types";
export function branchModel() {
  return BpmnModel.create({ processId: "contract", adapter: flowableAdapter })
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
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function fixture(owner = "A") {
  const session = new FlowDesignSession(branchModel()),
    store = createEntityStore(owner);
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
    const el = object as ModdleElement;
    if (t.facet === "default-form")
      return { kind: "default-form", formKey: session.current!.model.defaultFormKey };
    if (t.ref.kind === "process") return { kind: "process", name: String(el.get("name") ?? "") };
    if (t.ref.kind === "flow")
      return {
        kind: "branch",
        name: String(el.get("name") ?? ""),
        condition: String(
          (el.get("conditionExpression") as ModdleElement | undefined)?.get("body") ?? "",
        ),
      };
    if (el.$type === "bpmn:ServiceTask")
      return {
        kind: "cc",
        name: String(el.get("name") ?? ""),
        recipients: String(el.get("ccTo") ?? ""),
      };
    const multi = readApprovalMulti(session.current!.model, t.ref.id);
    return {
      kind: "approval",
      name: String(el.get("name") ?? ""),
      approvalKind: multi?.mode ?? "single",
      assignee: multi?.collection ?? String(el.get("assignee") ?? ""),
      formKey: String(el.get("formKey") ?? ""),
      ...(multi?.elementVariable !== undefined ? { elementVariable: multi.elementVariable } : {}),
    };
  };
  const basis = (t: EditTarget) => {
    const object = store.resolve(t.ref);
    const extra =
      t.ref.kind === "flow" && object
        ? ((object as ModdleElement).get("sourceRef") as ModdleElement).get("default") === object
        : undefined;
    return JSON.stringify([read(t), extra]);
  };
  const drafts = createDraftStore(store, read, basis);
  return { session, store, drafts, target, read, basis, sync, model: session.current!.model };
}
