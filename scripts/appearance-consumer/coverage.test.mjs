/* global structuredClone */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { test } from "node:test";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../../", import.meta.url));
const typecheck = join(root, "scripts/appearance-consumer/template/verify-types.mjs");

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "flowduet-coverage-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "src"));
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), "dir");
  await writeFile(join(directory, "src/main.ts"), "export const ready = true;");
  await writeFile(join(directory, "src/env.d.ts"), "export {};");
  await writeFile(
    join(directory, "src/release-contracts.ts"),
    "export const version: string = 'ok';",
  );
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [], target: "ES2022" },
      include: ["src/main.ts", "src/env.d.ts"],
    }),
  );
  return directory;
}

test("类型命令拒绝未进入编译程序的必验合同，并报告该文件", async (t) => {
  const cwd = await fixture(t);
  const result = spawnSync(process.execPath, [typecheck], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  const report = JSON.parse(await readFile(join(cwd, "type-verification.json"), "utf8"));
  assert.equal(report.passed, false);
  assert.deepEqual(report.missingFiles, ["src/release-contracts.ts"]);
});

test("维护中的模板纳入全部必验入口，合同类型错误仍使命令失败", async (t) => {
  const cwd = await fixture(t);
  const config = JSON.parse(
    await readFile(join(root, "scripts/appearance-consumer/template/tsconfig.json"), "utf8"),
  );
  config.compilerOptions.types = [];
  await writeFile(join(cwd, "tsconfig.json"), JSON.stringify(config));
  let result = spawnSync(process.execPath, [typecheck], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  await writeFile(join(cwd, "src/release-contracts.ts"), "export const version: string = 1;");
  result = spawnSync(process.execPath, [typecheck], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  const report = JSON.parse(await readFile(join(cwd, "type-verification.json"), "utf8"));
  assert.equal(report.passed, false);
  assert.equal(report.compilerExitCode, 2);
  assert.deepEqual(report.missingFiles, []);
});

const runtime = join(root, "scripts/appearance-consumer/verify-runtime-coverage.mjs");
const caseIds = [
  "external-control",
  "capture-reentrancy",
  "field-lifetime",
  "designer-mode",
  "late-header-close",
  "late-confirm-close",
  "manager-mode",
];
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function runtimeFixture(t) {
  const cwd = await fixture(t);
  const tarballs = [];
  for (const name of ["core", "designer", "form-create"]) {
    const path = join(cwd, `${name}.tgz`);
    await writeFile(path, name);
    tarballs.push({ package: `@flowduet/${name}`, path, sha256: hash(name) });
  }
  const path = join(cwd, "contracts.html");
  await writeFile(path, "fixture");
  const manifest = JSON.stringify({
    tarballs,
    buildArtifacts: [{ path, servedPath: "contracts.html", sha256: hash("fixture") }],
  });
  await writeFile(join(cwd, "verification.json"), manifest);
  return {
    cwd,
    receipt: {
      artifactId: hash(manifest),
      errors: [],
      failures: [],
      checks: caseIds.map((id) => ({ id, status: "passed", evidence: { observed: true } })),
    },
  };
}

async function runRuntime(cwd, receipt, risks) {
  await writeFile(join(cwd, "receipt.json"), JSON.stringify(receipt));
  const args = [
    runtime,
    join(cwd, "verification.json"),
    join(cwd, "receipt.json"),
    join(cwd, "summary.json"),
  ];
  if (risks) {
    await writeFile(join(cwd, "risks.json"), JSON.stringify(risks));
    args.push(join(cwd, "risks.json"));
  }
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  const report = JSON.parse(await readFile(join(cwd, "summary.json"), "utf8"));
  return { result, report };
}

test("运行汇总拒绝缺失的必验项，即使其他回执均通过", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  receipt.checks.pop();
  const { result, report } = await runRuntime(cwd, receipt);
  assert.equal(result.status, 1);
  assert.equal(report.complete, false);
  assert.equal(report.checks.find((c) => c.id === "manager-mode").status, "not-executed");
});

test("运行回执必须唯一、具备结果和证据，不能用成功数组掩盖错误", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  for (const mutate of [
    (r) => r.checks.push(r.checks[0]),
    (r) => delete r.checks[0].status,
    (r) => delete r.checks[0].evidence,
    (r) => (r.checks[0].status = "failed"),
    (r) => (r.checks[0].status = "not-executed"),
    (r) => r.checks.push({ id: "appearance-matrix", status: "passed", evidence: {} }),
    (r) => r.errors.push("浏览器未捕获异常"),
    (r) => r.failures.push("断言失败"),
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    const { result, report } = await runRuntime(cwd, changed);
    assert.equal(result.status, 1);
    assert.equal(report.complete, false);
  }
  const { result, report } = await runRuntime(cwd, receipt);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.complete, true);
});

test("已接受风险只覆盖指定失败项，缺执行和其他失败仍阻止完成", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  receipt.checks[0].status = "failed";
  receipt.checks[0].error = "已观察到的反例";
  const risks = [
    {
      id: "external-control",
      artifactId: receipt.artifactId,
      reason: "维护者接受这一反例",
      authorization: "测试用批准来源",
    },
  ];
  let run = await runRuntime(cwd, receipt, risks);
  assert.equal(run.result.status, 0);
  assert.equal(run.report.complete, true);
  assert.equal(run.report.passed, false);
  assert.equal(run.report.checks[0].status, "accepted-risk");
  receipt.checks[1].status = "failed";
  run = await runRuntime(cwd, receipt, risks);
  assert.equal(run.result.status, 1);
  receipt.checks[1].status = "passed";
  receipt.checks.shift();
  run = await runRuntime(cwd, receipt, risks);
  assert.equal(run.result.status, 1);
  receipt.checks.unshift({ id: "external-control", status: "failed", error: "反例" });
  run = await runRuntime(cwd, receipt, [
    { id: "external-control", reason: "理由", authorization: "" },
  ]);
  assert.equal(run.result.status, 1);
});

