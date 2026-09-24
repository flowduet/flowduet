import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * 库模式构建：vue / element-plus / @flowduet/* / @form-create/* 全部外置——
 * @form-create 两包是 dependencies（随包安装），element-plus 是 peer 由宿主提供
 * （playground 与集成方同时装齐）。
 */
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [
        "vue",
        "element-plus",
        "@flowduet/core",
        "@flowduet/designer",
        "@form-create/designer",
        "@form-create/element-ui",
      ],
    },
  },
});
