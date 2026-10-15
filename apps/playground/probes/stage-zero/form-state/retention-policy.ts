import type { ContractController } from "../contracts/controller";
import { failure, type EditTarget } from "../contracts/types";
import type { RetentionHost, RetentionStrategy, SelectionResult } from "./types";
/** 只负责探针的实例导航；模型、输入和候选的事实仍由A/B控制器维护。 */
export function createRetentionPolicy(controller: ContractController, host: RetentionHost) {
  let request = 0,
    disposed = false;
  return {
    async select(target: EditTarget, strategy: RetentionStrategy): Promise<SelectionResult> {
      const ticket = ++request;
      if (disposed) return failure("cancelled", "实例策略已释放");
      const synced = controller.sync();
      if (!synced.ok) return synced;
      const valid = controller.store.validateTarget(target);
      if (!valid.ok) return valid;
      target = valid.value;
      if (target.ref.kind !== "form" || target.facet !== "form-content")
        return failure("unsupported", "只能切换当前控制器的表单");
      if (strategy !== "keep-mounted") return failure("unsupported", "重建策略尚未验证");
      try {
        const opened = controller.openEditor(target);
        if (!opened.ok) return opened;
        const editor = await host.mountActive(target);
        if (disposed || ticket !== request) return failure("cancelled", "导航已被更新请求替代");
        if (!controller.store.resolve(target.ref)) return failure("stale-target", "目标已失效");
        host.show(editor);
        return { ok: true, value: { active: target, actual: "kept" } };
      } catch (error) {
        return failure(
          disposed || ticket !== request ? "cancelled" : "capture-failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    dispose() {
      disposed = true;
      request++;
    },
  };
}
