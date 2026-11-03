#!/usr/bin/env node
// 品牌设计基线的色板派生与检查脚本。仅是设计工具，不是产品代码或公开主题 API。
// 用法：
//   node derive-palette.mjs --check     校验 tokens.json 中的派生值、对比度、类型色差与样稿快照
//   node derive-palette.mjs --write     按种子与参数重写 tokens.json 的派生值并同步样稿快照
//   node derive-palette.mjs --evidence  额外写出 evidence/contrast-check.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const tokensPath = join(dir, "tokens.json");
const samplesPath = join(dir, "samples.html");
const evidencePath = join(dir, "evidence", "contrast-check.json");
const args = new Set(process.argv.slice(2));

// ---------- 颜色换算：sRGB ↔ OKLab/OKLCH，以及 WCAG 相对亮度 ----------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`不是 6 位十六进制颜色：${hex}`);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const hexToOklab = (hex) => linearToOklab(hexToRgb(hex).map(toLinear));

function hexToOklch(hex) {
  const [L, a, b] = hexToOklab(hex);
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

// 超出 sRGB 色域时保持明度与色相，二分降低彩度。
function oklchToHex(L, C, h) {
  const clampedL = Math.min(1, Math.max(0, L));
  const rad = (h * Math.PI) / 180;
  const inGamut = (c) =>
    oklabToLinear([clampedL, c * Math.cos(rad), c * Math.sin(rad)]).every(
      (v) => v >= -1e-6 && v <= 1 + 1e-6,
    );
  let chroma = Math.max(0, C);
  if (!inGamut(chroma)) {
    let low = 0;
    let high = chroma;
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) / 2;
      if (inGamut(mid)) low = mid;
      else high = mid;
    }
    chroma = low;
  }
  const linear = oklabToLinear([clampedL, chroma * Math.cos(rad), chroma * Math.sin(rad)]);
  return rgbToHex(linear.map((v) => fromLinear(Math.min(1, Math.max(0, v)))));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const deltaEOK = (a, b) => {
  const [x, y] = [hexToOklab(a), hexToOklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// 与 Element Plus SCSS 的 mix($a, $b, $weight) 一致：weight 为 a 的占比，按 sRGB 通道混合。
function mix(a, b, weight) {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(x.map((v, i) => v * weight + y[i] * (1 - weight)));
}

const round = (n) => Math.round(n * 10000) / 10000;

// ---------- 派生规则 ----------
function searchL(start, C, h, step, accept) {
  for (let L = start; L >= 0 && L <= 1; L += step) {
    const hex = oklchToHex(L, C, h);
    if (accept(hex)) return hex;
  }
  return null;
}

function pickReadable(candidates, backgrounds, target) {
  for (const hex of candidates) {
    if (backgrounds.every((bg) => contrast(hex, bg) >= target)) return hex;
  }
  return null;
}

// 从文字色向表面色逐步混合，取最接近表面色、且仍达到目标对比度的中性色。
function neutralToward(text, surface, backgrounds, target) {
  for (let w = 0; w <= 1.0001; w += 0.01) {
    const hex = mix(text, surface, w);
    if (backgrounds.every((bg) => contrast(hex, bg) >= target)) return hex;
  }
  return text;
}

function deriveNeutrals(read, rules) {
  const bgs = [read.surface, read.inset, read.canvas];
  const muted = neutralToward(read.text, read.surface, bgs, rules.mutedTarget);
  const controlBorder = neutralToward(read.text, read.surface, bgs, rules.controlBorderTarget);
  return { ...read, muted, controlBorder, connector: controlBorder };
}

function deriveRoles(seeds, palette, theme, params, failures, presetId, hostPrimary) {
  const p = params[theme];
  const fail = (role, reason) => failures.push({ preset: presetId, theme, role, reason });
  const seed = hexToOklch(seeds.primary);
  let primary;
  let primaryHover;
  let primaryPressed;
  let onPrimary;
  if (hostPrimary) {
    // 跟随宿主：主色三态与前景属于宿主 EP 控件，原样读取，不派生也不改写。
    ({ primary, primaryHover, primaryPressed, onPrimary } = hostPrimary);
  } else {
    primary =
      theme === "light" ? seeds.primary.toUpperCase() : oklchToHex(p.primaryL, seed.C, seed.h);
    const lifted = hexToOklch(primary);
    primaryHover = oklchToHex(lifted.L + p.hoverDL, lifted.C, seed.h);
    primaryPressed = oklchToHex(lifted.L + p.pressedDL, lifted.C, seed.h);
    const ink = oklchToHex(p.onInkL, Math.min(seed.C, p.onInkCMax), seed.h);
    const onOrder = theme === "light" ? ["#FFFFFF", ink] : [ink, "#FFFFFF"];
    onPrimary = pickReadable(onOrder, [primary, primaryHover, primaryPressed], 4.5);
    if (!onPrimary) {
      fail("onPrimary", "白色与同色相深墨色均无法在主色、悬停、按下三态达到 4.5:1");
      onPrimary = onOrder[0];
    }
  }
  const base = hexToOklch(primary);
  const primarySoft = oklchToHex(p.softL, Math.min(seed.C * p.softCRatio, p.softCMax), seed.h);
  const inkBackgrounds = [
    palette.surface,
    palette.canvas,
    palette.inset,
    primarySoft,
    palette.approvalSoft,
  ];
  let primaryInk = searchL(base.L, base.C, seed.h, theme === "light" ? -0.005 : 0.005, (hex) =>
    inkBackgrounds.every((bg) => contrast(hex, bg) >= 4.5),
  );
  if (!primaryInk) {
    fail("primaryInk", "沿明度搜索后仍无法对所有承载背景达到 4.5:1");
    primaryInk = primary;
  }
  const focus =
    pickReadable([primary, primaryInk], [palette.surface, palette.canvas, palette.inset], 3) ??
    primaryInk;

  let accentRoles;
  if (seeds.accent) {
    const accent = seeds.accent.toUpperCase();
    const a = hexToOklch(accent);
    const accentSoft = oklchToHex(
      p.accentSoftL,
      Math.min(a.C * p.accentSoftCRatio, p.accentSoftCMax),
      a.h,
    );
    const inkC = Math.min(a.C, p.accentInkCMax);
    let accentInk = searchL(a.L, inkC, a.h, theme === "light" ? -0.005 : 0.005, (hex) =>
      [accentSoft, palette.surface].every((bg) => contrast(hex, bg) >= 4.5),
    );
    if (!accentInk) {
      fail("accentInk", "无法对辅助色浅底及表面达到 4.5:1");
      accentInk = palette.text;
    }
    const accentOn = oklchToHex(p.onInkL, Math.min(a.C, p.onInkCMax), a.h);
    let onAccent = pickReadable(
      theme === "light" ? ["#FFFFFF", accentOn] : [accentOn, "#FFFFFF"],
      [accent],
      4.5,
    );
    if (!onAccent) {
      fail("onAccent", "白色与同色相深墨色均无法在辅助色上达到 4.5:1");
      onAccent = accentOn;
    }
    accentRoles = { accent, accentSoft, accentInk, onAccent };
  } else {
    // 跟随宿主且未提供辅助色时，不引入 FlowDuet 珊瑚橙，点缀退回中性色。
    accentRoles = {
      accent: palette.secondary,
      accentSoft: palette.inset,
      accentInk: palette.secondary,
      onAccent: palette.surface,
    };
  }
  // 跟随宿主时这四项是读取值；仍写入预设，供样稿还原宿主控件外观。
  return {
    primary,
    primaryHover,
    primaryPressed,
    onPrimary,
    primarySoft,
    primaryInk,
    focus,
    ...accentRoles,
  };
}

// EP 的衍生色阶：浅色主题向白色混合、深色主题向背景混合，dark-2 反向混合（与 EP SCSS 规则一致）。
function epScale(primary, theme, surface) {
  const toward = theme === "light" ? "#FFFFFF" : surface;
  const darker = theme === "light" ? "#000000" : "#FFFFFF";
  const scale = {};
  for (const n of [3, 5, 7, 8, 9]) scale[`light-${n}`] = mix(primary, toward, 1 - n / 10);
  scale["dark-2"] = mix(primary, darker, 0.8);
  return scale;
}

// ---------- 读取、计算与比对 ----------
const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
const { derivation } = tokens;
const failures = [];
const computed = {};

for (const [presetId, preset] of Object.entries(tokens.presets)) {
  computed[presetId] = { themes: {}, epScale: {} };
  for (const theme of tokens.confirmed.themes) {
    let palette = { ...tokens.themes[theme] };
    let neutrals = {};
    let hostPrimary = null;
    if (preset.hostSample) {
      neutrals = deriveNeutrals(preset.hostSample[theme], derivation.neutralRules);
      palette = { ...palette, ...neutrals };
      hostPrimary = preset.hostSample[theme];
    }
    const seeds = {
      primary: preset.seeds.primary.value,
      accent: preset.seeds.accent?.value ?? null,
    };
    const roles = deriveRoles(
      seeds,
      palette,
      theme,
      derivation.params,
      failures,
      presetId,
      hostPrimary,
    );
    computed[presetId].themes[theme] = { ...neutrals, ...roles };
    computed[presetId].epScale[theme] =
      preset.writesHostVariables === false ? null : epScale(roles.primary, theme, palette.surface);
  }
}

function resolvedPalette(presetId, theme) {
  const target = presetId === "flowduet" ? {} : tokens.presets[presetId].themes[theme];
  return { ...tokens.themes[theme], ...target };
}

if (args.has("--write")) {
  for (const [presetId, result] of Object.entries(computed)) {
    for (const theme of tokens.confirmed.themes) {
      if (presetId === "flowduet") Object.assign(tokens.themes[theme], result.themes[theme]);
      else tokens.presets[presetId].themes[theme] = result.themes[theme];
    }
    tokens.presets[presetId].epScale = result.epScale;
  }
  writeFileSync(tokensPath, JSON.stringify(tokens, null, 2) + "\n");
  const html = readFileSync(samplesPath, "utf8");
  const snapshot = JSON.stringify(tokens, null, 2)
    .split("\n")
    .map((line) => "      " + line)
    .join("\n");
  const next = html.replace(
    /(<script id="design-tokens" type="application\/json">\n)[\s\S]*?(\n {4}<\/script>)/,
    // 用函数替换，避免快照中的 $ 被当作替换模式。
    (_, open, close) => `${open}${snapshot}${close}`,
  );
  if (next === html && !html.includes(snapshot)) throw new Error("未找到样稿内嵌快照");
  writeFileSync(samplesPath, next);
  console.log("已写入派生值与样稿快照；请再运行 prettier 与 --check。");
}

// 派生值必须与 tokens.json 记录一致，防止手改派生色。
const mismatches = [];
for (const [presetId, result] of Object.entries(computed)) {
  for (const theme of tokens.confirmed.themes) {
    const stored = resolvedPalette(presetId, theme);
    for (const [role, value] of Object.entries(result.themes[theme])) {
      if (stored[role] !== value)
        mismatches.push({ presetId, theme, role, stored: stored[role], value });
    }
    const storedScale = tokens.presets[presetId].epScale?.[theme] ?? null;
    if (JSON.stringify(storedScale) !== JSON.stringify(result.epScale[theme]))
      mismatches.push({ presetId, theme, role: "epScale" });
  }
}

const results = [];
for (const [presetId, preset] of Object.entries(tokens.presets)) {
  const hostOwned = new Set(
    preset.writesHostVariables === false ? derivation.checks.hostOwnedRoles : [],
  );
  for (const theme of tokens.confirmed.themes) {
    const palette = resolvedPalette(presetId, theme);
    for (const check of derivation.checks.contrastPairs) {
      const [fg, bg] = check.pair.split("/");
      const ratio = contrast(palette[fg], palette[bg]);
      // 两端都是宿主自有角色时，FlowDuet 不改写，只登记为宿主继承信息。
      const inherited = hostOwned.has(fg) && hostOwned.has(bg);
      const kind = inherited ? "hostInherited" : check.kind;
      results.push({
        preset: presetId,
        theme,
        kind,
        pair: check.pair,
        foreground: palette[fg],
        background: palette[bg],
        ratio: round(ratio),
        target: check.target,
        passCheck: kind === "info" || kind === "hostInherited" ? null : ratio >= check.target,
      });
    }
    for (const [typeRole, selectionRole] of derivation.checks.typeSeparation.pairs) {
      const value = deltaEOK(palette[typeRole], palette[selectionRole]);
      results.push({
        preset: presetId,
        theme,
        kind: "typeSeparation",
        pair: `${typeRole}/${selectionRole}`,
        foreground: palette[typeRole],
        background: palette[selectionRole],
        deltaEOK: round(value),
        target: derivation.checks.typeSeparation.minDeltaEOK,
        passCheck: value >= derivation.checks.typeSeparation.minDeltaEOK,
      });
    }
  }
}

// 跟随宿主时 EP 自身控件仍使用宿主原值，只登记为宿主继承信息，不计入 FlowDuet 自有角色。
const hostInherited = [];
for (const [presetId, preset] of Object.entries(tokens.presets)) {
  if (!preset.hostSample) continue;
  for (const theme of tokens.confirmed.themes) {
    const s = preset.hostSample[theme];
    const own = preset.hostOwnSample?.[theme] ?? {};
    for (const [label, fg, bg, target] of [
      ["EP 次要说明文字", own.textSecondary, s.surface, 4.5],
      ["EP 占位文字", own.placeholder, s.surface, 4.5],
      ["EP 输入边界", own.inputBorder, s.surface, 3],
    ]) {
      if (!fg) continue;
      const ratio = contrast(fg, bg);
      hostInherited.push({
        preset: presetId,
        theme,
        item: label,
        foreground: fg,
        background: bg,
        ratio: round(ratio),
        target,
        meetsTarget: ratio >= target,
      });
    }
  }
}

const html = readFileSync(samplesPath, "utf8");
const snapshotMatch = html.match(
  /<script id="design-tokens" type="application\/json">([\s\S]*?)<\/script>/,
);
const tokenSnapshotEqual =
  !!snapshotMatch && JSON.stringify(JSON.parse(snapshotMatch[1])) === JSON.stringify(tokens);
const failed = results.filter((r) => r.passCheck === false);
const summary = {
  generatedBy: "derive-palette.mjs",
  tokenStatus: tokens.status,
  tokenSnapshotEqual,
  derivedValuesMatch: mismatches.length === 0,
  derivationFailures: failures,
  checks: results.filter((r) => r.passCheck !== null).length,
  failures: failed,
  minimumText: round(Math.min(...results.filter((r) => r.kind === "text").map((r) => r.ratio))),
  minimumNonText: round(
    Math.min(...results.filter((r) => r.kind === "nonText").map((r) => r.ratio)),
  ),
  minimumTypeSeparation: round(
    Math.min(...results.filter((r) => r.kind === "typeSeparation").map((r) => r.deltaEOK)),
  ),
  method:
    "WCAG 相对亮度对比度；类型色差为 OKLab 欧氏距离。仅评价列出的设计配对，不代表整个产品可访问性合规",
  hostInherited,
  results,
};

if (args.has("--evidence")) writeFileSync(evidencePath, JSON.stringify(summary, null, 2) + "\n");

const ok =
  tokenSnapshotEqual && mismatches.length === 0 && failures.length === 0 && failed.length === 0;
console.log(
  JSON.stringify(
    {
      ok,
      tokenSnapshotEqual,
      mismatches: mismatches.slice(0, 20),
      derivationFailures: failures,
      checks: summary.checks,
      failures: failed.map((r) => `${r.preset}/${r.theme} ${r.pair} ${r.ratio ?? r.deltaEOK}`),
      minimumText: summary.minimumText,
      minimumNonText: summary.minimumNonText,
      minimumTypeSeparation: summary.minimumTypeSeparation,
    },
    null,
    2,
  ),
);
if (args.has("--check") && !ok) process.exit(1);
