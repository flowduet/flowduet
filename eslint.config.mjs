// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  {
    ignores: ["**/dist/", "**/coverage/", "npm/flowduet/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Vue SFC：vue 解析器承载模板，script 块复用 TS 解析与 TS 规则；
  // 模板规则取 essential（避免与 Prettier 的格式判断打架）
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: "module" },
    },
  },
  ...tseslint.configs.recommended
    .filter((config) => config.rules !== undefined)
    .map((config) => ({
      files: ["**/*.vue"],
      rules: config.rules,
    })),
);
