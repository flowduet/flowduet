import { expect, it } from "vitest";
import { installDragBoundary } from "./drag-boundary";
import { assertCaptureReady } from "./input-boundary";
it("drag_busy_refuses_snapshot_handoff：结束刷新前始终拒绝", () => {
  const root = document.createElement("div"),
    queue: (() => void)[] = [];
  let dragging = false;
  const stop = installDragBoundary(
    root,
    (value) => {
      dragging = value;
    },
    (task) => queue.push(task),
  );
  try {
    root.dispatchEvent(new Event("dragstart", { bubbles: true }));
    const state = () => ({
      selectedField: null,
      configPage: null,
      pendingControls: [],
      openLayers: [],
      composing: false,
      dragging,
      ownerKnown: true,
    });
    expect(() => assertCaptureReady(state())).toThrow();
    root.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(dragging).toBe(true);
    queue.splice(0).forEach((task) => task());
    expect(() => assertCaptureReady(state())).not.toThrow();
  } finally {
    stop();
  }
});
it("cancelled_drag_keeps_original_layout：取消不写规则且未知结束保持保护", () => {
  const root = document.createElement("div"),
    original = '<div data-rule="original"></div>';
  root.innerHTML = original;
  let dragging = false;
  const stop = installDragBoundary(
    root,
    (value) => {
      dragging = value;
    },
    (task) => task(),
  );
  root.dispatchEvent(new Event("dragstart", { bubbles: true }));
  root.dispatchEvent(new Event("pointercancel", { bubbles: true }));
  expect(root.innerHTML).toBe(original);
  expect(dragging).toBe(true);
  stop();
  root.dispatchEvent(new Event("dragend", { bubbles: true }));
  expect(dragging).toBe(true);
});
