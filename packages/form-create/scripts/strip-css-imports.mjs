/**
 * 构建后处理：从产物 d.ts 中剥离 CSS 副作用 import。
 *
 * 背景：src/index.ts 里 `import "@form-create/designer/src/style/index.css"`
 * 在 vite 库构建时被抽离合并进 dist/form-create.css（宿主经
 * `import "@flowduet/form-create/style.css"` 显式引入），但 vue-tsc 生成的
 * d.ts 会保留这行 import——消费者 tsc 顺着声明链解析时既无该子路径的
 * 类型也无对应模块，报 TS2882。运行时产物不含它，声明层属残留，剥除。
 *
 * 递归扫描 dist 下全部 .d.ts（组件子目录同样可能携带），幂等。
 * 本脚本设计为紧跟 build 执行：dist 不存在时直接报错退出，而不是静默
 * 跳过——避免「构建失败但剥离成功」的假绿。
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(pkgRoot, "dist");

if (!existsSync(distDir)) {
  console.error("✗ dist 不存在：本脚本须在 vite build / vue-tsc 之后执行");
  process.exit(1);
}

// 匹配任何以 .css 结尾的副作用 import（当前只有 form-create 设计器样式一处）
const cssSideEffectImport = /^\s*import\s+["'][^"']+\.css["'];?\s*$/;

let touched = 0;
async function strip(file) {
  let content = await readFile(file, "utf8");
  const lines = content.split("\n");
  const kept = lines.filter((line) => {
    if (cssSideEffectImport.test(line)) {
      touched += 1;
      return false;
    }
    return true;
  });
  if (kept.length !== lines.length) {
    await writeFile(file, kept.join("\n"));
  }
}

async function collectDts(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectDts(full)));
    } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

for (const file of await collectDts(distDir)) {
  await strip(file);
}
console.log(
  touched === 0
    ? "d.ts 无 CSS 副作用 import，无需处理"
    : `✓ 已剥离 ${touched} 行 CSS 副作用 import`,
);
