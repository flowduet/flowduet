import { createApp } from "vue";
import App from "./App.vue";
import "element-plus/dist/index.css";
// vite 库模式不自动注入样式：宿主经 style.css 子路径显式引入 designer 的 CSS
import "@flowduet/designer/style.css";

createApp(App).mount("#app");
