/* global document, Event, getComputedStyle, navigator */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [driverPath, baseUrl, outputDir] = process.argv.slice(2);
if (!driverPath || !baseUrl || !outputDir)
  throw new Error("需要 Playwright 驱动、页面 URL 和输出目录参数");
const executablePath = process.env.FLOWDUET_CHROMIUM_PATH;
if (!executablePath) throw new Error("请通过 FLOWDUET_CHROMIUM_PATH 指定 Chromium 可执行文件");

const { chromium } = await import(pathToFileURL(resolve(driverPath)).href);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
const warnings = [];
const failures = [];
const results = {};
page.on("pageerror", (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
  if (message.type() === "warning") warnings.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function setCheckbox(test, checked) {
  await page.locator(`[data-test="${test}"]`).evaluate((input, nextChecked) => {
    if (input.checked !== nextChecked) {
      input.checked = nextChecked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, checked);
  await page.waitForTimeout(400);
}

async function visibleDrawers() {
  return page.locator('[data-test="node-drawer"]:visible').count();
}

async function drawerStates() {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-test="appearance-first-designer"], [data-test="appearance-second-designer"]',
      ),
    ].map((root) => {
      const drawer = root.querySelector('[data-test="node-drawer"]');
      if (!drawer) return { owner: root.getAttribute("data-test"), drawer: null };
      const rect = drawer.getBoundingClientRect();
      const style = getComputedStyle(drawer);
      return {
        owner: root.getAttribute("data-test"),
        drawer: drawer.className,
        inlineStyle: drawer.getAttribute("style"),
        rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    }),
  );
}

async function openEntity(designerTest, entity) {
  const card = page.locator(`[data-test="${designerTest}"] [data-entity-id="${entity}"]`);
  await card.evaluate((element) => {
    element.focus();
    element.click();
  });
  await page.waitForTimeout(400);
}

try {
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const playgroundEntry = page.locator('[data-test="appearance-scene-btn"]');
  if ((await playgroundEntry.count()) > 0) await playgroundEntry.click();
  await page.locator('[data-test="appearance-consumption-scene"]').waitFor({ state: "visible" });
  await page.locator('[data-test="appearance-scene"]').waitFor({ state: "visible" });
  await page.locator('[data-test="form-appearance-scene"]').waitFor({ state: "visible" });
  results.publicEntries = {
    nodeDesigners: await page.locator('[data-test^="appearance-"][data-test$="-designer"]').count(),
    formPreviews: await page.locator('[data-test="form-preview"]').count(),
    hostControls: await page.locator('[data-test="form-appearance-host-control"]').count(),
  };
  check(results.publicEntries.nodeDesigners === 2, "公开节点双实例未同时挂载");
  check(results.publicEntries.formPreviews === 2, "公开预览双实例未同时挂载");

  await setCheckbox("appearance-first-enabled", false);
  await openEntity("appearance-first-designer", "approval");
  const legacyDrawer = page.locator(
    '[data-test="appearance-first-designer"] [data-test="node-drawer"]',
  );
  const legacyNode = await legacyDrawer.evaluate((drawer) => {
    const input = drawer.querySelector('[data-test="drawer-name"]');
    const save = drawer.querySelector('[data-test="drawer-save"]');
    return {
      className: drawer.className,
      inlineStyle: drawer.getAttribute("style"),
      inputHeight: input.closest(".el-input").getBoundingClientRect().height,
      saveHeight: save.getBoundingClientRect().height,
    };
  });
  check(!legacyNode.className.includes("flowduet-appearance"), "旧抽屉仍启用新外观类");
  check(!legacyNode.inlineStyle.includes("--fd-"), "旧抽屉仍写入新外观变量");
  check(legacyNode.inputHeight === 32 && legacyNode.saveHeight === 32, "旧抽屉默认尺寸变化");
  await legacyDrawer.locator('[data-test="drawer-cancel"]').click();
  await legacyDrawer.waitFor({ state: "hidden" });
  await setCheckbox("appearance-first-enabled", true);

  await setCheckbox("form-appearance-first-enabled", false);
  const legacyForm = await page
    .locator('[data-test="form-appearance-first-instance"] [data-test="form-preview"]')
    .evaluate((root) => ({
      className: root.className,
      inlineStyle: root.getAttribute("style") ?? "",
      validateHeight: root
        .querySelector('[data-test="form-preview-validate"]')
        .getBoundingClientRect().height,
    }));
  check(!legacyForm.className.includes("flowduet-appearance"), "旧预览仍启用新外观类");
  check(!legacyForm.inlineStyle.includes("--fd-"), "旧预览仍写入新外观变量");
  check(legacyForm.validateHeight === 24, "旧预览自有按钮不再固定 small");
  await setCheckbox("form-appearance-first-enabled", true);
  results.legacyBaseline = { node: legacyNode, form: legacyForm };

  await openEntity("appearance-first-designer", "approval");
  const retainedInput = page.locator(
    '[data-test="appearance-first-designer"] [data-test="drawer-name"]',
  );
  await retainedInput.fill("真实点击切换保留的未提交输入");
  const densityControl = page.locator('[data-test="appearance-first-density"]');
  await densityControl.click({ timeout: 2500 });
  const densityClickFocused = await densityControl.evaluate(
    (select) => document.activeElement === select,
  );
  check(densityClickFocused, "真实点击未能聚焦抽屉密度控件");
  await densityControl.selectOption("compact");
  check((await densityControl.inputValue()) === "compact", "真实点击未能切换抽屉密度");
  check(
    (await retainedInput.inputValue()) === "真实点击切换保留的未提交输入",
    "真实点击切换外观丢失未提交输入",
  );
  const enabledControl = page.locator('[data-test="appearance-first-enabled"]');
  await enabledControl.click({ timeout: 2500 });
  check(!(await enabledControl.isChecked()), "真实点击未能停用外观");
  await enabledControl.click({ timeout: 2500 });
  check(await enabledControl.isChecked(), "真实点击未能重新启用外观");
  check(
    (await retainedInput.inputValue()) === "真实点击切换保留的未提交输入",
    "真实点击启停外观丢失未提交输入",
  );
  results.realControls = {
    densityClickFocused,
    density: await densityControl.inputValue(),
    retained: true,
  };
  await densityControl.selectOption("comfortable");
  await page.locator('[data-test="appearance-first-designer"] [data-test="drawer-cancel"]').click();
  await page
    .locator('[data-test="appearance-first-designer"] [data-test="node-drawer"]')
    .waitFor({ state: "hidden" });

  const initialHost = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--el-color-primary"),
    hostInput: getComputedStyle(
      document.querySelector('[data-test="appearance-host-input"]').closest(".el-input")
        .firstElementChild,
    ).boxShadow,
  }));
  await setCheckbox("form-appearance-host-dark", true);
  const shared = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    nodeMode: document.querySelector('[data-test="appearance-first-mode"]').value,
    formMode: document.querySelector('[data-test="form-appearance-first-mode"]').value,
    nodeSecondMode: document.querySelector('[data-test="appearance-second-mode"]').value,
    formSecondSource: document.querySelector('[data-test="form-appearance-second-source"]').value,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--el-color-primary"),
    hostInput: getComputedStyle(
      document.querySelector('[data-test="appearance-host-input"]').closest(".el-input")
        .firstElementChild,
    ).boxShadow,
  }));
  check(shared.htmlClass.includes("dark"), "跨场景宿主深色声明未生效");
  check(shared.nodeMode === "dark" && shared.formMode === "dark", "宿主主题未同步到两个入口");
  check(shared.nodeSecondMode === "light", "宿主切换改写了品牌节点实例主题");
  check(shared.formSecondSource === "brand", "宿主切换改写了另一预览实例来源");
  check(shared.primary === initialHost.primary, "组件切换改写了宿主 EP 主色变量");
  results.sharedHostTheme = { before: initialHost, after: shared };

  await setCheckbox("form-appearance-host-dark", false);
  await setCheckbox("appearance-declarative-dark", true);
  check(
    (await page.locator('[data-test="appearance-first-mode"]').inputValue()) === "dark" &&
      (await page.locator('[data-test="form-appearance-first-mode"]').inputValue()) === "dark" &&
      !(await page.evaluate(() => document.documentElement.classList.contains("dark"))),
    "声明式局部深色未同步或被错误提升为全局深色",
  );
  await setCheckbox("appearance-declarative-dark", false);
  results.scopedHostTheme = "通过";

  await openEntity("appearance-first-designer", "approval");
  await openEntity("appearance-second-designer", "approval");
  results.beforeNodeUnmount = await drawerStates();
  check((await visibleDrawers()) === 2, "双抽屉前置条件未达到");
  await setCheckbox("appearance-first-mounted", false);
  const afterNodeUnmount = await page.evaluate(() => ({
    firstChecked: document.querySelector('[data-test="appearance-first-mounted"]').checked,
    firstDesigners: document.querySelectorAll('[data-test="appearance-first-designer"]').length,
    secondDesigners: document.querySelectorAll('[data-test="appearance-second-designer"]').length,
    firstDrawers: document.querySelectorAll(
      '[data-test="appearance-first-designer"] [data-test="node-drawer"]',
    ).length,
    secondDrawers: document.querySelectorAll(
      '[data-test="appearance-second-designer"] [data-test="node-drawer"]',
    ).length,
    visibleDrawers: [...document.querySelectorAll('[data-test="node-drawer"]')].filter(
      (element) => element.getBoundingClientRect().width > 0,
    ).length,
    htmlClass: document.documentElement.className,
  }));
  results.nodeUnmount = { ...afterNodeUnmount, drawerStates: await drawerStates() };
  check(afterNodeUnmount.firstChecked === false, "节点卸载复选框未进入关闭状态");
  check(afterNodeUnmount.firstDesigners === 0, "节点实例一卸载后仍存在");
  check(afterNodeUnmount.firstDrawers === 0, "节点实例一抽屉未随卸载清理");
  check(
    afterNodeUnmount.secondDesigners === 1 && afterNodeUnmount.secondDrawers === 1,
    "节点实例一卸载影响了实例二",
  );
  check(afterNodeUnmount.visibleDrawers === 1, "节点双抽屉卸载后的可见数量不是 1");
  await setCheckbox("appearance-first-mounted", true);
  check(
    (await page.locator('[data-test="appearance-first-designer"]').count()) === 1 &&
      (await page.locator('[data-test="appearance-second-designer"]').count()) === 1,
    "节点实例一重挂影响了双实例结构",
  );
  results.nodeRemount = "通过";

  await setCheckbox("appearance-second-mounted", false);
  await page.locator('[data-test="form-appearance-first-controls"]').click();
  const selectInput = page
    .locator('[data-test="form-appearance-first-instance"] .el-select')
    .first();
  await selectInput.click();
  const selectPanel = page.locator(".el-select__popper.preview-select-panel");
  await selectPanel.waitFor({ state: "visible" });
  const ownerBefore = await selectPanel.getAttribute("class");
  await setCheckbox("form-appearance-first-mounted", false);
  check(
    (await selectPanel.count()) === 0 || !(await selectPanel.isVisible()),
    "预览卸载残留下拉面板",
  );
  check(
    (await page
      .locator('[data-test="form-appearance-second-instance"] [data-test="form-preview"]')
      .count()) === 1,
    "预览实例一卸载影响了实例二",
  );
  await setCheckbox("form-appearance-first-mounted", true);
  check(
    (await page
      .locator('[data-test="form-appearance-first-instance"] [data-test="form-preview"]')
      .count()) === 1,
    "预览实例一无法重挂",
  );
  results.formUnmountRemount = { ownerBefore, cleaned: true, remounted: true };

  await page.screenshot({ path: resolve(outputDir, "dual-entry.png"), fullPage: false });
  const summary = {
    browser: browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    viewport: { width: 1440, height: 1100, deviceScaleFactor: 1, zoom: 1 },
    baseUrl,
    results,
    errors,
    warnings,
    failures,
    limitations: [
      "本脚本核对跨入口公开装配与生命周期；字段、弹层和八组矩阵由同页重跑的分项脚本补充。",
      "未执行真实 OS 中文输入法、Firefox、Safari/WebKit、移动端或完整可访问性认证。",
    ],
  };
  await writeFile(resolve(outputDir, "integration.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ results, errors, warnings, failures }, null, 2));
  if (failures.length > 0 || errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
