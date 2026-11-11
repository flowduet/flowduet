import { parse, flowableAdapter, type ModdleElement, type BpmnModel } from "@flowduet/core";
import {
  saveDesignDocument,
  type FlowDesignSession,
  type FormDefinition,
} from "@flowduet/form-create";
import { assertFormDefinitionValid } from "../../../../../packages/form-create/src/form-schema";
import { applyPropertyDraft } from "../../../../../packages/designer/src/property-editing";
import { failure, type DraftValue, type EditTarget, type EditResult } from "./types";
export type CandidateInput = { target: EditTarget; input: DraftValue };
export type PreparedCandidate = Readonly<{
  id: number;
  controllerId: string;
  documentEpoch: number;
  revision: number;
  json: string;
  pendingIssues: readonly string[];
  referenceIssues: readonly string[];
}>;
export type CandidateState = { model: BpmnModel; forms: readonly FormDefinition[] };

/** 完整自有属性语义图含未知属性，保留引用拓扑与数组顺序；元数据和父指针不属于业务字段。 */
export function graphValue(root: unknown, withoutDi = false): string {
  const seen = new Map<object, number>();
  function project(value: unknown): unknown {
    if (typeof value === "function") return "[method]";
    if (!value || typeof value !== "object") return value;
    if (withoutDi && "$type" in value && String(value.$type).startsWith("bpmndi:")) return "[di]";
    if (seen.has(value)) return { ref: seen.get(value) };
    seen.set(value, seen.size);
    if (Array.isArray(value)) return value.map(project);
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.getOwnPropertyNames(value).sort()) {
      if (["$model", "$descriptor", "$parent"].includes(key) || (withoutDi && key === "diagrams"))
        continue;
      const child = Reflect.get(value, key);
      // moddle读取多值属性会惰性创建空数组；它不产生XML，也不构成设计变更。
      if (Array.isArray(child) && child.length === 0) continue;
      result[key] = project(child);
    }
    return result;
  }
  return JSON.stringify(project(root));
}
export function stateSignature(session: FlowDesignSession, withoutDi = false): string {
  const state = session.current;
  if (!state) return "uninitialized";
  const geometry = !withoutDi
    ? ((state.model.process.get("flowElements") as ModdleElement[]) ?? []).map((el) => {
        const id = String(el.get("id"));
        try {
          return [
            id,
            el.$type === "bpmn:SequenceFlow"
              ? state.model.waypointsOf(id)
              : state.model.shapeOf(id),
          ];
        } catch {
          return [id, null];
        }
      })
    : [];
  return graphValue([state.model.definitions, state.forms, geometry], withoutDi);
}
export function applyCandidateInput(
  state: CandidateState,
  { target, input }: CandidateInput,
): void {
  if (input.kind === "form-content") {
    if (target.ref.kind !== "form" || target.facet !== "form-content")
      throw new Error("表单编辑目标不匹配");
    const previous = state.forms.find((f) => f.id === target.ref.id);
    if (!previous) throw new Error("表单已不存在");
    const next = { ...previous, rules: input.rules, options: input.options };
    assertFormDefinitionValid(
      next,
      new Set(state.forms.filter((f) => f.id !== next.id).map((f) => f.id)),
    );
    state.forms = state.forms.map((f) => (f.id === next.id ? next : f));
    return;
  }
  if (input.kind === "default-form") {
    if (target.ref.kind !== "process" || target.facet !== "default-form")
      throw new Error("默认表单目标不匹配");
    state.model.setDefaultFormKey(input.formKey);
    return;
  }
  if (target.facet !== "properties") throw new Error("流程属性入口不匹配");
  applyPropertyDraft(state.model, target.ref.id, input, {
    allowIncomplete: true,
    integratedForms: true,
  });
}
export async function prepareCandidate(
  session: FlowDesignSession,
  inputs: readonly CandidateInput[],
  unchanged: () => boolean,
): Promise<
  EditResult<{
    state: CandidateState;
    json: string;
    pendingIssues: string[];
    referenceIssues: string[];
  }>
> {
  const current = session.current;
  if (!current) return failure("capture-failed", "会话未初始化");
  try {
    const { xml } = await current.model.toXML({ format: true });
    if (!unchanged()) return failure("version-changed", "快照期间设计已变化");
    const model = await parse(xml, {
      adapter: flowableAdapter,
      rejectWarnings: true,
      rejectUnregisteredNamespaces: true,
    });
    if (!unchanged()) return failure("version-changed", "解析候选期间设计已变化");
    const state: CandidateState = { model, forms: current.forms.map((f) => ({ ...f })) };
    for (const entry of inputs) {
      try {
        applyCandidateInput(state, entry);
      } catch (error) {
        return {
          ok: false,
          code: "invalid-input",
          message: error instanceof Error ? error.message : String(error),
          target: entry.target,
        };
      }
    }
    const saved = await saveDesignDocument(model, state.forms);
    if (!unchanged()) return failure("version-changed", "候选准备期间设计已变化");
    return {
      ok: true,
      value: {
        state,
        json: saved.json,
        pendingIssues: saved.pendingIssues,
        referenceIssues: saved.referenceIssues,
      },
    };
  } catch (error) {
    if (!unchanged()) return failure("version-changed", "候选失败前设计已变化");
    return failure("capture-failed", error instanceof Error ? error.message : String(error));
  }
}
