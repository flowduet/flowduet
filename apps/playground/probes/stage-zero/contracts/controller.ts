import { parse, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { collectFormUsage } from "../../../../../packages/form-create/src/binding";
import type { DesignerOperationRequest } from "../../../../../packages/designer/src/property-editing";
import { runOperation } from "./operations";
import { createVersions, dataDraft, normalizes } from "./versions";
import { createLocator } from "./location";
import type { createContext } from "./fixtures";
import {
  applyCandidateInput,
  prepareCandidate,
  stateSignature,
  graphValue,
  type CandidateInput,
  type PreparedCandidate,
} from "./candidate";
import { commitAtomicProperties } from "./transaction";
import {
  failure,
  targetKey,
  type EntityKind,
  type Facet,
  type DraftValue,
  type EditTarget,
  type EditResult,
  type OperationResult,
} from "./types";
export function createContractController(context: ReturnType<typeof createContext>) {
  const { session, store, drafts } = context;
  let serial = 0,
    revision = 0,
    buildRequest = 0;
  let disposed = false;
  const candidates = new WeakMap<PreparedCandidate, string>();
  const identities = () =>
    `${store.epoch}:` +
    store
      .all()
      .map((r) => `${r.kind}:${r.id}:${r.lifetime}`)
      .join("|");
  let knownIdentity = identities();
  let knownState = stateSignature(session);
  const sync = (continued: ReadonlySet<string> = new Set()) => {
    if (disposed) return;
    context.sync(continued);
    const actual = stateSignature(session);
    if (actual !== knownState || identities() !== knownIdentity) {
      revision++;
      knownState = actual;
      knownIdentity = identities();
    }
  };
  type ControllerEvent = { type: string; revision: number; target?: EditTarget };
  const subscribers = new Set<(event: ControllerEvent) => void>();
  const stamp = () => {
    // 内容相同的未知替换仍是新生命期；比较前必须先核对实际对象，不能只看图指纹。
    sync();
    return `${drafts.revision}:${store.leaseRevision}:${store.epoch}:${store
      .all()
      .map((r) => r.lifetime)
      .join(",")}:${stateSignature(session)}`;
  };
  const notify = (type = "applied", target?: EditTarget) => {
    for (const cb of subscribers) {
      try {
        cb({ type, revision, ...(target ? { target } : {}) });
      } catch {
        /* 通知失败不伪装成已提交模型失败。 */
      }
    }
  };
  const rawKey = () =>
    graphValue([
      stateSignature(session, true),
      drafts.buffers().flatMap((r) => {
        const input = r.input ? dataDraft(r.input) : undefined;
        let same = false;
        try {
          same = graphValue(input) === graphValue(dataDraft(context.read(r.target)));
        } catch {
          /* 失效记录始终参与状态。 */
        }
        return same && !r.uncapturedVersion && r.status !== "conflicted" && r.status !== "detached"
          ? []
          : [
              [
                targetKey(r.target),
                input,
                r.uncapturedVersion,
                r.status === "conflicted" || r.status === "detached" ? r.status : undefined,
              ],
            ];
      }),
    ]);
  const isCurrentCandidate = (candidate: PreparedCandidate) =>
    !disposed && candidates.get(candidate) === stamp();
  const versions = createVersions({
    key: rawKey,
    identity: () =>
      `${store.leaseRevision}:` +
      store
        .all()
        .map((r) => `${r.kind}:${r.id}:${r.lifetime}`)
        .join("|"),
    epoch: () => {
      sync();
      return store.epoch;
    },
    prepare: async () => {
      const r = await build();
      return r.ok ? { ok: true, value: r.value.public } : r;
    },
    isCurrent: isCurrentCandidate,
    notify,
  });
  async function build(
    only?: EditTarget,
    skipCapture?: ReadonlySet<string>,
  ): Promise<
    EditResult<{ public: PreparedCandidate; inputs: CandidateInput[]; expected: string }>
  > {
    if (disposed) return failure("cancelled", "编辑控制器已释放");
    const request = ++buildRequest,
      coverage = versions.coverageRevision;
    let result: Awaited<ReturnType<typeof buildUnsafe>>;
    try {
      result = await buildUnsafe(only, skipCapture);
    } catch (error) {
      result = failure("capture-failed", error instanceof Error ? error.message : String(error));
    }
    if (request !== buildRequest) return failure("cancelled", "候选请求已被更新请求替代");
    if (
      !result.ok &&
      ["capture-failed", "version-changed", "conflict", "invalid-input"].includes(result.code)
    )
      versions.invalidateCoverage();
    else if (result.ok && !only && !versions.confirmCoverage(coverage))
      return failure("version-changed", "候选期间编辑覆盖已变化");
    return result;
  }
  async function buildUnsafe(
    only?: EditTarget,
    skipCapture: ReadonlySet<string> = new Set(),
  ): Promise<
    EditResult<{ public: PreparedCandidate; inputs: CandidateInput[]; expected: string }>
  > {
    sync();
    if (only && !store.resolve(only.ref)) return failure("stale-target", "目标已失效");
    const hasConflict = () => drafts.conflicts().some((r) => !only || r.target.ref === only.ref);
    if (hasConflict()) return failure("conflict", "请先处置保留的冲突输入");
    const editors = store
      .editors()
      .filter((e) => !skipCapture.has(targetKey(e.lease.target)))
      .filter(
        (e) => !only || (e.lease.target.ref === only.ref && e.lease.target.facet === only.facet),
      );
    try {
      // 失焦可以产生属于编辑器的输入，但不能把宿主模型修改或租约替换吸收为新基线。
      const flushState = stateSignature(session),
        flushIdentity = identities(),
        flushLeases = store.leaseRevision;
      for (const e of editors) {
        if (store.editor(e.lease.target)?.lease !== e.lease)
          return failure("version-changed", "失焦前编辑器租约已变化");
        e.adapter.flush();
        sync();
        if (hasConflict()) return failure("conflict", "失焦期间出现冲突输入");
        if (
          stateSignature(session) !== flushState ||
          identities() !== flushIdentity ||
          store.leaseRevision !== flushLeases
        )
          return failure("version-changed", "失焦期间基础设计或编辑器已变化");
      }
      const before = stateSignature(session);
      let captureRevision = drafts.revision;
      for (const e of editors) {
        if (store.editor(e.lease.target)?.lease !== e.lease)
          return failure("version-changed", "编辑器租约已变化");
        const value = e.adapter.capture();
        // capture也可能调用宿主；同内容的新对象不能被候选末尾的sync吸收。
        sync();
        if (store.editor(e.lease.target)?.lease !== e.lease)
          return failure("version-changed", "捕获期间编辑器已替换");
        if (
          drafts.revision !== captureRevision ||
          stateSignature(session) !== before ||
          identities() !== flushIdentity ||
          store.leaseRevision !== flushLeases
        )
          return failure("version-changed", "捕获期间出现其他编辑");
        if (!value) return failure("capture-failed", "编辑器尚未就绪或无法收集");
        const staged = drafts.stage(e.lease.target, value);
        if (!staged.ok) return failure("capture-failed", staged.message);
        if (hasConflict()) return failure("conflict", "收集期间出现冲突输入");
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
    if (stamp() !== expected) return failure("version-changed", "候选交付前设计已变化");
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
    candidates.set(prepared, expected);
    return { ok: true, value: { public: prepared, inputs, expected } };
  }
  // 不可读的外部状态不能穿透UI，也不能沿用先前的校验/保存覆盖结论。
  function unexpected(error: unknown) {
    versions.invalidateCoverage();
    return {
      ok: false as const,
      code: "capture-failed" as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  function protect<T>(action: () => EditResult<T>): EditResult<T> {
    try {
      return action();
    } catch (error) {
      return unexpected(error);
    }
  }
  async function protectAsync<T>(action: () => Promise<EditResult<T>>): Promise<EditResult<T>> {
    try {
      return await action();
    } catch (error) {
      return unexpected(error);
    }
  }
  function readVersion<T>(read: () => T, fallback: T): T {
    try {
      return read();
    } catch (error) {
      unexpected(error);
      return fallback;
    }
  }
  let lastGeneration = 0;
  const locator = createLocator(store, drafts, () => {
    try {
      sync();
    } catch (error) {
      unexpected(error);
      throw error;
    }
  });
  return {
    ...context,
    sync: () =>
      protect(() => {
        sync();
        return { ok: true, value: undefined };
      }),
    target(kind: EntityKind, id: string, facet: Facet): EditResult<EditTarget> {
      return protect(() => {
        sync();
        const result = store.target(kind, id, facet);
        if (!result.ok) return result;
        try {
          context.read(result.value);
          return result;
        } catch {
          return failure("unsupported", "该对象没有受支持的编辑字段");
        }
      });
    },
    stage(target: EditTarget, input: DraftValue) {
      return protect(() => {
        sync();
        if (!store.resolve(target.ref)) return failure("stale-target", "编辑目标已失效");
        const entry = store.target(target.ref.kind, target.ref.id, target.facet);
        if (!entry.ok) return entry;
        return drafts.stage(target, input);
      });
    },
    resolveConflict(id: string, action: "discard-local" | "restart-on-current") {
      return protect(() => {
        sync();
        return drafts.resolveConflict(id, action);
      });
    },
    ...locator,
    dispose() {
      if (disposed) return;
      disposed = true;
      buildRequest++;
      locator.dispose();
      versions.dispose();
      store.dispose();
      subscribers.clear();
    },
    get model() {
      return session.current!.model;
    },
    get generation() {
      lastGeneration = readVersion(() => versions.generation, lastGeneration);
      return lastGeneration;
    },
    get savedGeneration() {
      return readVersion(() => versions.savedGeneration, 0);
    },
    get hasPersisted() {
      return readVersion(() => versions.hasPersisted, false);
    },
    get dirty() {
      return readVersion(() => versions.dirty, true);
    },
    get validationCurrent() {
      return readVersion(() => versions.validationCurrent, false);
    },
    validate: () => protectAsync(() => versions.validate()),
    async save(persist: Parameters<typeof versions.save>[0]) {
      try {
        return await versions.save(persist);
      } catch (error) {
        return { status: "failed" as const, message: unexpected(error).message };
      }
    },
    changeRules: versions.changeRules,
    get revision() {
      return revision;
    },
    openEditor(target: EditTarget) {
      return protect(() => {
        sync();
        const accepted = store.validateTarget(target);
        return accepted.ok ? drafts.begin(accepted.value) : accepted;
      });
    },
    createForm(name: string): EditResult<EditTarget> {
      return protect(() => {
        sync();
        if (disposed) return failure("cancelled", "编辑控制器已释放");
        try {
          const form = session.createForm(name);
          sync();
          notify();
          return store.target("form", form.id, "form-content");
        } catch (error) {
          return failure("invalid-input", error instanceof Error ? error.message : String(error));
        }
      });
    },
    renameForm(target: EditTarget, name: string): OperationResult {
      return protect(() => {
        sync();
        if (target.ref.kind !== "form" || !store.resolve(target.ref))
          return failure("stale-target", "表单目标已失效");
        try {
          session.renameForm(target.ref.id, name);
          sync(new Set([`form:${target.ref.id}`]));
          notify();
          return { ok: true, value: { revision } };
        } catch (error) {
          return failure("invalid-input", error instanceof Error ? error.message : String(error));
        }
      });
    },
    async executeOperation(
      request: DesignerOperationRequest,
      confirm: (refs: readonly import("./types").EntityRef[]) => Promise<boolean> = () =>
        Promise.resolve(false),
    ): Promise<OperationResult> {
      if (disposed) return failure("cancelled", "编辑控制器已释放");
      try {
        sync();
        if (request.model !== session.current!.model || request.renderRevision !== revision)
          return failure("version-changed", "渲染请求依据已变化");
        const expected = stamp(),
          model = session.current!.model,
          before = store.all();
        const xml = (await model.toXML()).xml;
        const copy = await parse(xml, {
          adapter: flowableAdapter,
          rejectWarnings: true,
          rejectUnregisteredNamespaces: true,
        });
        runOperation(copy, request.operation);
        if (stamp() !== expected) return failure("version-changed", "结构准备期间设计已变化");
        const alive = new Set(
          ((copy.process.get("flowElements") as ModdleElement[]) ?? []).map((e) =>
            String(e.get("id")),
          ),
        );
        const removed = before.filter(
          (r) => (r.kind === "node" || r.kind === "flow") && !alive.has(r.id),
        );
        const commit = () => {
          runOperation(model, request.operation);
          sync();
        };
        if (removed.length) {
          const result = await drafts.confirmRemoval(
            removed,
            () => confirm(removed),
            stamp,
            commit,
          );
          if (result.ok) notify();
          return result;
        }
        commit();
        notify();
        return { ok: true, value: { revision } };
      } catch (error) {
        // 无法确认结构请求的捕获/执行结果时，恢复可读也不能自动复用旧校验章。
        unexpected(error);
        return failure("commit-failed", error instanceof Error ? error.message : String(error));
      }
    },
    subscribe(callback: (event: ControllerEvent) => void) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    checkPreparedCandidate(candidate: PreparedCandidate): EditResult<void> {
      return protect(() => {
        if (disposed) return failure("cancelled", "编辑控制器已释放");
        return isCurrentCandidate(candidate)
          ? { ok: true, value: undefined }
          : failure("version-changed", "候选已过期或不是当前控制器签发");
      });
    },
    async prepare(purpose: "draft-save" | "validate"): Promise<EditResult<PreparedCandidate>> {
      if (purpose !== "draft-save" && purpose !== "validate")
        return failure("unsupported", "不支持的候选用途");
      const r = await build();
      return r.ok ? { ok: true, value: r.value.public } : r;
    },
    async apply(target: EditTarget): Promise<OperationResult> {
      return protectAsync(async () => {
        const accepted = store.validateTarget(target);
        if (!accepted.ok) return accepted;
        target = accepted.value;
        const result = await build(target);
        if (!result.ok) return result;
        if (stamp() !== result.value.expected || !store.resolve(target.ref))
          return failure("version-changed", "应用依据已变化");
        const before = versions.beginApply();
        const normalized = result.value.inputs.some((e) => normalizes(e.input));
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
        drafts.rebaseClean();
        revision++;
        const expectedKey = rawKey();
        if (before.validationCurrent || before.savedCurrent) {
          const post = await build(
            undefined,
            new Set(result.value.inputs.map((e) => targetKey(e.target))),
          );
          versions.finishApply(
            before,
            post.ok ? post.value.public : undefined,
            expectedKey,
            normalized,
          );
        } else versions.finishApply(before, undefined, expectedKey, normalized);
        notify();
        return { ok: true, value: { revision } };
      });
    },
    restore(target: EditTarget) {
      return protect(() => {
        sync();
        const accepted = store.validateTarget(target);
        if (!accepted.ok) return accepted;
        const previous = drafts
          .buffers()
          .find((r) => targetKey(r.target) === targetKey(accepted.value));
        // FormCreate持有独立内部状态，不能靠父props还原；原生属性字段仅在确有待放弃输入时重建。
        const resetEditor =
          accepted.value.facet === "form-content" ||
          Boolean(previous?.uncapturedVersion) ||
          Boolean(
            previous?.input &&
            graphValue(dataDraft(previous.input)) !==
              graphValue(dataDraft(context.read(accepted.value))),
          );
        const result = drafts.restore(accepted.value);
        if (result.ok) {
          const editor = store.editor(accepted.value);
          if (editor && resetEditor) store.releaseEditor(editor.lease);
          notify("restored", accepted.value);
        }
        return result;
      });
    },
    async deleteForm(
      target: EditTarget,
      confirm: () => Promise<boolean>,
    ): Promise<OperationResult> {
      return protectAsync(async () => {
        sync();
        if (target.ref.kind !== "form" || !store.resolve(target.ref))
          return failure("stale-target", "表单目标已失效");
        const pending = drafts
          .buffers()
          .filter(
            (r) =>
              store.resolve(r.target.ref) &&
              r.status !== "clean" &&
              ((r.input?.kind === "approval" && r.input.formKey === target.ref.id) ||
                (r.input?.kind === "default-form" && r.input.formKey?.trim() === target.ref.id)),
          );
        const usages = collectFormUsage(session.current!.model, target.ref.id);
        if (pending.length || usages.length)
          return failure(
            "invalid-input",
            pending.length
              ? "表单仍被未应用绑定引用，请先明确还原或修改这些绑定"
              : "表单仍被引用，请先应用解除引用",
          );
        const result = await drafts.confirmRemoval([target.ref], confirm, stamp, () => {
          session.deleteForm(target.ref.id);
          sync();
        });
        if (result.ok) {
          revision++;
          notify();
        }
        return result;
      });
    },
  };
}
export type ContractController = ReturnType<typeof createContractController>;
