import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

/**
 * 组件冒烟环境：happy-dom + SFC 编译。
 * @flowduet/core 指向源码——CI 的 test 阶段先于 build，dist 可能不在场。
 */
export default defineConfig({
  plugins: [vue()],
  environment: "happy-dom",
  resolve: {
    alias: {
      "@flowduet/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
});
