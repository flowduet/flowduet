import type { createContext } from "./fixtures";
import {
  applyCandidateInput,
  prepareCandidate,
  stateSignature,
  type CandidateInput,
  type PreparedCandidate,
} from "./candidate";
import { commitAtomicProperties } from "./transaction";
import { failure, type EditTarget, type EditResult, type OperationResult } from "./types";
export function createContractController(context: ReturnType<typeof createContext>) {
  const { session, store, drafts, sync } = context;
  let serial = 0,
    revision = 0;
  const subscribers = new Set<(event: { type: string; revision: number }) => void>();
  const stamp = () =>
    `${drafts.revision}:${store.epoch}:${store
      .all()
      .map((r) => r.lifetime)
      .join(",")}:${stateSignature(session)}`;
  const notify = () => {
    for (const cb of subscribers) {
      try {
        cb({ type: "applied", revision });
      } catch {
        /* 通知失败不伪装成已提交模型失败。 */
      }
    }
  };
  async function build(
    only?: EditTarget,
  ): Promise<
    EditResult<{ public: PreparedCandidate; inputs: CandidateInput[]; expected: string }>
  > {
    sync();
    if (only && !store.resolve(only.ref)) return failure("stale-target", "目标已失效");
    const conflicts = drafts.conflicts().filter((r) => !only || r.target.ref === only.ref);
    if (conflicts.length) return failure("conflict", "请先处置保留的冲突输入");
    const editors = store
      .editors()
      .filter(
        (e) => !only || (e.lease.target.ref === only.ref && e.lease.target.facet === only.facet),
      );
    try {
      for (const e of editors) e.adapter.flush();
      const before = stateSignature(session);
      let captureRevision = drafts.revision;
      for (const e of editors) {
        const value = e.adapter.capture();
        if (drafts.revision !== captureRevision || stateSignature(session) !== before)
          return failure("version-changed", "捕获期间出现其他编辑");
        if (!value) return failure("capture-failed", "编辑器尚未就绪或无法收集");
        const staged = drafts.stage(e.lease.target, value);
        if (!staged.ok) return staged;
        captureRevision = drafts.revision;
      }
    } catch (error) {
      return failure("capture-failed", error instanceof Error ? error.message : String(error));
    }
    const inputs = drafts
      .buffers()
      .filter((r) => !only || (r.target.ref === only.ref && r.target.facet === only.facet))
      .flatMap((r) => (r.input ? [{ target: r.target, input: { ...r.input } }] : []));
    const expected = stamp();
    const result = await prepareCandidate(session, inputs, () => {
      sync();
      return stamp() === expected;
    });
    if (!result.ok) {
      if (result.code === "invalid-input" && result.target) drafts.markInvalid(result.target);
      return result;
    }
    const ref = store.all()[0]!;
    const prepared: PreparedCandidate = Object.freeze({
      id: ++serial,
      controllerId: ref.controllerId,
      documentEpoch: store.epoch,
      revision,
      json: result.value.json,
      pendingIssues: Object.freeze([...result.value.pendingIssues]),
      referenceIssues: Object.freeze([...result.value.referenceIssues]),
    });
    return { ok: true, value: { public: prepared, inputs, expected } };
  }
  return {
    ...context,
    get revision() {
      return revision;
    },
    subscribe(callback: (event: { type: string; revision: number }) => void) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    async prepare(_purpose: "draft-save" | "validate"): Promise<EditResult<PreparedCandidate>> {
      const r = await build();
      return r.ok ? { ok: true, value: r.value.public } : r;
    },
    async apply(target: EditTarget): Promise<OperationResult> {
      const result = await build(target);
      if (!result.ok) return result;
      if (stamp() !== result.value.expected || !store.resolve(target.ref))
        return failure("version-changed", "应用依据已变化");
      const state = session.current!;
      const commit = commitAtomicProperties(state, () => {
        for (const entry of result.value.inputs) applyCandidateInput(state, entry);
      });
      if (!commit.ok) return commit;
      sync(
        new Set(
          result.value.inputs
            .filter((e) => e.input.kind === "form-content")
            .map((e) => `form:${e.target.ref.id}`),
        ),
      );
      drafts.clearApplied(target);
      revision++;
      notify();
      return { ok: true, value: { revision } };
    },
    restore(target: EditTarget) {
      return drafts.restore(target);
    },
    async deleteForm(
      target: EditTarget,
      confirm: () => Promise<boolean>,
    ): Promise<OperationResult> {
      sync();
      if (target.ref.kind !== "form" || !store.resolve(target.ref))
        return failure("stale-target", "表单目标已失效");
      const result = await drafts.confirmRemoval([target.ref], confirm, stamp, () => {
        session.deleteForm(target.ref.id);
        sync();
      });
      if (result.ok) {
        revision++;
        notify();
      }
      return result;
    },
  };
}
export type ContractController = ReturnType<typeof createContractController>;
