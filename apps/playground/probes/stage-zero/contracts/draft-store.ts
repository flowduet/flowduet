import type { EntityStore } from "./entity-store";
import {
  failure,
  targetKey,
  type DraftValue,
  type DraftStatus,
  type EditTarget,
  type EntityRef,
  type EditorEntry,
  type EditResult,
  type OperationResult,
} from "./types";
export type DraftRecord = {
  id: string;
  target: EditTarget;
  basis: string;
  input?: DraftValue;
  status: DraftStatus;
  reason?: string;
  retained?: EditorEntry;
};
export function createDraftStore(
  store: EntityStore,
  read: (target: EditTarget) => DraftValue,
  basis: (target: EditTarget) => string,
) {
  let revision = 0,
    sequence = 0;
  const records = new Map<string, DraftRecord>(),
    comparisons = new Map<string, DraftRecord>();
  const make = (target: EditTarget): DraftRecord => ({
    id: `conflict_${++sequence}`,
    target,
    basis: basis(target),
    input: read(target),
    status: "dirty",
  });
  function refresh() {
    for (const record of records.values()) {
      if (record.status === "detached") continue;
      try {
        if (record.basis !== basis(record.target)) {
          record.status = "conflicted";
          record.reason = "基础配置已变化";
        }
      } catch {
        record.status = "conflicted";
        record.reason = "无法确认当前基础配置";
      }
    }
  }
  store.beforeInvalidate((ref, reason) => {
    for (const facet of ["properties", "default-form", "form-content"] as const) {
      const target = { ref, facet },
        key = targetKey(target),
        editor = store.editor(target);
      let record = records.get(key);
      if (!record && !editor) continue;
      if (!record) {
        try {
          record = make(target);
        } catch {
          record = { id: `conflict_${++sequence}`, target, basis: "", status: "dirty" };
        }
      }
      // 捕获失败时仍保留真实租约；活动对象注销不等于允许销毁未序列化输入。
      if (editor) {
        record.retained = editor;
        try {
          const value = editor.adapter.capture();
          if (value) record.input = { ...value };
        } catch {
          /* 由保留实例承载输入。 */
        }
      }
      record.status = "detached";
      record.reason = reason;
      records.set(key, record);
      revision++;
    }
  });
  return {
    get revision() {
      return revision;
    },
    refresh,
    touch(target: EditTarget): EditResult<DraftStatus> {
      if (!store.resolve(target.ref)) return failure("stale-target", "编辑目标已失效");
      if (!records.has(targetKey(target))) records.set(targetKey(target), make(target));
      revision++;
      refresh();
      return { ok: true, value: records.get(targetKey(target))!.status };
    },
    stage(target: EditTarget, input: DraftValue): EditResult<DraftStatus> {
      if (!store.resolve(target.ref)) return failure("stale-target", "编辑目标已失效");
      const record = records.get(targetKey(target)) ?? make(target);
      record.input = { ...input };
      records.set(targetKey(target), record);
      revision++;
      refresh();
      return { ok: true, value: record.status };
    },
    input(target: EditTarget) {
      return records.get(targetKey(target))?.input;
    },
    status(target: EditTarget): DraftStatus {
      refresh();
      return records.get(targetKey(target))?.status ?? "clean";
    },
    conflicts() {
      refresh();
      return [...records.values()].filter(
        (r) => r.status === "conflicted" || r.status === "detached",
      );
    },
    comparisons: () => [...comparisons.values()],
    buffers() {
      refresh();
      return [...records.values()];
    },
    clearApplied(target: EditTarget) {
      records.delete(targetKey(target));
      revision++;
    },
    restore(target: EditTarget): OperationResult {
      refresh();
      const record = records.get(targetKey(target));
      if (record?.status === "conflicted" || record?.status === "detached")
        return failure("conflict", "请先明确处置冲突输入");
      if (!store.resolve(target.ref)) return failure("stale-target", "还原目标已失效");
      records.delete(targetKey(target));
      revision++;
      return { ok: true, value: { revision } };
    },
    resolveConflict(id: string, action: "discard-local" | "restart-on-current"): OperationResult {
      refresh();
      const record = [...records.values()].find(
        (r) => r.id === id && (r.status === "conflicted" || r.status === "detached"),
      );
      if (!record) return failure("conflict", "冲突记录已失效");
      if (action === "restart-on-current") {
        if (!store.resolve(record.target.ref))
          return failure("stale-target", "旧目标不能重绑新对象");
        let next: DraftRecord;
        try {
          next = make(record.target);
        } catch {
          return failure("unsupported", "当前对象不支持重新编辑");
        }
        comparisons.set(id, {
          ...record,
          ...(store.editor(record.target) ? { retained: store.editor(record.target)! } : {}),
        });
        records.set(targetKey(record.target), next);
      } else records.delete(targetKey(record.target));
      if (record.retained) store.releaseEditor(record.retained.lease);
      const active = store.editor(record.target);
      if (active) store.releaseEditor(active.lease);
      revision++;
      return { ok: true, value: { revision } };
    },
    // 仅供控制器内部已核验语义命令使用，实验宿主不能提供任意model回调。
    async confirmRemoval(
      refs: readonly EntityRef[],
      confirm: () => Promise<boolean>,
      version: () => unknown,
      commit: () => void,
    ): Promise<OperationResult> {
      const expected = version();
      try {
        if (!(await confirm())) return failure("cancelled", "已取消删除");
        if (version() !== expected || refs.some((ref) => !store.resolve(ref)))
          return failure("version-changed", "删除确认已过期");
        commit();
        for (const [key, record] of records)
          if (refs.includes(record.target.ref) && !store.resolve(record.target.ref)) {
            if (record.retained) store.releaseEditor(record.retained.lease);
            records.delete(key);
          }
        revision++;
        return { ok: true, value: { revision } };
      } catch (error) {
        return failure("commit-failed", error instanceof Error ? error.message : String(error));
      }
    },
  };
}
export type DraftStore = ReturnType<typeof createDraftStore>;
