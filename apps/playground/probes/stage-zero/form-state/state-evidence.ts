import { rulesSemantics } from "../../../../../packages/form-create/src/form-semantics";
import type { FormContent, LiveState } from "./types";

export function describeValue(rule: Record<string, unknown>) {
  const value = rule.value;
  return {
    present: Object.hasOwn(rule, "value"),
    type: Array.isArray(value) ? "array" : typeof value,
    json: value === undefined ? null : (JSON.stringify(value) ?? null),
  };
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, ordered(child)]),
    );
  return value;
}
function presence(rules: Record<string, unknown>[]): unknown {
  return rules.map((rule) => [
    describeValue(rule),
    Array.isArray(rule.children) ? presence(rule.children as Record<string, unknown>[]) : null,
  ]);
}
export function equivalentContent(a: FormContent, b: FormContent): boolean {
  try {
    const project = (v: FormContent) =>
      ordered([rulesSemantics(v.rules), presence(JSON.parse(v.rules)), JSON.parse(v.options)]);
    return JSON.stringify(project(a)) === JSON.stringify(project(b));
  } catch {
    return false;
  }
}
/** 只读DOM，不触发blur/导出；弹层归属只依据本实例实际声明的aria关联。 */
export function observeLiveState(
  root: HTMLElement,
  busy: { composing: boolean; dragging: boolean },
  owner = "",
): LiveState {
  const doc = root.ownerDocument;
  const related = [...root.querySelectorAll<HTMLElement>("[aria-controls],[aria-owns]")]
    .filter((el) => el.getAttribute("aria-expanded") !== "false")
    .flatMap((el) =>
      `${el.getAttribute("aria-controls") ?? ""} ${el.getAttribute("aria-owns") ?? ""}`
        .split(/\s+/)
        .filter(Boolean),
    );
  const layers = [...new Set(related)]
    .map((id) => doc.getElementById(id))
    .filter((el): el is HTMLElement =>
      Boolean(
        el &&
        el.getAttribute("aria-hidden") !== "true" &&
        el.style.display !== "none" &&
        el.closest('[style*="display: none"]') === null,
      ),
    );
  const active = doc.activeElement;
  const popup = active instanceof Element ? active.closest(".el-popper,[role=dialog]") : null;
  const otherRoots = [...doc.querySelectorAll<HTMLElement>(".form-designer-host")].filter(
    (el) => el !== root,
  );
  const belongsElsewhere = otherRoots.some(
    (el) =>
      el.contains(active) ||
      [...el.querySelectorAll("[aria-controls]")].some((control) =>
        doc.getElementById(control.getAttribute("aria-controls") ?? "")?.contains(active),
      ),
  );
  const controls = [
    ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input,textarea,select",
    ),
    ...layers.flatMap((el) => [
      ...el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input,textarea,select",
      ),
    ]),
  ];
  const rows = [...root.querySelectorAll<HTMLElement>("._fc-r-config .el-form-item")];
  const fieldRow = rows.find((row) =>
    /字段\s*ID/.test(row.querySelector("label")?.textContent ?? ""),
  );
  return {
    selectedField: fieldRow?.querySelector<HTMLInputElement>("input")?.value ?? null,
    configPage:
      root.querySelector<HTMLElement>(".el-tabs__item.is-active")?.textContent?.trim() ?? null,
    pendingControls: [...new Set(controls)].map((el, index) => ({
      path: `${index}:${el.closest(".el-form-item")?.querySelector("label")?.textContent?.trim() ?? el.tagName}`,
      text: el.value,
      selectedOptions:
        el instanceof HTMLSelectElement
          ? [...el.selectedOptions].map((o) => o.value)
          : el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type)
            ? el.checked
              ? [el.value]
              : []
            : [],
      selection:
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el === active &&
        el.selectionStart !== null &&
        el.selectionEnd !== null
          ? [el.selectionStart, el.selectionEnd]
          : null,
    })),
    openLayers: layers.map((_, i) => ({
      path: `popup:${i}`,
      ownerTargetKey: owner,
      confirmed: false,
    })),
    composing: busy.composing,
    dragging: busy.dragging,
    ownerKnown:
      !popup ||
      root.contains(active) ||
      layers.some((el) => el.contains(active)) ||
      belongsElsewhere,
  };
}
