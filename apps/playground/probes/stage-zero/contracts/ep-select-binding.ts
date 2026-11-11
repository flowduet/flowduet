import { ElSelect, ElOption } from "element-plus";
import type { PropType } from "vue";

// EP 2.14.6少数属性的validator显式含undefined，在exactOptionalPropertyTypes下
// 无法匹配Vue Prop，导致$props泄漏运行时描述对象。仅还原这些属性声明的值类型，
// 不改组件、校验器、required/可选性和其他属性，不把整套props放宽成未知值。
type EpValue<T> = T extends { __epPropKey: true; type: PropType<infer V> } ? V : T;
type Bound<C extends abstract new (...args: never[]) => { $props: object }> = Omit<C, never> &
  (new () => Omit<InstanceType<C>, "$props"> & {
    $props: { [K in keyof InstanceType<C>["$props"]]: EpValue<InstanceType<C>["$props"][K]> };
  });

export const ProbeSelect = ElSelect as unknown as Bound<typeof ElSelect>;
export const ProbeOption = ElOption as unknown as Bound<typeof ElOption>;
