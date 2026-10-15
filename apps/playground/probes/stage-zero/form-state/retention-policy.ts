import type { ContractController } from "../contracts/controller";
import {
  failure,
  targetKey,
  type EditTarget,
  type EditorLease,
  type EditResult,
} from "../contracts/types";
import { assertCaptureReady } from "./input-boundary";
import { equivalentContent } from "./state-evidence";
import type {
  FormContent,
  LiveState,
  MountedEditor,
  RetentionHost,
  RetentionStrategy,
  SelectionResult,
  SuspendedFormSnapshot,
} from "./types";

/** 只负责探针实例导航；输入、候选和对象身份仍由A/B控制器维护。 */
export function createRetentionPolicy(controller: ContractController, host: RetentionHost) {
  let request = 0,
    disposed = false;
  const snapshots = new Map<string, SuspendedFormSnapshot>();
  const temporary = new Set<MountedEditor>();
  const abandoned = new Set<MountedEditor>();
  let recovery:
    { source: MountedEditor; destination: MountedEditor; lease: EditorLease } | undefined;
  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const isCurrent = (ticket: number) => !disposed && ticket === request;
  function remove(editor: MountedEditor) {
    host.unmount(editor);
    temporary.delete(editor);
    abandoned.delete(editor);
  }
  function cleanTemporary(all = false) {
    const errors: string[] = [];
    for (const editor of [...(all ? temporary : abandoned)]) {
      try {
        remove(editor);
      } catch (error) {
        errors.push(errorText(error));
      }
    }
    return errors;
  }
  async function keep(
    target: EditTarget,
    ticket: number,
    reason?: string,
  ): Promise<SelectionResult> {
    const opened = controller.openEditor(target);
    if (!opened.ok) return opened;
    const editor = await host.mountActive(target);
    if (!isCurrent(ticket)) return failure("cancelled", "导航已被更新请求替代");
    if (!controller.store.resolve(target.ref)) return failure("stale-target", "目标已失效");
    host.show(editor);
    return {
      ok: true,
      value: {
        active: target,
        actual: reason ? "kept-fallback" : "kept",
        ...(reason ? { reason } : {}),
      },
    };
  }
  function verify(editor: MountedEditor, content: FormContent, context?: LiveState) {
    assertCaptureReady(host.observe(editor));
    editor.adapter.flush();
    const value = editor.adapter.capture();
    if (!value || value.kind !== "form-content" || !equivalentContent(content, value))
      throw Error("临时实例内容或value存在性不等价");
    if (context && JSON.stringify(host.observe(editor)) !== JSON.stringify(context))
      throw Error("临时实例缺少原输入上下文");
  }
  async function provisional(
    owned: Set<MountedEditor>,
    target: EditTarget,
    content: FormContent,
    context?: LiveState,
  ) {
    const editor = await host.mountProvisional(target, content);
    temporary.add(editor);
    owned.add(editor);
    if (context && !(await host.restoreContext(editor, context))) throw Error("原上下文不可恢复");
    verify(editor, content, context);
    return editor;
  }
  function retryRecovery(): EditResult<void> {
    if (disposed) return failure("cancelled", "实例策略已释放");
    try {
      if (recovery) {
        const { source, destination, lease } = recovery;
        if (
          controller.store.editor(destination.target)?.lease !== lease ||
          !controller.store.resolve(destination.target.ref)
        )
          return failure("version-changed", "移交后的目标或租约已更换，保留比较实例");
        host.adopt(destination, lease);
        host.show(destination);
        host.unmount(source);
        recovery = undefined;
      }
      const errors = cleanTemporary();
      return errors.length
        ? failure("commit-failed", errors.join("；"))
        : { ok: true, value: undefined };
    } catch (error) {
      return failure("commit-failed", `移交后恢复尚未完成：${errorText(error)}`);
    }
  }
  return {
    async select(target: EditTarget, strategy: RetentionStrategy): Promise<SelectionResult> {
      const ticket = ++request;
      if (disposed) return failure("cancelled", "实例策略已释放");
      if (recovery) return failure("commit-failed", "请先重试清理/显示，保留现有输入");
      try {
        const synced = controller.sync();
        if (!synced.ok) return synced;
        const valid = controller.store.validateTarget(target);
        if (!valid.ok) return valid;
        target = valid.value;
        if (target.ref.kind !== "form" || target.facet !== "form-content")
          return failure("unsupported", "只能切换当前控制器的表单");
        if (strategy !== "keep-mounted" && strategy !== "rebuild-verified")
          return failure("unsupported", "未知策略");
        const source = host.current();
        if (
          strategy === "keep-mounted" ||
          !source ||
          targetKey(source.target) === targetKey(target)
        )
          return await keep(target, ticket);
        // 已有活实例优先复用，不能覆盖其未序列化输入。
        if (controller.store.editor(target))
          return await keep(target, ticket, "目标已有活实例，复用K");
        const owned = new Set<MountedEditor>();
        let transferred = false;
        try {
          const lease = controller.store.editor(source.target)?.lease;
          if (!lease || controller.store.editor(source.target)?.adapter !== source.adapter)
            throw Error("源租约已失效");
          const before = structuredClone(host.observe(source));
          assertCaptureReady(before);
          // begin会改变drafts.revision，必须早于prepare锁住B基线。
          const opened = controller.openEditor(target);
          if (!opened.ok || opened.value.kind !== "form-content")
            throw Error(opened.ok ? "目标不是表单" : opened.message);
          const prepared = await controller.prepare("draft-save");
          if (!prepared.ok) throw Error(`${prepared.code}：${prepared.message}`);
          if (!isCurrent(ticket)) return failure("cancelled", "导航已替换");
          const input = controller.drafts.input(source.target);
          if (!input || input.kind !== "form-content") throw Error("缺少候选对应的源缓冲");
          const snapshot: SuspendedFormSnapshot = {
            target: source.target,
            content: { rules: input.rules, options: input.options },
            context: before,
          };
          const proof = await provisional(owned, source.target, snapshot.content, before);
          owned.add(proof);
          if (!isCurrent(ticket)) return failure("cancelled", "导航已替换");
          remove(proof);
          owned.delete(proof);
          const cached = snapshots.get(targetKey(target));
          if (cached && !equivalentContent(cached.content, opened.value))
            throw Error("暂停后目标内容已更改，无法沿用旧上下文");
          const destination = await provisional(
            owned,
            target,
            { rules: opened.value.rules, options: opened.value.options },
            cached?.context,
          );
          owned.add(destination);
          if (!isCurrent(ticket)) return failure("cancelled", "导航已替换");
          if (JSON.stringify(host.observe(source)) !== JSON.stringify(before))
            throw Error("恢复期间源输入上下文已变化");
          if (
            controller.store.editor(source.target)?.lease !== lease ||
            controller.store.editor(target) ||
            !controller.store.resolve(source.target.ref) ||
            !controller.store.resolve(target.ref)
          )
            throw Error("源/目标生命期或租约已变化");
          const checked = controller.checkPreparedCandidate(prepared.value);
          if (!checked.ok) throw Error(`${checked.code}：${checked.message}`);
          // 闸门到签发/撤销仅调用既有store同步方法，不穿插await或宿主回调。
          const newLease = controller.store.registerEditor(target, destination.adapter);
          controller.store.releaseEditor(lease);
          transferred = true;
          temporary.delete(destination);
          owned.delete(destination);
          snapshots.set(targetKey(source.target), snapshot);
          recovery = { source, destination, lease: newLease };
          const recovered = retryRecovery();
          if (!recovered.ok) return recovered;
          return { ok: true, value: { active: target, actual: "rebuilt" } };
        } catch (error) {
          if (transferred) return failure("commit-failed", errorText(error));
          if (!isCurrent(ticket)) return failure("cancelled", "导航已替换");
          // 自己的临时实例由finally收尾，不能删除其他请求持有的实例。
          for (const editor of owned) {
            remove(editor);
            owned.delete(editor);
          }
          return await keep(target, ticket, errorText(error));
        } finally {
          for (const editor of owned) {
            try {
              remove(editor);
            } catch {
              abandoned.add(editor); /* 保留供显式重试，不宣称清理成功。 */
            }
          }
        }
      } catch (error) {
        return failure(!isCurrent(ticket) ? "cancelled" : "capture-failed", errorText(error));
      }
    },
    retryRecovery,
    recoveryState: () => ({ pending: Boolean(recovery), temporary: temporary.size }),
    dispose() {
      if (disposed) return;
      disposed = true;
      request++;
      cleanTemporary(true);
      snapshots.clear();
    },
  };
}
