import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { buildArtifacts } from "./appearance-consumer/artifacts.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const templateDir = join(repoRoot, "scripts", "appearance-consumer", "template");
const sceneDir = join(repoRoot, "apps", "playground", "src");
const registry = process.env.FLOWDUET_NPM_REGISTRY ?? "https://registry.npmmirror.com";
const skipBuild = process.argv.slice(2).includes("--skip-build");
const unknownArgs = process.argv.slice(2).filter((argument) => argument !== "--skip-build");
if (unknownArgs.length > 0) throw new Error(`未知参数：${unknownArgs.join("、")}`);

const commands = [];

async function run(command, args, cwd) {
  const display = [command, ...args].join(" ");
  console.log(`\n$ ${display}`);
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    process.stderr.write(chunk);
  });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
  commands.push({ command, args, cwd, exitCode });
  if (exitCode !== 0) {
    throw new Error(`${display} 失败（退出码 ${exitCode}）\n${stderr || stdout}`);
  }
  return { stdout, stderr };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function findElementPlusCopies(nodeModules) {
  const copies = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const path = join(directory, entry.name);
      if (entry.name === "element-plus" && basename(dirname(path)) === "node_modules") {
        const manifest = join(path, "package.json");
        try {
          copies.push(await realpath(manifest));
        } catch {
          // 目录存在但没有公开 package.json 时不是可消费的 EP 副本。
        }
        continue;
      }
      await walk(path);
    }
  }
  await walk(nodeModules);
  return copies.sort();
}

if (skipBuild) console.log("按参数跳过构建；三包 dist 必须由当前工作区先行构建。");
else await run("pnpm", ["build"], repoRoot);

const temporaryRoot = await realpath(await mkdtemp(join(tmpdir(), "flowduet-appearance-108-")));
const packDir = join(temporaryRoot, "packs");
const consumerDir = join(temporaryRoot, "consumer");
await mkdir(packDir);
await mkdir(consumerDir);

const packages = [
  { name: "@flowduet/core", tarballPrefix: "flowduet-core-" },
  { name: "@flowduet/designer", tarballPrefix: "flowduet-designer-" },
  { name: "@flowduet/form-create", tarballPrefix: "flowduet-form-create-" },
];
for (const packageInfo of packages) {
  await run(
    "pnpm",
    ["--filter", packageInfo.name, "pack", "--pack-destination", packDir],
    repoRoot,
  );
}

const packedFiles = await readdir(packDir);
const tarballs = [];
for (const packageInfo of packages) {
  const matches = packedFiles.filter(
    (file) => file.startsWith(packageInfo.tarballPrefix) && file.endsWith(".tgz"),
  );
  if (matches.length !== 1)
    throw new Error(`${packageInfo.name} 应有唯一 tarball，实际：${matches.join("、") || "无"}`);
  const path = join(packDir, matches[0]);
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  tarballs.push({ package: packageInfo.name, file: matches[0], path, sha256 });
}

await cp(templateDir, consumerDir, { recursive: true });
const consumerSceneDir = join(consumerDir, "src", "scenes");
await mkdir(consumerSceneDir);
for (const file of [
  "AppearanceConsumptionScene.vue",
  "NodeAppearanceScene.vue",
  "FormPreviewAppearanceScene.vue",
  "useAppearanceHostMode.ts",
]) {
  await cp(join(sceneDir, file), join(consumerSceneDir, file));
}

await run(
  "npm",
  [
    "install",
    `--registry=${registry}`,
    "--no-audit",
    "--no-fund",
    ...tarballs.map((tarball) => tarball.path),
  ],
  consumerDir,
);
const dependencyTree = await run(
  "npm",
  ["ls", "--all", "element-plus", "@form-create/element-ui", "@form-create/designer", "vue"],
  consumerDir,
);
await writeFile(join(temporaryRoot, "npm-ls.txt"), dependencyTree.stdout);

const elementPlusCopies = await findElementPlusCopies(join(consumerDir, "node_modules"));
if (elementPlusCopies.length !== 1)
  throw new Error(
    `EP 物理副本应为 1，实际 ${elementPlusCopies.length}：${elementPlusCopies.join("、")}`,
  );
const elementPlus = await readJson(elementPlusCopies[0]);
if (elementPlus.version !== "2.14.6")
  throw new Error(`EP 应为 2.14.6，实际 ${elementPlus.version}`);
const renderer = await readJson(
  join(consumerDir, "node_modules", "@form-create", "element-ui", "package.json"),
);
if (renderer.version !== "3.3.4")
  throw new Error(`FormCreate renderer 应为 3.3.4，实际 ${renderer.version}`);
const vue = await readJson(join(consumerDir, "node_modules", "vue", "package.json"));

await run("npm", ["run", "typecheck"], consumerDir);
await run("npm", ["run", "build"], consumerDir);
const typeCoverage = await readJson(join(consumerDir, "type-verification.json"));
if (!typeCoverage.passed) throw new Error("公开类型合同缺少实际编译覆盖");

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  registry,
  temporaryRoot,
  consumerDir,
  typeCoverage,
  buildArtifacts: await buildArtifacts(join(consumerDir, "dist")),
  tarballs: tarballs.map(({ path, ...tarball }) => ({ ...tarball, path })),
  dependencies: {
    elementPlus: elementPlus.version,
    elementPlusCopies,
    renderer: renderer.version,
    vue: vue.version,
  },
  checks: {
    actualTarballInstall: true,
    strictTypeScript: true,
    productionBuild: true,
    sourceAlias: false,
    browserRender: "待对 consumerDir 执行 Chromium 检查；本脚本不把构建当作渲染证据",
  },
  commands,
};
await writeFile(join(temporaryRoot, "verification.json"), JSON.stringify(report, null, 2));
console.log(
  `\n${JSON.stringify(
    {
      result: "静态安装包消费检查通过；浏览器渲染尚待单独验证",
      temporaryRoot,
      consumerDir,
      elementPlus: elementPlus.version,
      elementPlusCopies: elementPlusCopies.length,
      renderer: renderer.version,
      vue: vue.version,
      next: `cd ${consumerDir} && npm run preview -- --port 4174`,
    },
    null,
    2,
  )}`,
);