test("运行回执绑定本次三包及构建字节，不能复用旧回执或篡改产物", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  const changed = structuredClone(receipt);
  changed.artifactId = "旧产物";
  let run = await runRuntime(cwd, changed);
  assert.equal(run.result.status, 1);
  await writeFile(join(cwd, "core.tgz"), "changed");
  run = await runRuntime(cwd, receipt);
  assert.equal(run.result.status, 1);
  await writeFile(join(cwd, "core.tgz"), "core");
  await writeFile(join(cwd, "contracts.html"), "changed");
  run = await runRuntime(cwd, receipt);
  assert.equal(run.result.status, 1);
});

test("损坏或缺失的回执会覆盖旧成功汇总，不遗留可误读的通过结果", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  await runRuntime(cwd, receipt);
  await writeFile(join(cwd, "receipt.json"), "{");
  let result = spawnSync(
    process.execPath,
    [runtime, join(cwd, "verification.json"), join(cwd, "receipt.json"), join(cwd, "summary.json")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  let report = JSON.parse(await readFile(join(cwd, "summary.json"), "utf8"));
  assert.equal(report.complete, false);
  await rm(join(cwd, "receipt.json"));
  result = spawnSync(
    process.execPath,
    [runtime, join(cwd, "verification.json"), join(cwd, "receipt.json"), join(cwd, "summary.json")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  report = JSON.parse(await readFile(join(cwd, "summary.json"), "utf8"));
  assert.equal(report.complete, false);
});

test("风险授权不能沿用到另一批产物", async (t) => {
  const { cwd, receipt } = await runtimeFixture(t);
  receipt.checks[0].status = "failed";
  receipt.checks[0].error = "反例";
  const run = await runRuntime(cwd, receipt, [
    {
      id: "external-control",
      reason: "接受",
      authorization: "明确批准来源",
      artifactId: "另一批产物",
    },
  ]);
  assert.equal(run.result.status, 1);
});

test(
  "浏览器拒绝预检后被服务替换的实际响应字节",
  {
    skip: !process.env.FLOWDUET_PLAYWRIGHT_DRIVER || !process.env.FLOWDUET_CHROMIUM_PATH,
    timeout: 30000,
  },
  async (t) => {
    const { cwd } = await runtimeFixture(t);
    let requests = 0;
    const server = createServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end(++requests === 1 ? "fixture" : "changed");
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const child = spawn(
      process.execPath,
      [
        join(root, "scripts/verify-consumer-contracts.mjs"),
        process.env.FLOWDUET_PLAYWRIGHT_DRIVER,
        `http://127.0.0.1:${server.address().port}/`,
        join(cwd, "verification.json"),
        join(cwd, "browser-output"),
      ],
      { env: process.env, stdio: "ignore" },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill();
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 1);
    const report = JSON.parse(await readFile(join(cwd, "browser-output/result.json"), "utf8"));
    const summary = JSON.parse(await readFile(join(cwd, "browser-output/coverage.json"), "utf8"));
    assert.ok(report.errors.some((error) => error.includes("浏览器产物不匹配")));
    assert.equal(summary.complete, false);
    assert.equal(requests, 2);
  },
);
