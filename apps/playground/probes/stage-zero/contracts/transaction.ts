import type { FlowDesignState } from "@flowduet/form-create";
import { failure, type EditResult } from "./types";

/** 仅为已核验的属性/表单提交保存撤销记录；不拦截或伪造core私有结构登记表。 */
export function commitAtomicProperties(
  state: FlowDesignState,
  action: () => void,
): EditResult<void> {
  const journal = new Map<object, PropertyDescriptorMap>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object" || journal.has(value)) return;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    journal.set(value, descriptors);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === "$model" || key === "$descriptor" || key === "$parent") continue;
      if ("value" in descriptor) visit(descriptor.value);
    }
  }
  visit(state);
  visit(state.model.definitions);
  try {
    action();
    return { ok: true, value: undefined };
  } catch (error) {
    for (const [object, descriptors] of [...journal].reverse()) {
      for (const key of Object.getOwnPropertyNames(object))
        if (!(key in descriptors)) Reflect.deleteProperty(object, key);
      Object.defineProperties(object, descriptors);
    }
    return failure("commit-failed", error instanceof Error ? error.message : String(error));
  }
}
