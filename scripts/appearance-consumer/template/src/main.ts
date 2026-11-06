import { createApp } from "vue";
import App from "./App.vue";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "@flowduet/designer/style.css";
import "@flowduet/form-create/style.css";
import {
  DingtalkDesigner,
  resolveComponentAppearance,
  type ComponentAppearance,
  type ResolvedComponentAppearance,
} from "@flowduet/designer";
import { FormPreview, type FormDefinition } from "@flowduet/form-create";

const appearance: ComponentAppearance = { colorSource: "brand", mode: "dark", density: "compact" };
const resolved: ResolvedComponentAppearance | undefined = resolveComponentAppearance(appearance);
const form: FormDefinition = {
  id: "consumer-type-check",
  name: "公开类型检查",
  provider: "form-create/element-plus",
  rules: JSON.stringify([{ type: "input", field: "subject", title: "主题" }]),
  options: "{}",
};
// @ts-expect-error 非法密度必须由公开外观类型拒绝。
const invalid: ComponentAppearance = { mode: "dark", density: "invalid" };
void [DingtalkDesigner, FormPreview, resolved, form, invalid];

createApp(App).mount("#app");
