import type { ProbeSelect, ProbeOption } from "./ep-select-binding";
type SelectProps = InstanceType<typeof ProbeSelect>["$props"];
type OptionProps = InstanceType<typeof ProbeOption>["$props"];
const placeholder: SelectProps["placeholder"] = "真实下拉";
const label: OptionProps["label"] = "研发";
const value: OptionProps["value"] = "dev";
// @ts-expect-error 非文本placeholder仍需拒绝。
const invalidPlaceholder: SelectProps["placeholder"] = 123;
// @ts-expect-error Symbol不是合法选项值。
const invalidOption: OptionProps["value"] = Symbol();
// @ts-expect-error Symbol不是合法modelValue。
const invalidModel: SelectProps["modelValue"] = Symbol();
void [invalidModel, placeholder, label, value, invalidPlaceholder, invalidOption];
