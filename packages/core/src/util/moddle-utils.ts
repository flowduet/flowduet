import type { ModdleElement } from "bpmn-moddle";

/**
 * 向 moddle 的数组属性追加元素。
 * moddle 未初始化的数组属性读取为 undefined，必须"无则建、有则推"，
 * 直接 push 会静默丢数据。
 */
export function pushMany(
  element: ModdleElement,
  prop: string,
  value: ModdleElement | string,
): void {
  const current = element.get(prop) as Array<ModdleElement | string> | undefined;
  if (current === undefined) {
    element.set(prop, [value]);
  } else {
    current.push(value);
  }
}
