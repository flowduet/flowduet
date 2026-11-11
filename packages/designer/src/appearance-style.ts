import type { AppearanceMode, ResolvedComponentAppearance } from "./appearance.js";

type Rgb = [number, number, number];

export interface HostAppearanceContext {
  canvas: string;
  surface: string;
  inset: string;
  text: string;
  secondary: string;
  border: string;
  disabledText: string;
  disabledSurface: string;
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  onPrimary: string;
  fontFamily: string;
  fontSizeBase: string;
  radius: string;
}

const HOST_DEFAULTS: Record<AppearanceMode, HostAppearanceContext> = {
  light: {
    canvas: "#F2F3F5",
    surface: "#FFFFFF",
    inset: "#F5F7FA",
    text: "#303133",
    secondary: "#606266",
    border: "#E4E7ED",
    disabledText: "#A8ABB2",
    disabledSurface: "#F5F7FA",
    primary: "#409EFF",
    primaryHover: "#79BBFF",
    primaryPressed: "#337ECC",
    onPrimary: "#FFFFFF",
    fontFamily:
      '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif',
    fontSizeBase: "14px",
    radius: "4px",
  },
  dark: {
    canvas: "#0A0A0A",
    surface: "#141414",
    inset: "#262727",
    text: "#E5EAF3",
    secondary: "#CFD3DC",
    border: "#414243",
    disabledText: "#8D9095",
    disabledSurface: "#262727",
    primary: "#409EFF",
    primaryHover: "#3375B9",
    primaryPressed: "#66B1FF",
    onPrimary: "#FFFFFF",
    fontFamily:
      '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif',
    fontSizeBase: "14px",
    radius: "4px",
  },
};

const BRAND_ROLES = {
  light: {
    canvas: "#F5F6FA",
    surface: "#FFFFFF",
    inset: "#F0F2F8",
    text: "#20263D",
    secondary: "#565F76",
    muted: "#626D86",
    border: "#CDD2E0",
    controlBorder: "#7A859E",
    primary: "#2D3E97",
    primaryHover: "#222F87",
    primaryPressed: "#181F77",
    onPrimary: "#FFFFFF",
    primarySoft: "#EAF0FF",
    primaryInk: "#2D3E97",
    focus: "#2D3E97",
    disabledText: "#8B92A4",
    disabledSurface: "#EDF0F5",
  },
  dark: {
    canvas: "#141925",
    surface: "#1D2435",
    inset: "#252E43",
    text: "#E9EDF7",
    secondary: "#B7C0D5",
    muted: "#A3AFC9",
    border: "#3C4864",
    controlBorder: "#75839F",
    primary: "#A5BBFF",
    primaryHover: "#BBCCFF",
    primaryPressed: "#93A8EB",
    onPrimary: "#171F3E",
    primarySoft: "#2A3354",
    primaryInk: "#A5BBFF",
    focus: "#A5BBFF",
    disabledText: "#7F8AA2",
    disabledSurface: "#252D40",
  },
} as const;

const BRAND_EP_SCALE = {
  light: {
    "light-3": "#6C78B6",
    "light-5": "#969FCB",
    "light-7": "#C0C5E0",
    "light-8": "#D5D8EA",
    "light-9": "#EAECF5",
    "dark-2": "#243279",
  },
  dark: {
    "light-3": "#7C8EC2",
    "light-5": "#61709A",
    "light-7": "#465172",
    "light-8": "#38425D",
    "light-9": "#2B3349",
    "dark-2": "#B7C9FF",
  },
} as const;

const STATUS_ROLES = {
  light: {
    danger: "#B4233A",
    dangerSoft: "#FFF0F2",
    success: "#23714D",
    warning: "#8C5C12",
    approvalSoft: "#ECF1F5",
  },
  dark: {
    danger: "#FF9DAE",
    dangerSoft: "#422835",
    success: "#81D5A6",
    warning: "#F0C46B",
    approvalSoft: "#282F35",
  },
} as const;

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const fromLinear = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(value)) throw new Error(`无法读取颜色：${hex}`);
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as Rgb;
}

function rgbToHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((channel) =>
        Math.round(Math.min(1, Math.max(0, channel)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

function linearToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklch(hex: string) {
  const [L, a, b] = linearToOklab(hexToRgb(hex).map(toLinear) as Rgb);
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

// 与已批准的 R2 派生脚本一致：超出色域时保持明度和色相，二分降低彩度。
function oklchToHex(L: number, C: number, h: number): string {
  const clampedL = Math.min(1, Math.max(0, L));
  const radians = (h * Math.PI) / 180;
  const inGamut = (chroma: number) =>
    oklabToLinear([clampedL, chroma * Math.cos(radians), chroma * Math.sin(radians)]).every(
      (channel) => channel >= -1e-6 && channel <= 1 + 1e-6,
    );
  let chroma = Math.max(0, C);
  if (!inGamut(chroma)) {
    let low = 0;
    let high = chroma;
    for (let index = 0; index < 30; index += 1) {
      const middle = (low + high) / 2;
      if (inGamut(middle)) low = middle;
      else high = middle;
    }
    chroma = low;
  }
  const linear = oklabToLinear([clampedL, chroma * Math.cos(radians), chroma * Math.sin(radians)]);
  return rgbToHex(linear.map((channel) => fromLinear(Math.min(1, Math.max(0, channel)))) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

function mix(a: string, b: string, weight: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(
    left.map((channel, index) => channel * weight + right[index]! * (1 - weight)) as Rgb,
  );
}

function neutralToward(text: string, surface: string, backgrounds: string[], target: number) {
  for (let weight = 0; weight <= 1.0001; weight += 0.01) {
    const color = mix(text, surface, weight);
    if (backgrounds.every((background) => contrast(color, background) >= target)) return color;
  }
  return text;
}

function searchPrimaryInk(primary: string, backgrounds: string[], mode: AppearanceMode) {
  const seed = hexToOklch(primary);
  const step = mode === "light" ? -0.005 : 0.005;
  for (let L = seed.L; L >= 0 && L <= 1; L += step) {
    const color = oklchToHex(L, seed.C, seed.h);
    if (backgrounds.every((background) => contrast(color, background) >= 4.5)) return color;
  }
  // 极端宿主色无法达标时不改宿主 EP；自有角色至少保持宿主正文可读性。
  return null;
}

function densityVariables(density: "comfortable" | "compact"): Record<string, string> {
  const compact = density === "compact";
  return {
    "--fd-control-height": compact ? "24px" : "32px",
    "--fd-control-font-size": compact ? "12px" : "14px",
    "--fd-field-gap": compact ? "12px" : "16px",
    "--fd-panel-padding": compact ? "16px" : "24px",
    "--fd-node-padding": compact ? "12px" : "16px",
    "--fd-row-gap": compact ? "8px" : "12px",
  };
}

function hostVariables(
  appearance: ResolvedComponentAppearance,
  context: HostAppearanceContext,
): Record<string, string> {
  const { mode } = appearance;
  const status = STATUS_ROLES[mode];
  const backgrounds = [context.surface, context.inset, context.canvas];
  const muted = neutralToward(context.text, context.surface, backgrounds, 4.5);
  const controlBorder = neutralToward(context.text, context.surface, backgrounds, 3);
  const seed = hexToOklch(context.primary);
  const primarySoft = oklchToHex(
    mode === "light" ? 0.955 : 0.33,
    Math.min(seed.C * (mode === "light" ? 0.3 : 0.5), mode === "light" ? 0.035 : 0.06),
    seed.h,
  );
  const primaryInk =
    searchPrimaryInk(context.primary, [...backgrounds, primarySoft, status.approvalSoft], mode) ??
    context.text;
  // 与 R2 派生口径一致：跨明度宿主背景使 3:1 搜索落空时回退 primaryInk，避免省略 --fd-focus 使焦点环失效。
  const focus =
    [context.primary, primaryInk].find((color) =>
      backgrounds.every((background) => contrast(color, background) >= 3),
    ) ?? primaryInk;
  return {
    ...densityVariables(appearance.density),
    "--fd-canvas": context.canvas,
    "--fd-surface": context.surface,
    "--fd-inset": context.inset,
    "--fd-text": context.text,
    "--fd-secondary": context.secondary,
    "--fd-muted": muted,
    "--fd-border": context.border,
    "--fd-control-border": controlBorder,
    "--fd-primary": context.primary,
    "--fd-primary-hover": context.primaryHover,
    "--fd-primary-pressed": context.primaryPressed,
    "--fd-on-primary": context.onPrimary,
    "--fd-primary-soft": primarySoft,
    "--fd-primary-ink": primaryInk,
    "--fd-focus": focus,
    "--fd-danger": status.danger,
    "--fd-danger-soft": status.dangerSoft,
    "--fd-success": status.success,
    "--fd-warning": status.warning,
    "--fd-disabled-text": context.disabledText,
    "--fd-disabled-surface": context.disabledSurface,
    "--fd-font-family": context.fontFamily,
    "--fd-font-size-base": context.fontSizeBase,
    "--fd-radius": context.radius,
  };
}

function brandVariables(appearance: ResolvedComponentAppearance): Record<string, string> {
  const roles = BRAND_ROLES[appearance.mode];
  const status = STATUS_ROLES[appearance.mode];
  const scale = BRAND_EP_SCALE[appearance.mode];
  return {
    ...densityVariables(appearance.density),
    "--fd-canvas": roles.canvas,
    "--fd-surface": roles.surface,
    "--fd-inset": roles.inset,
    "--fd-text": roles.text,
    "--fd-secondary": roles.secondary,
    "--fd-muted": roles.muted,
    "--fd-border": roles.border,
    "--fd-control-border": roles.controlBorder,
    "--fd-primary": roles.primary,
    "--fd-primary-hover": roles.primaryHover,
    "--fd-primary-pressed": roles.primaryPressed,
    "--fd-on-primary": roles.onPrimary,
    "--fd-primary-soft": roles.primarySoft,
    "--fd-primary-ink": roles.primaryInk,
    "--fd-focus": roles.focus,
    "--fd-danger": status.danger,
    "--fd-danger-soft": status.dangerSoft,
    "--fd-success": status.success,
    "--fd-warning": status.warning,
    "--fd-disabled-text": roles.disabledText,
    "--fd-disabled-surface": roles.disabledSurface,
    "--fd-font-family": 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    "--fd-font-size-base": "14px",
    "--fd-radius": "8px",
    "--el-color-primary": roles.primary,
    "--el-color-primary-light-3": scale["light-3"],
    "--el-color-primary-light-5": scale["light-5"],
    "--el-color-primary-light-7": scale["light-7"],
    "--el-color-primary-light-8": scale["light-8"],
    "--el-color-primary-light-9": scale["light-9"],
    "--el-color-primary-dark-2": scale["dark-2"],
    "--el-bg-color-page": roles.canvas,
    "--el-bg-color": roles.surface,
    "--el-bg-color-overlay": roles.surface,
    "--el-fill-color-blank": roles.surface,
    "--el-fill-color-light": roles.inset,
    "--el-text-color-primary": roles.text,
    "--el-text-color-regular": roles.secondary,
    "--el-text-color-secondary": roles.muted,
    "--el-text-color-placeholder": roles.muted,
    "--el-border-color": roles.controlBorder,
    "--el-border-color-hover": roles.controlBorder,
    "--el-border-color-light": roles.border,
    "--el-border-color-lighter": roles.border,
    "--el-disabled-text-color": roles.disabledText,
    "--el-disabled-bg-color": roles.disabledSurface,
    "--el-disabled-border-color": roles.border,
    "--el-color-danger": status.danger,
    "--el-color-success": status.success,
    "--el-color-warning": status.warning,
    "--el-font-family": 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    "--el-font-size-base": "14px",
    "--el-form-label-font-size": "13px",
    "--el-border-radius-base": "8px",
  };
}

export function createAppearanceVariables(
  appearance: ResolvedComponentAppearance | undefined,
  host: HostAppearanceContext | undefined,
): Record<string, string> | undefined {
  if (appearance === undefined) return undefined;
  if (appearance.colorSource === "host")
    return hostVariables(appearance, host ?? HOST_DEFAULTS[appearance.mode]);
  return brandVariables(appearance);
}

const RGB_CHANNEL = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const COMMA_RGB_RE = new RegExp(
  String.raw`^rgba?\(\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}(?:\s*,\s*(?:1(?:\.0+)?|100%))?\s*\)$`,
  "i",
);
const SPACE_RGB_RE = new RegExp(
  String.raw`^rgba?\(\s*${RGB_CHANNEL}\s+${RGB_CHANNEL}\s+${RGB_CHANNEL}(?:\s*\/\s*(?:1(?:\.0+)?|100%))?\s*\)$`,
  "i",
);

function cssColorToRgb(value: string): Rgb {
  if (value.startsWith("#"))
    return hexToRgb(
      /^#[\da-f]{3}$/i.test(value)
        ? "#" + [...value.slice(1)].map((channel) => channel + channel).join("")
        : value,
    );
  const match = value.match(COMMA_RGB_RE) ?? value.match(SPACE_RGB_RE);
  if (match !== null) {
    const channels = match.slice(1, 4).map(Number);
    if (channels.every((channel) => channel >= 0 && channel <= 255))
      return channels.map((channel) => channel / 255) as Rgb;
  }
  throw new Error(`无法读取颜色：${value}`);
}

function readBrowserColor(value: string, element: HTMLElement, background: string): string {
  const canvas = element.ownerDocument.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("当前环境不支持浏览器颜色解析");
  const currentColor = element.ownerDocument.defaultView?.getComputedStyle(element).color;
  const color = value.replace(/\bcurrentcolor\b/gi, currentColor || "black");
  // 非法 fillStyle 会保留旧值；两个不同哨兵可区分非法值与恰好等于哨兵的合法色。
  context.fillStyle = "#010203";
  context.fillStyle = color;
  const first = context.fillStyle;
  context.fillStyle = "#040506";
  context.fillStyle = color;
  if (context.fillStyle !== first) throw new Error(`无法读取颜色：${value}`);
  // CSS Color 4 由浏览器转为 sRGB；透明角色在其实际表面上合成后再用于对比度派生。
  context.fillStyle = background;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return rgbToHex([r! / 255, g! / 255, b! / 255]);
}

function readColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
  element: HTMLElement | undefined,
  background: string,
): string {
  const value = styles.getPropertyValue(name).trim();
  if (value === "") return fallback;
  try {
    return rgbToHex(cssColorToRgb(value));
  } catch {
    try {
      return element === undefined ? fallback : readBrowserColor(value, element, background);
    } catch {
      return fallback;
    }
  }
}

/** 抽屉 Teleport 前读取宿主上下文；不做通用 CSSOM 侦测，也不回写宿主变量。 */
export function readHostAppearance(
  element: HTMLElement | undefined,
  mode: AppearanceMode,
): HostAppearanceContext {
  const fallback = HOST_DEFAULTS[mode];
  const styles = element?.ownerDocument.defaultView?.getComputedStyle(element);
  if (styles === undefined) return { ...fallback };
  const color = (name: string, key: keyof HostAppearanceContext, background: string) =>
    readColor(styles, name, fallback[key], element, background);
  const canvas = color("--el-bg-color-page", "canvas", fallback.canvas);
  const surface = color("--el-bg-color", "surface", canvas);
  const primary = color("--el-color-primary", "primary", surface);
  return {
    canvas,
    surface,
    inset: color("--el-fill-color-light", "inset", surface),
    text: color("--el-text-color-primary", "text", surface),
    secondary: color("--el-text-color-regular", "secondary", surface),
    border: color("--el-border-color-light", "border", surface),
    disabledText: color("--el-disabled-text-color", "disabledText", surface),
    disabledSurface: color("--el-disabled-bg-color", "disabledSurface", surface),
    primary,
    primaryHover: color("--el-color-primary-light-3", "primaryHover", surface),
    primaryPressed: color("--el-color-primary-dark-2", "primaryPressed", surface),
    onPrimary: color("--el-color-white", "onPrimary", primary),
    fontFamily: styles.getPropertyValue("--el-font-family").trim() || fallback.fontFamily,
    fontSizeBase: styles.getPropertyValue("--el-font-size-base").trim() || fallback.fontSizeBase,
    radius: styles.getPropertyValue("--el-border-radius-base").trim() || fallback.radius,
  };
}
