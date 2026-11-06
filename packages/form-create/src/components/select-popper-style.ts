import type { HostAppearanceContext } from "@flowduet/designer";

// EP 2.14.6 当前下拉面板实际消费的主题变量、可见状态与 CSS 属性。
const SELECT_POPPER_PROPERTIES = [
  ["--el-bg-color-overlay", "", "background-color"],
  ["--el-bg-color-overlay", " > .el-popper__arrow::before", "background-color"],
  ["--el-border-color-light", "", "border-color"],
  ["--el-border-color-light", " > .el-popper__arrow::before", "border-color"],
  ["--el-box-shadow-light", "", "box-shadow"],
  ["--el-font-family", "", "font-family"],
  ["--el-popper-border-radius", "", "border-radius"],
  ["--el-border-radius-base", " .el-select-dropdown", "border-radius"],
  [
    "--el-text-color-regular",
    " .el-select-dropdown__item:not(.is-selected):not(.is-disabled)",
    "color",
  ],
  [
    "--el-fill-color-light",
    " .el-select-dropdown__item.is-hovering:not(.is-disabled)",
    "background-color",
  ],
  ["--el-color-primary", " .el-select-dropdown__item.is-selected:not(.is-disabled)", "color"],
  ["--el-text-color-placeholder", " .el-select-dropdown__item.is-disabled", "color"],
  ["--el-text-color-secondary", " .el-select-dropdown__empty", "color"],
] as const;

// 字号仅在业务显式配置时覆盖密度默认；不能把宿主基准字号当作每档密度的默认值。
const EXPLICIT_SELECT_DENSITY_PROPERTIES = [
  ["--el-font-size-base", " .el-select-dropdown__item", "font-size"],
  ["--el-select-font-size", " .el-select-dropdown__empty", "font-size"],
] as const;

/** 两种配色来源都保留业务 inline EP 变量的原有含义，不要求调用方使用内部 FD token。 */
export function explicitSelectPopperCss(owner: string): string {
  const rules = [
    `${owner}[style*="--el-popover-border-radius:"]{border-radius:var(--el-popover-border-radius)}`,
  ];
  for (const [variable, suffix, property] of [
    ...SELECT_POPPER_PROPERTIES,
    ...EXPLICIT_SELECT_DENSITY_PROPERTIES,
  ]) {
    rules.push(`${owner}[style*="${variable}:"]${suffix}{${property}:var(${variable})}`);
    if (suffix.includes(".el-select-dropdown__item")) {
      rules.push(`${owner}${suffix}[style*="${variable}:"]{${property}:var(${variable})}`);
    }
  }
  return rules.join("\n");
}

/**
 * Teleport 到 body 后只映射可见属性，不复制 --el-* 或改挂载位置，
 * 避免换肤关闭面板或引入容器裁切；显式 inline 配置优先于采样默认。
 */
export function hostSelectPopperCss(
  owner: string,
  host: HTMLElement,
  context: HostAppearanceContext,
): string {
  const styles = host.ownerDocument.defaultView?.getComputedStyle(host);
  const fallbacks: Record<(typeof SELECT_POPPER_PROPERTIES)[number][0], string> = {
    "--el-bg-color-overlay": context.surface,
    "--el-border-color-light": context.border,
    "--el-box-shadow-light": "none",
    "--el-font-family": context.fontFamily,
    "--el-popper-border-radius":
      styles?.getPropertyValue("--el-popover-border-radius").trim() || "4px",
    "--el-border-radius-base": context.radius,
    "--el-text-color-regular": context.secondary,
    "--el-fill-color-light": context.inset,
    "--el-color-primary": context.primary,
    "--el-text-color-placeholder": context.disabledText,
    "--el-text-color-secondary": context.secondary,
  };
  const defaults = SELECT_POPPER_PROPERTIES.map(([variable, suffix, property]) => {
    const value = styles?.getPropertyValue(variable).trim() || fallbacks[variable];
    return `${owner}${suffix}{${property}:${value}}`;
  });
  return [...defaults, explicitSelectPopperCss(owner)].join("\n");
}
