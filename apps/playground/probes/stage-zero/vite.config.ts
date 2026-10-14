import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: Object.fromEntries(
      ["core", "designer", "form-create"].map((name) => [
        `@flowduet/${name}`,
        fileURLToPath(new URL(`../../../../packages/${name}/src/index.ts`, import.meta.url)),
      ]),
    ),
  },
  server: { host: "127.0.0.1", headers: { "Cache-Control": "no-store" } },
});
