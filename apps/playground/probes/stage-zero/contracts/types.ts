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
import { KIND_OPTIONS } from "../../../../../packages/designer/src/property-editing";
import type { FlowPropertyDraft } from "../../../../../packages/designer/src/property-editing";
export type { FlowPropertyDraft } from "../../../../../packages/designer/src/property-editing";
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

/** 只检查协议数据形状，业务格式/完整性仍由designer共享规则检查。 */
export function isDraftValue(value: unknown): value is DraftValue {
  try {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    const fields: Record<string, readonly string[]> = {
      process: ["kind", "name"],
      approval: [
        "kind",
        "name",
        "approvalKind",
        "assignee",
        "formKey",
        "elementVariable",
        "lastSingleAssignee",
        "lastCollection",
      ],
      cc: ["kind", "name", "recipients"],
      branch: ["kind", "name", "condition"],
      "default-form": ["kind", "formKey"],
      "form-content": ["kind", "rules", "options"],
    };
    if (typeof v.kind !== "string" || !Object.hasOwn(fields, v.kind)) return false;
    if (!Object.getOwnPropertyNames(v).every((key) => fields[v.kind as string]!.includes(key)))
      return false;
    if (v.kind === "default-form") return v.formKey === undefined || typeof v.formKey === "string";
    if (v.kind === "form-content")
      return typeof v.rules === "string" && typeof v.options === "string";
    if (typeof v.name !== "string") return false;
    if (v.kind === "approval")
      return (
        typeof v.assignee === "string" &&
        typeof v.formKey === "string" &&
        KIND_OPTIONS.some((option) => option.key === v.approvalKind) &&
        [v.elementVariable, v.lastSingleAssignee, v.lastCollection].every(
          (item) => item === undefined || typeof item === "string",
        )
      );
    if (v.kind === "cc") return typeof v.recipients === "string";
    if (v.kind === "branch") return typeof v.condition === "string";
    return true;
  } catch {
    return false;
  }
}
