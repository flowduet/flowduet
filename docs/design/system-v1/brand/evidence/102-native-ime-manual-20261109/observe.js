/* global document, window, navigator, location, performance, getComputedStyle, requestAnimationFrame, fetch */

// 一次性人工验收原物：只观察公开 DOM，不注入输入、点击或组合事件。
const config = JSON.parse(document.getElementById("ime-observer-config").textContent);
const rows = [];
const stages = [];
const identities = new WeakMap();
const composingInputs = new Set();
let identity = 0;
let active = null;
let stopped = false;
let sequence = 0;

function find(test) {
  return document.querySelector(`[data-test="${test}"]`);
}

function inputId(input) {
  if (!input) return null;
  if (!identities.has(input)) identities.set(input, ++identity);
  return identities.get(input);
}

function snapshot() {
  const drawer = find("appearance-first-designer")?.querySelector('[data-test="node-drawer"]');
  const name = drawer?.querySelector('[data-test="drawer-name"]');
  const preview = find("form-appearance-first-instance");
  return {
    drawer: {
      inputId: inputId(name),
      name: name?.value,
      visible:
        !!drawer &&
        getComputedStyle(drawer).visibility !== "hidden" &&
        drawer.getBoundingClientRect().width > 0,
      change: find("appearance-first-change-count")?.textContent,
      card: find("appearance-first-designer")?.querySelector(
        '[data-entity-id="approval"] .node-card-name',
      )?.textContent,
      error: find("appearance-first-designer")?.querySelector('[data-test="action-error"]')
        ?.textContent,
      density: find("appearance-first-density")?.value,
    },
    preview: {
      inputs: [...(preview?.querySelectorAll("input, textarea") ?? [])].map((input) => ({
        id: inputId(input),
        value: input.value,
        placeholder: input.getAttribute("placeholder"),
      })),
      definition: find("form-appearance-first-form-id")?.textContent,
      values: preview?.querySelector("pre")?.textContent,
      density: find("form-appearance-first-density")?.value,
    },
  };
}

function record(type, detail = {}) {
  if (rows.length >= 800) {
    stopped = true;
    active = null;
    status.textContent = "记录超过上限，本轮停止。请交回已有记录。";
    return false;
  }
  rows.push({
    sequence: ++sequence,
    at: performance.now(),
    stage: active,
    type,
    ...detail,
    state: snapshot(),
  });
  return true;
}

function flowCompleted() {
  const stage = stages.find((item) => item.entry === active);
  if (!stage?.applicationAction || composingInputs.size > 0) return false;
  const state = snapshot();
  return active === "drawer"
    ? !state.drawer.visible && state.drawer.change !== stage.initial.drawer.change
    : state.preview.definition !== stage.initial.preview.definition;
}

const panel = document.createElement("details");
panel.open = true;
panel.style.cssText =
  "position:fixed;bottom:8px;left:8px;z-index:2147483647;width:340px;max-height:55vh;overflow:auto;background:#fff;color:#222;border:1px solid #888;padding:10px;font:14px/1.5 sans-serif";
panel.innerHTML = `<summary>原生 IME 人工验收（仅观察）</summary>
<p>先手动点页面顶部「双入口外观」。系统简体拼音、Chrome；两入口各一次。阶段进行中不刷新、不切回聊天、不点记录器。</p>
<p>抽屉：手动打开左侧实例一的长名称节点；开始后全选名称，键入 shenqing 保持候选未上屏，鼠标将实例一密度改为紧凑，观察输入是否保留；完成选词，再点确定。不要靠重新输入掩盖丢字。若组合仍有效时点确定，应提示且不提交。</p>
<p>预览：开始后在下方 FormPreview 实例一「申请事由」全选并键入 shenqing，候选未上屏时鼠标改密度为紧凑；完成选词，核对字段与试填值；再点「换另一表单」，检查旧值没有残留。</p>
<p>每条流程结束后才点「完成当前入口」。如出现合成输入事件、页面隐藏或记录超限，立即停止并交回，不重试。</p>
<button type="button" data-ime-start="drawer">开始抽屉</button>
<button type="button" data-ime-start="preview">开始预览</button>
<button type="button" data-ime-finish>完成当前入口</button>
<button type="button" data-ime-stop>发现丢字／提前提交或操作失败：停止</button>
<p><label>实际环境与观察结果（最后填写）：<textarea data-ime-note rows="3" placeholder="确认系统简体拼音；两入口是否丢字、提示、提前提交；最终所选中文与显示是否一致"></textarea></label></p>
<button type="button" data-ime-submit>结束并交回记录</button>
<p data-ime-status>尚未开始。记录器不会操作应用。</p>`;
document.body.append(panel);
const status = panel.querySelector("[data-ime-status]");

