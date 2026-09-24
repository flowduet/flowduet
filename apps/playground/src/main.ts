import { createApp } from "vue";
import App from "./App.vue";
import "element-plus/dist/index.css";
// vite 库模式不自动注入样式：宿主经 style.css 子路径显式引入 designer 与
// form-create 的 CSS（后者内联了 FormCreate 设计器样式）
import "@flowduet/designer/style.css";
import "@flowduet/form-create/style.css";
// Vue-Flow 画布基础样式（BPMN 只读投影依赖）
import "@vue-flow/core/dist/style.css";

createApp(App).mount("#app");
