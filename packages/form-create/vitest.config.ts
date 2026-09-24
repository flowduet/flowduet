import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

/**
 * 环境说明同 designer：@flowduet/designer 公开入口携带 Vue 组件（草稿扫描器
 * 与组件同一出口），文档/会话测试经它导入，故需 SFC 编译与 happy-dom。
 * core / designer 指向源码——CI 的 test 阶段先于 build，dist 可能不在场。
 */
export default defineConfig({
  plugins: [vue()],
  test: { environment: "happy-dom" },
  resolve: {
    alias: {
      "@flowduet/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@flowduet/designer": fileURLToPath(new URL("../designer/src/index.ts", import.meta.url)),
    },
  },
});
