/**
 * FormCreate 3.5.0 在 created 中直接覆盖两个全局处理器。
 * 包装层先保存宿主引用，在子组件开始渲染前取回供应商回调并立即恢复宿主；
 * 回调改由本实例监听，避免卸载时还原旧快照而覆盖宿主的新处理器。
 */
export function captureDesignerHostEvents() {
  const body = document.body;
  const hostUnload = window.onbeforeunload;
  const hostDrop = body.ondrop;
  let providerUnload: Window["onbeforeunload"] = null;
  let providerDrop: HTMLElement["ondrop"] = null;
  let mounted = false;

  function beforeUnload(event: BeforeUnloadEvent): void {
    providerUnload?.call(window, event);
  }
  return {
    mount(): void {
      if (mounted) return;
      const unload = window.onbeforeunload;
      const drop = body.ondrop;
      window.onbeforeunload = hostUnload;
      body.ondrop = hostDrop;
      providerUnload = unload !== hostUnload ? unload : null;
      providerDrop = drop !== hostDrop ? drop : null;
      if (providerUnload) window.addEventListener("beforeunload", beforeUnload);
      mounted = true;
    },
    drop(event: DragEvent): void {
      providerDrop?.call(body, event);
    },
    dispose(): void {
      window.removeEventListener("beforeunload", beforeUnload);
      providerUnload = null;
      providerDrop = null;
    },
  };
}
