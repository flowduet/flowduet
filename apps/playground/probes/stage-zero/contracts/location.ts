import type { FocusResult } from "../../../../../packages/designer/src/property-editing";
import type { EntityStore } from "./entity-store";
import type { DraftStore } from "./draft-store";
import type { EditTarget } from "./types";
export type LocationView = {
  route(target: EditTarget): Promise<void>;
  focus(target: EditTarget, signal?: AbortSignal): Promise<FocusResult>;
  selectedId(): string | undefined;
};
export type LocateResult =
  | { status: "located"; target: EditTarget; selectedId: string }
  | {
      status: "stale-target" | "conflict" | "cancelled" | "unsupported" | "failed";
      message: string;
    };
export function createLocator(store: EntityStore, drafts: DraftStore, sync: () => void) {
  let view: LocationView | undefined,
    request = 0,
    disposed = false;
  return {
    attachView(adapter: LocationView) {
      if (disposed) return;
      request++;
      view = adapter;
    },
    cancelLocate() {
      request++;
    },
    dispose() {
      disposed = true;
      view = undefined;
      request++;
    },
    async locate(target: EditTarget, signal?: AbortSignal): Promise<LocateResult> {
      const serial = ++request;
      const accepted = store.validateTarget(target);
      if (!accepted.ok)
        return {
          status: accepted.code === "stale-target" ? "stale-target" : "unsupported",
          message: accepted.message,
        };
      target = accepted.value;
      const adapter = view;
      const check = (): LocateResult | undefined => {
        sync();
        if (disposed || signal?.aborted || serial !== request)
          return { status: "cancelled", message: "定位请求已取消" };
        if (!store.resolve(target.ref))
          return { status: "stale-target", message: "旧目标已失效或不属于本实例" };
        if (drafts.conflicts().some((r) => r.target.ref === target.ref))
          return { status: "conflict", message: "请先查看该目标的冲突输入" };
        return undefined;
      };
      try {
        const initial = check();
        if (initial) return initial;
        if (!adapter) return { status: "unsupported", message: "尚未连接实际编辑视图" };
        await adapter.route(target);
        const afterRoute = check();
        if (afterRoute) return afterRoute;
        const focused = await adapter.focus(target, signal);
        const afterFocus = check();
        if (afterFocus) return afterFocus;
        if (focused.status === "cancelled")
          return { status: "cancelled", message: "视图定位已取消" };
        const selectedId = adapter.selectedId();
        if (
          focused.status !== "focused" ||
          selectedId !== target.ref.id ||
          focused.selectedId !== selectedId
        )
          return { status: "failed", message: "实际选择或焦点未到达目标" };
        return { status: "located", target, selectedId };
      } catch (error) {
        return {
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
