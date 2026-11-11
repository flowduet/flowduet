import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 消费检查只允许包名解析，禁止源码 alias 或内部深引。
export default defineConfig({
  plugins: [vue()],
  build: { rolldownOptions: { input: { appearance: "index.html", contracts: "contracts.html" } } },
  server: { headers: { "Cache-Control": "no-store" } },
});
