import type { EditResult, EditTarget, EditorAdapter, EditorLease } from "../contracts/types";
export type FieldCaseId =
  "F01" | "F02" | "F03" | "F04" | "F05" | "F06" | "F07" | "F08" | "L01" | "I01";
export type StateCaseId =
  | "loaded"
  | "focused"
  | "cleared"
  | "unset"
  | "options-pending"
  | "composition"
  | "dragging"
  | "dialog-pending";
export type RetentionStrategy = "keep-mounted" | "rebuild-verified";
export type ActualStrategy = "kept" | "rebuilt" | "kept-fallback";
export type FormContent = { rules: string; options: string };
export type MountedEditor = { target: EditTarget; instanceId: string; adapter: EditorAdapter };
export type LiveState = {
  selectedField: string | null;
  configPage: string | null;
  pendingControls: readonly {
    path: string;
    text: string;
    selectedOptions: readonly string[];
    selection: readonly [number, number] | null;
  }[];
  openLayers: readonly { path: string; ownerTargetKey: string; confirmed: boolean }[];
  composing: boolean;
  dragging: boolean;
  ownerKnown: boolean;
};
export type SuspendedFormSnapshot = {
  target: EditTarget;
  content: FormContent;
  context: LiveState;
};
export type SwitchOutcome = { active: EditTarget; actual: ActualStrategy; reason?: string };
export type RetentionHost = {
  current(): MountedEditor | undefined;
  observe(editor: MountedEditor): LiveState;
  mountActive(target: EditTarget): Promise<MountedEditor>;
  mountProvisional(target: EditTarget, content: FormContent): Promise<MountedEditor>;
  restoreContext(editor: MountedEditor, before: LiveState): Promise<boolean>;
  adopt(editor: MountedEditor, lease: EditorLease): void;
  show(editor: MountedEditor): void;
  unmount(editor: MountedEditor): void;
};
export type SelectionResult = EditResult<SwitchOutcome>;
