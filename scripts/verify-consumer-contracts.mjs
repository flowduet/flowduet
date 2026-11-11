/* global window, document, MouseEvent, fetch, AbortSignal */
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { URL, pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { requiredRuntime } from "./appearance-consumer/required-runtime.mjs";
import { verifyArtifacts, sha256 } from "./appearance-consumer/artifacts.mjs";

const [driverPath, inputUrl, verificationPath, outputDir] = process.argv.slice(2);
if (!driverPath || !inputUrl || !verificationPath || !outputDir || process.argv.length !== 6)
  throw new Error("需要 Playwright 驱动、预览根 URL、verification.json 和输出目录");
const executablePath = process.env.FLOWDUET_CHROMIUM_PATH;
if (!executablePath) throw new Error("请通过 FLOWDUET_CHROMIUM_PATH 指定 Chromium 可执行文件");
const output = resolve(outputDir);
const baseUrl = inputUrl.endsWith("/") ? inputUrl : `${inputUrl}/`;
await mkdir(output, { recursive: true });
await rm(join(output, "coverage.json"), { force: true });
const report = {
  browser: null,
  artifactId: null,
  errors: [],
  failures: [],
  checks: [],
  browserResources: [],
  driverSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
};
let browser;
let page;
let activeCase = null;
const passed = (id, evidence) => {
  report.checks.push({ id, status: "passed", evidence });
  activeCase = null;
};
try {
  const { verification, artifactId } = await verifyArtifacts(verificationPath);
  report.artifactId = artifactId;
  // 同时核对磁盘产物和服务器返回的字节，防止对着另一台预览服务验收。
  for (const artifact of verification.buildArtifacts) {
    const response = await fetch(new URL(artifact.servedPath, baseUrl), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || sha256(new Uint8Array(await response.arrayBuffer())) !== artifact.sha256)
      throw new Error(`预览产物不匹配：${artifact.servedPath}`);
  }
  const { chromium, selectors } = await import(pathToFileURL(resolve(driverPath)).href);
  selectors.setTestIdAttribute("data-test");
  browser = await chromium.launch({ headless: true, executablePath });
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const expectedResources = new Map(
    verification.buildArtifacts.map((artifact) => [
      new URL(artifact.servedPath, baseUrl).href,
      artifact.sha256,
    ]),
  );
  // 预检之后服务仍可能更新；浏览器只能消费当次清单中核验过的响应字节。
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    try {
      const expected = expectedResources.get(url);
      if (!expected) throw new Error(`浏览器请求不在产物清单中：${url}`);
      const response = await route.fetch({ maxRedirects: 0 });
      const body = await response.body();
      const actual = sha256(body);
      if (!response.ok() || actual !== expected) throw new Error(`浏览器产物不匹配：${url}`);
      const headers = response.headers();
      // body 已解压，由 fulfill 为核验后的原字节重新计算传输长度。
      delete headers["content-encoding"];
      delete headers["content-length"];
      await route.fulfill({ status: response.status(), headers, body });
      report.browserResources.push({ url, sha256: actual });
    } catch (error) {
      report.errors.push(String(error));
      await route.abort().catch(() => {});
    }
  });
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => report.errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });
  const read = () => page.evaluate(() => window.contractHarness.read());
  const command = (name) => page.evaluate((name) => window.contractHarness[name](), name);
  const check = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };
  async function selectAmount(scope) {
    const label = scope
      .locator(".el-form-item__label")
      .filter({ hasText: /^金额$/ })
      .first();
    await label.scrollIntoViewIfNeeded();
    const box = await label.boundingBox();
    check(Boolean(box), "金额字段不可见");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const input = scope.locator('[data-retained-input="number"]').last();
    await input.waitFor({ state: "visible" });
    return input;
  }
  async function readyManager() {
    await page.waitForFunction(
      () => window.contractHarness.read().managerState?.canCapture === true,
    );
  }
  activeCase = "external-control";
  await page.goto(new URL("contracts.html", baseUrl).href);
  await page.locator('[data-contract="external"] [data-entity-id="b"]').waitFor();
  const xml = await page.evaluate(() => window.contractHarness.xml());
  await page.locator('[data-contract="external"] [data-entity-id="b"]').click();
  let state = await read();
  check(
    state.selections.at(-1)?.id === "b" &&
      state.selections.at(-1)?.modelMatches &&
      state.selections.at(-1)?.renderRevision === 7,
    "external选择请求合同错误",
  );
  check(state.actualSelected === "a", "external提前改变受控选择");
  await command("applySelection");
  state = await read();
  check(state.focus?.status === "focused" && state.actualSelected === "b", "external实际聚焦失败");
  check(
    (await page.evaluate(() => document.activeElement?.getAttribute("data-entity-id"))) === "b",
    "DOM焦点没有到达b",
  );
  await page.locator('[data-contract="external"] [data-entity-id="b"]').hover();
  await page.locator('[data-contract="external"] [data-test="node-delete-b"]').click();
  await command("collectExternal");
  state = await read();
  check(
    state.operations.at(-1)?.type === "remove-node" &&
      state.operations.at(-1)?.nodeId === "b" &&
      state.operations.at(-1)?.modelMatches,
    "external结构请求丢失",
  );
  check(
    state.externalCollect === false && state.changes === 0,
    "external收集路径未拒绝或提前写模型",
  );
  check(
    (await page.evaluate(() => window.contractHarness.xml())) === xml,
    "external选择/聚焦/请求改变了模型XML",
  );
  check(
    (await page.locator('[data-test="node-drawer"]:visible').count()) === 0,
    "external错误打开内置抽屉",
  );
  passed("external-control", { name: "external受控选择/真实焦点/结构请求/零模型写入", state });
  activeCase = "capture-reentrancy";
  const probe = page.locator('[data-contract="probe"]');
  let raw = await selectAmount(probe);
  await page.waitForFunction(() => window.contractHarness.read().editorState?.canCapture === true);
  await command("arm");
  await raw.fill("01");
  await command("disarm");
  state = await read();
  check(
    state.reentrant.length > 0 &&
      state.reentrant.every((r) => r.status === "blocked") &&
      state.reentrant.some((r) => r.blockers?.some((b) => b.code === "pending-update")),
    "同步draft-change重入捕获了未回显旧值",
  );
  await page.waitForFunction(() => window.contractHarness.read().editorState?.canCapture === true);
  let capture = await command("capture");
  check(
    capture.status === "captured" &&
      JSON.parse(capture.content.rules)[0].value === 1 &&
      (await raw.inputValue()) === "01",
    "公开回显后捕获/原文不正确",
  );
  passed("capture-reentrancy", { name: "同步捕获重入屏障", reentrant: state.reentrant, capture });
  activeCase = "field-lifetime";
  await raw.fill("-");
  await probe.locator("._fc-m-drag .icon-delete").first().locator("..").hover();
  await probe.locator("._fc-m-drag .icon-delete").first().click();
  await page.waitForFunction(() => window.contractHarness.read().editorState?.canCapture === true);
  capture = await command("capture");
  check(
    capture.status === "captured" && JSON.parse(capture.content.rules).length === 0,
    "删除字段未撤销原文阻断",
  );
  await probe
    .locator("._fc-l-item")
    .filter({ hasText: /^计数器$/ })
    .click();
  await page.waitForFunction(() => window.contractHarness.read().editorState?.canCapture === true);
  capture = await command("capture");
  const newRules = JSON.parse(capture.content.rules);
  check(newRules.length === 1 && newRules[0].field !== "amount", "删除重建字段生命期未更新");
  check(
    (await probe.locator('[data-retained-input="number"]').last().inputValue()) !== "-",
    "新字段继承旧原文",
  );
  passed("field-lifetime", { name: "公开删除/菜单新建不继承旧输入", capture });
  activeCase = "designer-mode";
  await command("switchEditorMode");
  state = await read();
  check(
    state.editorState.blockers.some((b) => b.code === "unsupported-mode") &&
      (await command("capture")).status === "blocked",
    "FormDesigner挂载后模式变化未拒绝",
  );
  passed("designer-mode", { name: "FormDesigner模式固定", state: state.editorState });
  activeCase = "late-header-close";
  await page.getByTestId("form-edit-btn-form_manager").click();
  await readyManager();
  let dialog = page.locator(".el-dialog:visible");
  raw = await selectAmount(dialog);
  await raw.fill("7");
  await raw.press("Tab");
  await readyManager();
  const oldClose = await page.getByTestId("form-manager-close").elementHandle();
  check(await command("managerCommit"), "Manager初次提交失败");
  await command("managerReopen");
  await readyManager();
  dialog = page.locator(".el-dialog:visible").last();
  raw = await selectAmount(dialog);
  await raw.fill("8");
  await raw.press("Tab");
  await readyManager();
  await oldClose.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(100);
  state = await read();
  check(
    state.managerOpen &&
      state.managerUpdates.length === 1 &&
      (await raw.inputValue()) === "8" &&
      (await page.locator(".el-message-box:visible").count()) === 0,
    "旧页头迟到click影响了新会话",
  );
  passed("late-header-close", { name: "旧页头迟到DOM事件不关闭新会话", state: state.managerState });
  activeCase = "late-confirm-close";
  await page.getByTestId("form-manager-close").click();
  await page.locator(".el-message-box:visible").waitFor();
  const oldConfirm = await page
    .locator(".el-message-box:visible")
    .getByRole("button", { name: "放弃并关闭" })
    .elementHandle();
  check(await command("managerCommit"), "确认期间宿主公开提交失败");
  await command("managerReopen");
  await readyManager();
  dialog = page.locator(".el-dialog:visible").last();
  raw = await selectAmount(dialog);
  await raw.fill("9");
  await raw.press("Tab");
  await readyManager();
  // 旧确认已被新会话覆盖；受控派发其迟到DOM事件，模拟此前排队的确认，不冒充可见原生点击。
  await oldConfirm.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(100);
  state = await read();
  check(
    state.managerOpen && state.managerUpdates.length === 2 && (await raw.inputValue()) === "9",
    "旧确认Promise关闭或覆盖了新会话",
  );
  passed("late-confirm-close", {
    name: "旧关闭确认迟到不消费新会话授权",
    state: state.managerState,
  });
  activeCase = "manager-mode";
  await command("managerSwitchMode");
  state = await read();
  check(
    state.managerState.mode === "retained" &&
      state.managerState.blockers.some((b) => b.code === "unsupported-mode") &&
      (await command("managerCommit")) === false &&
      state.managerOpen,
    "retained→legacy模式冲突没有拒绝",
  );
  await command("managerRemountLegacy");
  await page.getByTestId("form-edit-btn-form_manager").click();
  await page.locator(".el-dialog:visible").waitFor();
  await page.waitForTimeout(200);
  check(await command("managerCommit"), "legacy原提交合同失效");
  await command("managerReopen");
  await page.locator(".el-dialog:visible").waitFor();
  await command("managerSwitchMode");
  state = await read();
  check(
    state.managerState.mode === "legacy" &&
      state.managerState.blockers.some((b) => b.code === "unsupported-mode") &&
      (await command("managerCommit")) === false &&
      state.managerOpen,
    "legacy→retained模式冲突绕过旧出口",
  );
  passed("manager-mode", {
    name: "FormManager双向模式变更拒绝，legacy提交保持",
    state: state.managerState,
  });
  await page.screenshot({ path: `${output}/final.png`, fullPage: true });
} catch (error) {
  if (activeCase)
    report.checks.push({ id: activeCase, status: "failed", error: String(error.stack || error) });
  else report.failures.push(String(error.stack || error));
  await page?.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {});
} finally {
  await browser?.close().catch((error) => report.errors.push(String(error)));
  for (const item of requiredRuntime)
    if (!report.checks.some((check) => check.id === item.id))
      report.checks.push({ id: item.id, status: "not-executed" });
  await writeFile(join(output, "result.json"), JSON.stringify(report, null, 2));
}
const summary = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("./appearance-consumer/verify-runtime-coverage.mjs", import.meta.url)),
    verificationPath,
    join(output, "result.json"),
    join(output, "coverage.json"),
  ],
  { stdio: "inherit" },
);
if (summary.error || summary.status !== 0) process.exitCode = 1;
console.log(await readFile(join(output, "coverage.json"), "utf8"));
