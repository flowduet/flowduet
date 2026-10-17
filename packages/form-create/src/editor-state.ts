/** 编辑版本仅用于本实例收集屏障，不替代宿主的对象生命期、租约与保存世代。 */
export type FormDesignerBlocker = Readonly<{
  code:
    | "not-ready"
    | "pending-input"
    | "pending-update"
    | "composing"
    | "dragging"
    | "unknown-owner"
    | "unsupported-input"
    | "unsupported-mode"
    | "version-changed"
    | "disposed";
  field?: string;
  message: string;
}>;
export type FormDesignerEditingState = Readonly<{
  mode: "legacy" | "retained";
  revision: number;
  canSuspend: boolean;
  canCapture: boolean;
  blockers: readonly FormDesignerBlocker[];
}>;
export type FormDesignerCaptureResult =
  | { status: "captured"; revision: number; content: { rules: string; options: string } }
  | { status: "blocked"; blockers: readonly FormDesignerBlocker[] }
  | { status: "failed"; message: string };
