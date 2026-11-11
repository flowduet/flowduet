import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    // 禁浏览器缓存 dev 模块：反复重启/重建期间模块若被缓存，
    // reload 依旧渲染旧 UI（#40 实测），no-store 让刷新即取新
    headers: { "Cache-Control": "no-store" },
  },
});
