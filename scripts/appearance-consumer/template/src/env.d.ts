/// <reference types="vite/client" />

// 与既有公开包消费先例一致：tsc 校验公开 TS 类型入口；SFC 由 Vite 编译并交给 Chromium 实测。
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
