import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * 库模式构建：vue / element-plus / @flowduet/core / @vue-flow/core 全部外置，
 * 由宿主安装（playground 与集成方同时装齐四件）。
 */
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      // 与 package.json exports 对齐（缺省会按包名生成 designer.js）
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["vue", "element-plus", "@flowduet/core", "@vue-flow/core"],
    },
  },
});
