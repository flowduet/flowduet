import { getCurrentInstance } from "vue";
import type { App, Plugin } from "vue";
import ElementPlus from "element-plus";
import formCreateFactory from "@form-create/element-ui";

/**
 * FormCreate 运行时装配（#72）：@form-create/element-ui 的 install 负责把
 * elm 组件映射注册进实例（input → el-input 等）；同时渲染器按组件名解析
 * element-plus 组件，需要全局注册在场。宿主未做全局安装时组件自行补装
 * （按 app 打标记，幂等；重复安装 element-plus 只覆盖同名注册，无副作用）。
 */

const INSTALL_FLAG = "__flowduetFormCreateInstalled";

export function ensureFormCreateInstalled(): void {
  const app: App | undefined = getCurrentInstance()?.appContext.app;
  if (app === undefined) return;
  const flagged = app as App & { [INSTALL_FLAG]?: boolean };
  if (flagged[INSTALL_FLAG]) return;
  app.use(formCreateFactory as unknown as Plugin);
  app.use(ElementPlus);
  flagged[INSTALL_FLAG] = true;
}
