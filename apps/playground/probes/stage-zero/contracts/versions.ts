import type { PreparedCandidate } from "./candidate";
import { failure, type DraftValue, type EditResult } from "./types";
export type SaveSnapshot = Readonly<{
  snapshotId: number;
  controllerId: string;
  documentEpoch: number;
  generation: number;
  json: string;
}>;
export function dataDraft(input: DraftValue) {
  if (input.kind !== "approval") return input;
  const data = { ...input };
  delete data.lastSingleAssignee;
  delete data.lastCollection;
  if (data.approvalKind === "single") delete data.elementVariable;
  return data;
}
export function normalizes(input: DraftValue): boolean {
  if ("name" in input && input.name !== input.name.trim()) return true;
  if (input.kind === "approval" && input.assignee !== input.assignee.trim()) return true;
  if (input.kind === "cc" && input.recipients !== input.recipients.trim()) return true;
  if (input.kind === "branch" && input.condition !== input.condition.trim()) return true;
  return (
    input.kind === "default-form" &&
    input.formKey !== undefined &&
    input.formKey !== input.formKey.trim()
  );
}
export function createVersions(options: {
  key(): string;
  identity(): string;
  epoch(): number;
  prepare(): Promise<EditResult<PreparedCandidate>>;
  isCurrent(candidate: PreparedCandidate): boolean;
  notify(type: string): void;
}) {
  const initial = options.key();
  let lastKey = initial,
    generation = 0,
    saveRequest = 0,
    validationRequest = 0,
    ruleRevision = 0,
    coverageRevision = 0,
    uncertain = false;
  type Validation = {
    rawKey: string;
    identity: string;
    epoch: number;
    json: string;
    rules: number;
  };
  type Saved = {
    rawKey: string;
    identity: string;
    epoch: number;
    json: string;
    generation: number;
    snapshotId: number;
  };
  let validation: Validation | undefined, saved: Saved | undefined;
  const observe = () => {
    const key = options.key();
    if (key !== lastKey) {
      lastKey = key;
      generation++;
    }
    return generation;
  };
  const current = () =>
    Boolean(
      validation &&
      validation.rawKey === options.key() &&
      validation.epoch === options.epoch() &&
      validation.identity === options.identity() &&
      validation.rules === ruleRevision,
    );
  const dirty = () =>
    uncertain || options.key() !== (saved?.epoch === options.epoch() ? saved.rawKey : initial);
  return {
    get generation() {
      return observe();
    },
    get savedGeneration() {
      return saved?.epoch === options.epoch() ? saved.generation : 0;
    },
    get hasPersisted() {
      return saved?.epoch === options.epoch();
    },
    get dirty() {
      return dirty();
    },
    get validationCurrent() {
      return current();
    },
    invalidateCoverage() {
      coverageRevision++;
      uncertain = true;
      validation = undefined;
    },
    get coverageRevision() {
      return coverageRevision;
    },
    confirmCoverage(expected: number) {
      if (expected !== coverageRevision) return false;
      uncertain = false;
      return true;
    },
    dispose() {
      saveRequest++;
      validationRequest++;
      validation = undefined;
      uncertain = true;
    },
    changeRules() {
      ruleRevision++;
      validationRequest++;
      validation = undefined;
      options.notify("validation-invalidated");
    },
    async validate(): Promise<EditResult<PreparedCandidate>> {
      const request = ++validationRequest,
        coverage = coverageRevision,
        result = await options.prepare();
      if (request !== validationRequest) return failure("cancelled", "校验请求已被更新请求替代");
      if (!result.ok) {
        if (result.code !== "cancelled") validation = undefined;
        return result;
      }
      if (!options.isCurrent(result.value)) return failure("version-changed", "候选在交付时已过期");
      if (coverage !== coverageRevision)
        return failure("version-changed", "校验期间编辑覆盖已变化");
      if (result.value.pendingIssues.length || result.value.referenceIssues.length) {
        validation = undefined;
        return failure(
          "invalid-input",
          [...result.value.pendingIssues, ...result.value.referenceIssues].join("\n"),
        );
      }
      validation = {
        rawKey: options.key(),
        identity: options.identity(),
        epoch: options.epoch(),
        json: result.value.json,
        rules: ruleRevision,
      };
      options.notify("validated");
      return result;
    },
    beginApply() {
      return {
        validation,
        saved,
        validationCurrent: current(),
        savedCurrent: !dirty() && Boolean(saved),
        request: validationRequest,
        epoch: options.epoch(),
        identity: options.identity(),
      };
    },
    finishApply(
      before: {
        validation: Validation | undefined;
        saved: Saved | undefined;
        validationCurrent: boolean;
        savedCurrent: boolean;
        request: number;
        epoch: number;
        identity: string;
      },
      post: PreparedCandidate | undefined,
      expectedKey: string,
      normalized: boolean,
    ) {
      const equivalent = Boolean(
        post &&
        options.key() === expectedKey &&
        before.epoch === options.epoch() &&
        before.identity === options.identity(),
      );
      if (validation === before.validation && before.request === validationRequest) {
        if (
          before.validationCurrent &&
          !normalized &&
          equivalent &&
          post?.json === before.validation?.json
        )
          validation = { ...before.validation!, rawKey: options.key() };
        else validation = undefined;
      }
      if (
        saved === before.saved &&
        before.savedCurrent &&
        equivalent &&
        post?.json === before.saved?.json
      )
        saved = { ...before.saved!, rawKey: options.key(), generation: observe() };
    },
    async save(
      persist: (snapshot: SaveSnapshot) => Promise<void>,
    ): Promise<{ status: "saved" | "stale" | "failed"; message?: string }> {
      const request = ++saveRequest,
        epoch = options.epoch(),
        prepared = await options.prepare();
      if (request !== saveRequest || epoch !== options.epoch()) return { status: "stale" };
      if (!prepared.ok)
        return prepared.code === "cancelled"
          ? { status: "stale" }
          : { status: "failed", message: prepared.message };
      if (!options.isCurrent(prepared.value)) return { status: "stale" };
      const rawKey = options.key(),
        identity = options.identity(),
        snapshotGeneration = observe();
      const snapshot: SaveSnapshot = Object.freeze({
        snapshotId: request,
        controllerId: prepared.value.controllerId,
        documentEpoch: epoch,
        generation: snapshotGeneration,
        json: prepared.value.json,
      });
      try {
        await persist(snapshot);
        if (request !== saveRequest || epoch !== options.epoch()) return { status: "stale" };
        saved = {
          rawKey,
          identity,
          epoch,
          json: prepared.value.json,
          generation: snapshotGeneration,
          snapshotId: request,
        };
        options.notify("saved");
        return { status: "saved" };
      } catch (error) {
        return request !== saveRequest || epoch !== options.epoch()
          ? { status: "stale" }
          : { status: "failed", message: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
