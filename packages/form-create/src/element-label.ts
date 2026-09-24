import type { ModdleElement } from "@flowduet/core";

/** 错误信息中的流程元素名称统一带 ID，避免同名节点无法定位。 */
export function elementLabel(element: ModdleElement): string {
  const id = String(element.get("id") ?? "");
  const name = String(element.get("name") ?? "").trim();
  return name !== "" && name !== id ? `${name}（${id}）` : id;
}
