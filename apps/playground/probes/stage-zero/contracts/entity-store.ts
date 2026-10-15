import type { ModdleElement } from "@flowduet/core";
import type { FlowDesignSession } from "@flowduet/form-create";
import {
  failure,
  targetKey,
  type EditTarget,
  type EntityKind,
  type EntityRef,
  type Facet,
  type EditorAdapter,
  type EditorEntry,
  type EditorLease,
  type EditResult,
} from "./types";
export type ObservedEntity = { kind: EntityKind; id: string; object: object };
export type Observation = { document: object; entities: ObservedEntity[] };
export function observeSession(session: FlowDesignSession): Observation {
  const state = session.current;
  if (!state) throw new Error("会话未初始化");
  const elements = (state.model.process.get("flowElements") as ModdleElement[]) ?? [];
  return {
    document: state.model,
    entities: [
      { kind: "process", id: String(state.model.process.get("id")), object: state.model.process },
      ...elements.map((object) => ({
        kind: object.$type === "bpmn:SequenceFlow" ? ("flow" as const) : ("node" as const),
        id: String(object.get("id")),
        object,
      })),
      ...state.forms.map((object) => ({ kind: "form" as const, id: object.id, object })),
    ],
  };
}
export function createEntityStore(controllerId: string) {
  let document: object | undefined,
    epoch = 1,
    lifetime = 0;
  const entries = new Map<string, { ref: EntityRef; object: object }>();
  const issued = new WeakSet<EntityRef>();
  const editors = new Map<string, EditorEntry>();
  let invalidating: (ref: EntityRef, reason: string) => void = () => {};
  const key = (kind: EntityKind, id: string) => `${kind}:${id}`;
  const resolve = (ref: EntityRef): object | undefined =>
    issued.has(ref) &&
    ref.documentEpoch === epoch &&
    entries.get(key(ref.kind, ref.id))?.ref === ref
      ? entries.get(key(ref.kind, ref.id))?.object
      : undefined;
  function invalidate(ref: EntityRef, reason: string) {
    // 先交由缓冲层保留原实例/输入，再撤销活动登记，旧租约不能写新对象。
    invalidating(ref, reason);
    for (const [k, entry] of editors) if (entry.lease.target.ref === ref) editors.delete(k);
    entries.delete(key(ref.kind, ref.id));
  }
  return {
    resolve,
    get epoch() {
      return epoch;
    },
    all: () => [...entries.values()].map((entry) => entry.ref),
    beforeInvalidate(callback: typeof invalidating) {
      invalidating = callback;
    },
    reconcile(observed: Observation, continued: ReadonlySet<string> = new Set()) {
      const replaced = document !== undefined && document !== observed.document;
      if (replaced) {
        for (const entry of [...entries.values()]) invalidate(entry.ref, "document-replaced");
        epoch++;
      }
      document = observed.document;
      const live = new Set(observed.entities.map((e) => key(e.kind, e.id)));
      for (const [k, entry] of [...entries]) if (!live.has(k)) invalidate(entry.ref, "removed");
      for (const entity of observed.entities) {
        const k = key(entity.kind, entity.id),
          old = entries.get(k);
        if (old && (old.object === entity.object || continued.has(k))) {
          old.object = entity.object;
          continue;
        }
        if (old) invalidate(old.ref, "replaced");
        const ref = Object.freeze({
          controllerId,
          documentEpoch: epoch,
          kind: entity.kind,
          id: entity.id,
          lifetime: ++lifetime,
        });
        issued.add(ref);
        entries.set(k, { ref, object: entity.object });
      }
    },
    target(kind: EntityKind, id: string, facet: Facet): EditResult<EditTarget> {
      if (
        (facet === "default-form" && kind !== "process") ||
        (facet === "form-content" && kind !== "form") ||
        (facet === "properties" && kind === "form")
      )
        return failure("unsupported", "对象与编辑入口不匹配");
      const entry = entries.get(key(kind, id));
      if (!entry) return failure("stale-target", "对象不存在");
      return { ok: true, value: Object.freeze({ ref: entry.ref, facet }) };
    },
    registerEditor(target: EditTarget, adapter: EditorAdapter): EditorLease {
      if (!resolve(target.ref)) throw new Error("编辑器目标已失效");
      const lease = Object.freeze({ token: Symbol("EditorLease"), target });
      editors.set(targetKey(target), { lease, adapter });
      return lease;
    },
    releaseEditor(lease: EditorLease) {
      const k = targetKey(lease.target);
      if (editors.get(k)?.lease === lease) editors.delete(k);
    },
    editor(target: EditTarget) {
      return resolve(target.ref) ? editors.get(targetKey(target)) : undefined;
    },
    editors: () => [...editors.values()],
  };
}
export type EntityStore = ReturnType<typeof createEntityStore>;
