import type { ModdleElement } from "@flowduet/core";
import { FlowDesignSession, type FormDefinition } from "@flowduet/form-create";
import { assertFormDefinitionValid } from "../../../../packages/form-create/src/form-schema";
import type { EntityRef, LiveEntity } from "./probe-contracts";
import { EntityRegistry } from "./identity-policy";

export type FormContent = { rules: string; options: string };
export type ProbeEditor = { exportContent(): FormContent | null };
type Draft = { basis: string; input: unknown };
export const entityKey = (ref: EntityRef) =>
  JSON.stringify([ref.documentEpoch, ref.kind, ref.id, ref.lifetime]);

/** 阶段零候选协调器：只围绕真实session维护身份与输入，不作为正式工作台API。 */
export class ProbeDesignState {
  readonly registry = new EntityRegistry();
  private model: object | undefined;
  private editors = new Map<string, { ref: EntityRef; editor: ProbeEditor }>();
  constructor(readonly session: FlowDesignSession) {
    this.reconcile();
  }

  reconcile(continuedForms = new Set<string>()): void {
    const state = this.session.current;
    if (!state) throw new Error("实验session未初始化");
    if (this.model && this.model !== state.model) this.registry.replaceDocument();
    this.model = state.model;
    const live: LiveEntity[] = (
      (state.model.process.get("flowElements") as ModdleElement[]) ?? []
    ).map((object) => ({
      kind: object.$type === "bpmn:SequenceFlow" ? "flow" : "node",
      id: String(object.get("id")),
      object,
    }));
    live.push(...state.forms.map((object) => ({ kind: "form" as const, id: object.id, object })));
    this.registry.sync(live, new Set([...continuedForms].map((id) => `form:${id}`)));
    for (const [key, entry] of this.editors)
      if (!this.registry.resolve(entry.ref)) this.editors.delete(key);
  }
  mutateModel(action: () => void): void {
    try {
      action();
    } finally {
      this.reconcile();
    }
  }
  private basis(ref: EntityRef): string {
    const object = this.registry.resolve(ref);
    if (!object) throw new Error("对象生命期已失效");
    if (ref.kind === "form") {
      const f = object as FormDefinition;
      // 目录改名不改设计器内容；rules/options/provider变化需要显式冲突处理。
      return JSON.stringify([f.provider, f.rules, f.options]);
    }
    const el = object as ModdleElement;
    if (ref.kind === "flow") {
      const source = el.get("sourceRef") as ModdleElement;
      const condition = el.get("conditionExpression") as ModdleElement | undefined;
      return JSON.stringify([
        el.$type,
        source.get("id"),
        el.get("name"),
        condition?.get("body"),
        source.get("default") === el,
      ]);
    }
    const loop = el.get("loopCharacteristics") as ModdleElement | undefined;
    return JSON.stringify([
      el.$type,
      el.get("name"),
      el.get("assignee"),
      el.get("formKey"),
      el.get("ccTo"),
      loop?.$type,
      loop?.get("collection"),
      loop?.get("elementVariable"),
      loop?.get("isSequential"),
      (loop?.get("completionCondition") as ModdleElement | undefined)?.get("body"),
    ]);
  }
  stage(ref: EntityRef, input: unknown): void {
    const previous = this.registry.get(ref) as Draft | undefined;
    const basis = this.basis(ref);
    // 后续捕获不能偷偷覆盖旧基础版本，否则外部变化会被误判为兼容。
    this.registry.put(ref, { basis: previous?.basis ?? basis, input });
  }
  buffer(ref: EntityRef): { input: unknown; conflict: boolean } | undefined {
    const draft = this.registry.get(ref) as Draft | undefined;
    return draft ? { input: draft.input, conflict: draft.basis !== this.basis(ref) } : undefined;
  }
  registerEditor(ref: EntityRef, editor: ProbeEditor | null): void {
    const key = entityKey(ref);
    if (editor) {
      if (ref.kind !== "form" || !this.registry.resolve(ref)) throw new Error("编辑器目标已失效");
      this.editors.set(key, { ref, editor });
    } else this.editors.delete(key);
  }
  capture(ref: EntityRef): FormContent {
    if (!this.registry.resolve(ref)) throw new Error("编辑器对象生命期已失效");
    const entry = this.editors.get(entityKey(ref));
    if (!entry) throw new Error(`编辑器 ${ref.id} 未挂载`);
    const content = entry.editor.exportContent();
    if (!content) throw new Error(`编辑器 ${ref.id} 尚未准备好或无法收集`);
    this.stage(ref, content);
    return content;
  }
  collectAll(): FormDefinition[] {
    this.reconcile();
    const forms = this.session.current!.forms;
    const candidates = forms.map((form) => {
      const ref = this.registry.ref("form", form.id);
      if (this.editors.has(entityKey(ref))) this.capture(ref);
      const buffer = this.buffer(ref);
      if (buffer?.conflict)
        throw new Error(`表单 ${form.id} 的基础内容已变化，保留输入并等待冲突处理`);
      const next = { ...form, ...(buffer?.input as FormContent | undefined) };
      assertFormDefinitionValid(
        next,
        new Set(forms.filter((f) => f.id !== form.id).map((f) => f.id)),
      );
      return next;
    });
    return candidates;
  }
  applyAll(): FormDefinition[] {
    const candidates = this.collectAll();
    const refs = candidates.map((f) => this.registry.ref("form", f.id));
    // 先收集并校验所有表单；无宿主回调的同步提交才进入真实session。
    for (const form of candidates)
      this.session.updateFormContent(form.id, form.rules, form.options);
    this.reconcile(new Set(candidates.map((f) => f.id)));
    for (const ref of refs) this.registry.put(ref, undefined);
    return candidates;
  }
  renameForm(id: string, name: string): void {
    this.session.renameForm(id, name);
    this.reconcile(new Set([id]));
  }
  createForm(name: string): EntityRef {
    const form = this.session.createForm(name);
    this.reconcile();
    return this.registry.ref("form", form.id);
  }
  deleteForm(id: string): void {
    try {
      this.session.deleteForm(id);
    } finally {
      this.reconcile();
    }
  }
  get editorCount(): number {
    return this.editors.size;
  }
}
