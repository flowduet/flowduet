import { describe, it, expect } from "vitest";
import { assertCaptureReady, runLocalShortcut } from "./input-boundary";
import type { LiveState } from "./types";
const ready = (): LiveState => ({
  selectedField: null,
  configPage: null,
  pendingControls: [],
  openLayers: [],
  composing: false,
  dragging: false,
  ownerKnown: true,
});
describe("C2 输入边界", () => {
  it("只读快捷键不再传入第三方潜在编辑监听，其他键保持原路由", () => {
    const root = document.createElement("div"),
      input = document.createElement("input");
    root.append(input);
    let observed = 0,
      collected = 0,
      edited = 0;
    root.addEventListener(
      "keydown",
      (e) => runLocalShortcut(e, { observe: () => observed++, collect: () => collected++ }),
      true,
    );
    input.addEventListener("keydown", () => edited++);
    for (const key of ["Alt", "o", "s"])
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key, altKey: true, bubbles: true, cancelable: true }),
      );
    expect(observed).toBe(1);
    expect(collected).toBe(1);
    expect(edited).toBe(0);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(edited).toBe(1);
  });
  it.each(["composition", "drag", "owner", "popup", "badInput"])(
    "%s待确认时不允许序列化旧值",
    (kind) => {
      const state = ready();
      if (kind === "composition") state.composing = true;
      if (kind === "drag") state.dragging = true;
      if (kind === "owner") state.ownerKnown = false;
      if (kind === "popup")
        state.openLayers = [{ path: "date", ownerTargetKey: "A", confirmed: false }];
      if (kind === "badInput")
        state.pendingControls = [
          { path: "number", text: "", selectedOptions: [], selection: null, badInput: true },
        ];
      expect(() => assertCaptureReady(state)).toThrow();
    },
  );
  it("已确认输入不会被误挡", () => expect(() => assertCaptureReady(ready())).not.toThrow());
});
