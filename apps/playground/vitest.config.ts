import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue()],
  test: { environment: "happy-dom" },
  resolve: {
    alias: {
      "@flowduet/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@flowduet/designer": fileURLToPath(
        new URL("../../packages/designer/src/index.ts", import.meta.url),
      ),
    },
  },
});
