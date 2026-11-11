import type { LiveState } from "./types";
/** 只截获本实验根内声明的键，避免观察/收集键继续被第三方计作编辑。 */
export function runLocalShortcut(
  event: KeyboardEvent,
  actions: { observe(): void; collect(): void },
): boolean {
  if (!event.altKey) return false;
  if (event.key === "Alt") {
    event.stopPropagation();
    return true;
  }
  const key = event.key.toLowerCase();
  if (!["o", "s"].includes(key)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (key === "o") actions.observe();
  else actions.collect();
  return true;
}
export function assertCaptureReady(state: LiveState): void {
  if (state.composing) throw new Error("输入法尚未完成");
  if (state.dragging) throw new Error("拖拽尚未完成");
  if (!state.ownerKnown || state.openLayers.length) throw new Error("弹层输入尚未确认或归属不明");
  if (state.pendingControls.some((control) => control.badInput))
    throw new Error("数值中间输入尚未确认");
}
