export type EntityKind = "process" | "node" | "flow" | "form";
export type Facet = "properties" | "default-form" | "form-content";
export type EntityRef = Readonly<{
  controllerId: string;
  documentEpoch: number;
  kind: EntityKind;
  id: string;
  lifetime: number;
}>;
export type EditTarget = Readonly<{ ref: EntityRef; facet: Facet }>;
export type FlowPropertyDraft =
  | { kind: "process"; name: string }
  | {
      kind: "approval";
      name: string;
      approvalKind: "single" | "all" | "any" | "sequential";
      assignee: string;
      formKey: string;
      elementVariable?: string;
      lastSingleAssignee?: string;
      lastCollection?: string;
    }
  | { kind: "cc"; name: string; recipients: string }
  | { kind: "branch"; name: string; condition: string };
export type DraftValue =
  | FlowPropertyDraft
  | { kind: "default-form"; formKey: string | undefined }
  | { kind: "form-content"; rules: string; options: string };
export type DraftStatus = "clean" | "dirty" | "invalid" | "conflicted" | "detached";
export type EditFailureCode =
  | "stale-target"
  | "conflict"
  | "invalid-input"
  | "capture-failed"
  | "version-changed"
  | "unsupported"
  | "commit-failed"
  | "cancelled";
export type EditResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: EditFailureCode; message: string; target?: EditTarget };
export type OperationResult = EditResult<{ revision: number }>;
export type EditorAdapter = { flush(): void; capture(): DraftValue | null };
export type EditorLease = Readonly<{ token: symbol; target: EditTarget }>;
export type EditorEntry = Readonly<{ lease: EditorLease; adapter: EditorAdapter }>;
export const targetKey = (target: EditTarget) =>
  JSON.stringify([
    target.ref.controllerId,
    target.ref.documentEpoch,
    target.ref.kind,
    target.ref.id,
    target.ref.lifetime,
    target.facet,
  ]);
export const failure = (code: EditFailureCode, message: string): EditResult<never> => ({
  ok: false,
  code,
  message,
});
