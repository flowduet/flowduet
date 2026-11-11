import { spawnSync } from "node:child_process";
import { writeFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

// 文件存在不代表参与编译；核对同一次 tsc 检查实际加载的文件。
const requiredFiles = ["src/main.ts", "src/env.d.ts", "src/release-contracts.ts"];
const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/lib/tsc.js"),
    "-p",
    "tsconfig.json",
    "--listFiles",
    "--pretty",
    "false",
  ],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
await writeFile("typecheck-files.txt", output);
const loadedFiles = new Set();
for (const line of output.split(/\r?\n/)) {
  if (!line.trim()) continue;
  try {
    loadedFiles.add(await realpath(line));
  } catch {
    // 类型诊断行不是文件路径，仍保留在原始编译输出中。
  }
}
const missingFiles = [];
for (const file of requiredFiles) {
  try {
    if (!loadedFiles.has(await realpath(file))) missingFiles.push(file);
  } catch {
    missingFiles.push(file);
  }
}
const passed = result.status === 0 && !result.error && missingFiles.length === 0;
const report = {
  passed,
  compilerExitCode: result.status,
  compilerError: result.error?.message ?? null,
  requiredFiles,
  missingFiles,
  loadedFiles: [...loadedFiles].sort(),
};
await writeFile("type-verification.json", JSON.stringify(report, null, 2));
if (!passed) {
  console.error(output);
  console.error(`公开类型合同未通过；未参与编译：${missingFiles.join("、") || "无"}`);
  process.exitCode = 1;
} else console.log(`公开类型合同通过；必验入口 ${requiredFiles.length} 个均参与编译。`);
