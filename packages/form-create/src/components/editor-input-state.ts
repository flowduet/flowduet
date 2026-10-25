import { shallowReactive, watch } from "vue";
import { TEXT_DEFAULT_STATE } from "./text-defaults.js";
import type { FormDesignerBlocker } from "../editor-state.js";

type Source = {
  type?: unknown;
  field?: unknown;
  value?: unknown;
  props?: Record<string, unknown>;
  children?: unknown[];
};
type Publish = (value: unknown) => void;
export type DefaultInputBinding = ReturnType<typeof createBinding>;

function parseRaw(
  raw: string,
  kind: "number" | "date" | "text",
): { valid: boolean; value?: unknown } {
  if (kind === "text") return { valid: true, value: raw };
  if (raw === "") return { valid: true, value: undefined };
  if (kind === "number") {
    if (!/^[+-]?(?:\d+|\d+\.\d+|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return { valid: false };
    const value = Number(raw);
    return { valid: Number.isFinite(value), value };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { valid: false };
  const [year, month, day] = raw.split("-").map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return {
    valid:
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day,
    value: raw,
  };
}
function equivalent(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (a === undefined && (b === "" || b === null));
}
function createBinding(source: Source, notify: (edited: boolean) => void) {
  const kind = source.type === "input" ? "text" : source.type === "inputNumber" ? "number" : "date";
  const supportsInput = () =>
    kind !== "date" ||
    ((!source.props?.type || source.props.type === "date") &&
      (!source.props?.valueFormat || source.props.valueFormat === "YYYY-MM-DD"));
  let committed = source.value,
    expected: unknown;
  let alive = true,
    waiting = false,
    dirty = false,
    conflict = false;
  let inputVersion = 0;
  const matches = (a: unknown, b: unknown) =>
    kind === "text" && a !== undefined
      ? Object.is(a, b) ||
        (a === "" && b === undefined && source.props?.[TEXT_DEFAULT_STATE] === true)
      : equivalent(a, b);
  const state = shallowReactive({
    get field() {
      return String(source.field ?? "");
    },
    kind,
    enabled:
      kind !== "text" ||
      (source.props && Object.hasOwn(source.props, TEXT_DEFAULT_STATE)
        ? source.props[TEXT_DEFAULT_STATE] === true
        : Object.hasOwn(source, "value") && source.value !== undefined),
    setEnabled(enabled: boolean, publish: Publish) {
      if (!alive || kind !== "text") return;
      const version = ++inputVersion;
      state.enabled = enabled;
      state.raw = "";
      dirty = true;
      waiting = true;
      expected = enabled ? "" : undefined;
      notify(true);
      if (!alive || version !== inputVersion) return;
      source.props ??= {};
      source.props[TEXT_DEFAULT_STATE] = enabled;
      if (enabled) source.value = "";
      else delete source.value;
      publish(expected);
    },
    get supported() {
      return supportsInput();
    },
    raw: source.value === undefined || source.value === null ? "" : String(source.value),
    composing: false,
    settling: false,
    popupOpen: false,
    popup(open: boolean) {
      state.popupOpen = open;
      notify(false);
    },
    input(raw: string, publish: Publish) {
      if (!alive || (kind === "text" && !state.enabled)) return;
      const version = ++inputVersion;
      state.raw = raw;
      dirty = true;
      const parsed = parseRaw(raw, kind);
      waiting = !state.composing && state.supported && !conflict && parsed.valid;
      if (waiting) expected = parsed.value;
      // draftChange订阅者可同步捕获；包括业务值相等的输入，也须先关闭回显前的捕获窗口。
      notify(true);
      if (alive && version === inputVersion && waiting) {
        if (kind === "text") {
          source.props ??= {};
          source.props[TEXT_DEFAULT_STATE] = state.enabled;
        }
        publish(parsed.value);
      }
    },
    echo(value: unknown) {
      if (!alive) return;
      if (waiting && matches(expected, value)) {
        committed = expected;
        waiting = false;
        notify(false);
      } else if (!matches(committed, value) && !Object.is(committed, value)) {
        if (dirty) conflict = true;
        else {
          committed = value;
          state.raw = value == null ? "" : String(value);
        }
        notify(false);
      }
    },
    composition(start: boolean) {
      if (!alive) return;
      state.composing = start;
      state.settling = !start;
      notify(true);
    },
    settled() {
      if (alive) {
        state.settling = false;
        notify(false);
      }
    },
    blocker(): FormDesignerBlocker | null {
      if (!alive) return null;
      const field = state.field;
      if (!field) return { code: "unknown-owner", message: "默认值尚未绑定字段生命期" };
      if (state.popupOpen)
        return { code: "pending-update", field, message: "请先确认或关闭日期弹层" };
      if (state.composing || state.settling)
        return { code: "composing", field, message: "输入法组合尚未确认" };
      if (conflict || (dirty && !state.supported))
        return {
          code: "unsupported-input",
          field,
          message: "当前日期格式或外部替换无法安全确认，请保留输入并明确处理",
        };
      if (
        dirty &&
        state.supported &&
        parseRaw(state.raw, kind).valid &&
        !matches(
          kind === "text" && !state.enabled ? undefined : parseRaw(state.raw, kind).value,
          source.value,
        )
      )
        return {
          code: "pending-update",
          field,
          message: "默认值尚未进入原规则，请在当前字段重新确认",
        };
      if (waiting) return { code: "pending-update", field, message: "等待默认值公开回显" };
      if (dirty && !parseRaw(state.raw, kind).valid)
        return { code: "pending-input", field, message: "默认值尚未完成，请补全数值或有效日期" };
      return null;
    },
    release() {
      alive = false;
      stop();
    },
  });
  const stop = watch(
    () => source.value,
    () => notify(false),
    { flush: "post" },
  );
  return state;
}
/** source是公开componentRule的活对象token；导出副本与field字符串都不签发生命期。 */
export function createEditorInputState(notify: (edited: boolean) => void) {
  const bindings = new Map<Source, DefaultInputBinding>();
  return {
    bind(source: Source): DefaultInputBinding {
      let binding = bindings.get(source);
      if (!binding) {
        binding = createBinding(source, notify);
        bindings.set(source, binding);
      }
      return binding;
    },
    release(source: Source) {
      const visit = (node: Source) => {
        bindings.get(node)?.release();
        bindings.delete(node);
        node.children?.forEach((child) => {
          if (child && typeof child === "object") visit(child);
        });
      };
      visit(source);
      notify(true);
    },
    clear() {
      for (const binding of bindings.values()) binding.release();
      bindings.clear();
    },
    blockers(): FormDesignerBlocker[] {
      return [...bindings.values()].flatMap((b) => {
        const issue = b.blocker();
        return issue ? [issue] : [];
      });
    },
  };
}

let instanceSerial = 0;
/** 仅分隔编辑/DOM生命期，不作安全凭证；普通HTTP宿主不要求randomUUID可用。 */
export function createEditorInstanceKey(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    /* 受限宿主的crypto实现可能拒绝调用，仍可使用本地实例序号。 */
  }
  return `fd-${Date.now().toString(36)}-${++instanceSerial}-${Math.random().toString(36).slice(2)}`;
}
