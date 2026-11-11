/**
 * 构建后处理：把仓库内的 ambient 类型声明打进 dist 并挂到声明链上。
 *
 * 背景：bpmn-moddle 10.x 未随 npm 包发布类型（无 types 字段），仓库用
 * src/types/bpmn-moddle.d.ts 做 ambient 声明。tsc 不会把 .d.ts 输入复制进
 * outDir，也不在生成的入口声明里保留三斜线引用——没有本步骤时，消费者
 * `import type { ModdleElement } from "@flowduet/core"` 会报 TS7016。
 *
 * 处理：
 * 1. src/types/*.d.ts 原样复制到 dist/types/；
 * 2. dist/index.d.ts 头部注入对每个声明文件的三斜线引用（幂等）。
 */
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(pkgRoot, "src", "types");
const distDir = path.join(pkgRoot, "dist");
const entryDts = path.join(distDir, "index.d.ts");

if (!existsSync(srcDir)) {
  console.log("src/types 不存在，跳过 ambient 声明打包");
  process.exit(0);
}

const declFiles = readdirSync(srcDir).filter((f) => f.endsWith(".d.ts"));
if (declFiles.length === 0) {
  console.log("src/types 无 .d.ts，跳过");
  process.exit(0);
}

await mkdir(path.join(distDir, "types"), { recursive: true });
for (const f of declFiles) {
  await cp(path.join(srcDir, f), path.join(distDir, "types", f));
}

let content = await readFile(entryDts, "utf8");
const refs = declFiles.map((f) => `/// <reference path="./types/${f}" />`).join("\n");
if (!content.includes(refs)) {
  // 三斜线指令必须在文件顶部（任何语句之前），置于注释块之前亦合法；幂等：已存在则不重复
  content = `${refs}\n${content}`;
  await writeFile(entryDts, content);
}
console.log(`✓ ambient 声明已打包：${declFiles.join(", ")}`);
