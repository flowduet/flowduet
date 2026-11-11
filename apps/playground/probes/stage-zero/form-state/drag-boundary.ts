/** 仅观察本实例原生拖动；未收到结束事件时保持不确定，不推断规则已回滚。 */
export function installDragBoundary(
  root: HTMLElement,
  changed: (dragging: boolean) => void,
  afterRender: (task: () => void) => void,
) {
  let revision = 0,
    disposed = false;
  const start = () => {
    revision++;
    changed(true);
  };
  const end = () => {
    const expected = revision;
    afterRender(() => {
      if (!disposed && revision === expected) changed(false);
    });
  };
  root.addEventListener("dragstart", start, true);
  root.addEventListener("dragend", end, true);
  return () => {
    disposed = true;
    root.removeEventListener("dragstart", start, true);
    root.removeEventListener("dragend", end, true);
  };
}