for (const button of panel.querySelectorAll("[data-ime-start]")) {
  button.addEventListener("click", () => {
    const entry = button.getAttribute("data-ime-start");
    if (stopped || active || stages.some((stage) => stage.entry === entry)) return;
    if (!find("appearance-first-designer") || !find("form-appearance-first-instance")) {
      status.textContent = "请先手动打开「双入口外观」。";
      return;
    }
    if (entry === "drawer" && !snapshot().drawer.visible) {
      status.textContent = "请先手动打开节点实例一的审批抽屉。";
      return;
    }
    if (entry === "preview" && !stages.some((stage) => stage.entry === "drawer" && stage.finished))
      return;
    active = entry;
    stages.push({ entry, started: performance.now(), finished: false, initial: snapshot() });
    if (!record("stage-start")) return;
    status.textContent = `${entry === "drawer" ? "抽屉" : "预览"}记录中。完成流程后再点记录器。`;
  });
}
panel.querySelector("[data-ime-finish]").addEventListener("click", () => {
  if (!active || stopped) return;
  const stage = stages.find((item) => item.entry === active);
  if (!flowCompleted()) {
    status.textContent = "应用流程未完成。若发生异常，请使用停止按钮交回，不重新输入掩盖问题。";
    return;
  }
  if (!record("stage-finish")) return;
  stage.finished = true;
  active = null;
  status.textContent = "当前入口记录完成。可继续下一入口，或结束交回。";
});
panel.querySelector("[data-ime-stop]").addEventListener("click", () => {
  record("manual-stop", { reason: "人工发现异常或流程无法完成，详见备注" });
  stopped = true;
  active = null;
  status.textContent = "本轮已停止。请在备注写明症状后交回，不继续第二入口。";
});

for (const type of [
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "beforeinput",
  "input",
  "change",
  "pointerdown",
  "click",
  "focusin",
  "focusout",
]) {
  document.addEventListener(
    type,
    (event) => {
      if (!active || stopped) return;
      if (panel.contains(event.target)) {
        if (type !== "pointerdown" && type !== "focusin") return;
        const stopping = !!event.target.closest?.("[data-ime-stop]");
        const completed = flowCompleted();
        if (!record("observer-panel-interaction", { event: type, stopping, completed })) return;
        if (!completed && !stopping) {
          record("contamination", { reason: "应用流程未完成时操作了记录器面板" });
          stopped = true;
          active = null;
          status.textContent = "流程中操作了记录器面板，本轮停止。请填写备注并交回，不重试。";
        }
        return;
      }
      const scope = event.target.closest?.(
        '[data-test="appearance-first-instance"], [data-test="form-appearance-first-instance"]',
      );
      if (!scope) return;
      const detail = {
        trusted: event.isTrusted,
        composing: event.isComposing,
        data: event.data,
        inputType: event.inputType,
        target:
          event.target.closest?.("[data-test]")?.getAttribute("data-test") ?? event.target.tagName,
      };
      if (type === "compositionstart" || event.isComposing)
        composingInputs.add(inputId(event.target));
      if (type === "compositionend") composingInputs.delete(inputId(event.target));
      const stage = stages.find((item) => item.entry === active);
      if (
        type === "click" &&
        event.isTrusted &&
        ((active === "drawer" && detail.target === "drawer-save") ||
          (active === "preview" && detail.target === "form-appearance-first-other"))
      ) {
        stage.applicationAction = true;
      }
      if (!record(type, detail)) return;
      if (!event.isTrusted && /^(composition|beforeinput|input)/.test(type)) {
        record("contamination", { reason: "合成组合或输入事件" });
        stopped = true;
        active = null;
        panel.open = true;
        status.textContent = "检测到合成组合或输入事件，本轮停止。请交回已有记录，不继续操作。";
      } else {
        requestAnimationFrame(() => record(`${type}-after`, detail));
      }
    },
    { capture: true, passive: true },
  );
}
document.addEventListener("visibilitychange", () => {
  if (!active || document.visibilityState !== "hidden") return;
  record("contamination", { reason: "阶段期间页面隐藏，操作连续性中断" });
  stopped = true;
  active = null;
  panel.open = true;
  status.textContent = "页面在操作中隐藏，本轮停止。请交回已有记录。";
});

panel.querySelector("[data-ime-submit]").addEventListener("click", async (event) => {
  if (active) {
    status.textContent = "请先完成当前入口；若流程失败，在备注中说明后完成并交回。";
    return;
  }
  event.target.disabled = true;
  const payload = {
    config,
    stages,
    stopped,
    rows,
    note: panel.querySelector("[data-ime-note]").value,
    environment: {
      userAgent: navigator.userAgent,
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
    },
    final: snapshot(),
  };
  try {
    const response = await fetch("/__ime-record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());
    status.textContent = "记录已交回。现在可回聊天回复「已交回记录」。请勿开始第二轮。";
    stopped = true;
  } catch (error) {
    status.textContent = `交回失败：${error.message}。保留页面，回聊天说明；不要重新执行测试。`;
    event.target.disabled = false;
  }
});
