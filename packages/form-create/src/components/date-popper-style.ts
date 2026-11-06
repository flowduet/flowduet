import type { HostAppearanceContext } from "@flowduet/designer";

type DatePopperProperty = readonly [variable: string, suffix: string, property: string];

const CURRENT_TEXT =
  " :is(.el-date-table, .el-month-table, .el-year-table) td.current:not(.disabled) .el-date-table-cell__text";
const RANGE_TEXT =
  " :is(.el-date-table, .el-month-table, .el-year-table) td:is(.start-date, .end-date):not(.disabled) .el-date-table-cell__text";
const CURRENT_WEEK_CELL =
  " .el-date-table.is-week-mode .el-date-table__row.current td:not(.start-date):not(.end-date) .el-date-table-cell";

// EP 2.14.6 当前日期／时间面板的可见消费点；通用变量在前，组件专用变量在后。
const DATE_POPPER_PROPERTIES: readonly DatePopperProperty[] = [
  ["--el-border-radius-base", " .el-picker-panel", "border-radius"],
  ["--el-popper-border-radius", "", "border-radius"],
  ["--el-popper-border-radius", " .el-picker-panel", "border-radius"],
  ["--el-bg-color-overlay", "", "background-color"],
  ["--el-bg-color-overlay", " > .el-popper__arrow::before", "background-color"],
  ["--el-bg-color-overlay", " .el-picker-panel", "background-color"],
  ["--el-bg-color-overlay", " .el-time-panel", "background-color"],
  ["--el-datepicker-bg-color", " .el-picker-panel", "background-color"],
  ["--el-datepicker-bg-color", " .el-picker-panel__footer", "background-color"],
  ["--el-datepicker-bg-color", " .el-time-panel", "background-color"],
  ["--el-border-color-light", " .el-time-panel__content::before", "border-top-color"],
  ["--el-border-color-light", " .el-time-panel__content::before", "border-bottom-color"],
  ["--el-border-color-light", " .el-time-panel__footer", "border-top-color"],
  ["--el-timepicker-inner-border-color", " .el-time-panel__footer", "border-top-color"],
  ["--el-border-color-light", "", "border-color"],
  ["--el-border-color-light", " > .el-popper__arrow::before", "border-color"],
  ["--el-datepicker-border-color", "", "border-color"],
  ["--el-datepicker-border-color", " > .el-popper__arrow::before", "border-color"],
  ["--el-datepicker-border-color", " .el-time-panel", "border-color"],
  ["--el-box-shadow-light", "", "box-shadow"],
  ["--el-box-shadow-light", " .el-time-panel", "box-shadow"],
  ["--el-font-family", "", "font-family"],
  ["--el-text-color-regular", " .el-picker-panel", "color"],
  ["--el-text-color-regular", " .el-date-picker__header-label", "color"],
  ["--el-text-color-regular", CURRENT_WEEK_CELL, "color"],
  ["--el-text-color-regular", " .el-time-spinner__item", "color"],
  ["--el-text-color-regular", " .el-button.is-plain", "color"],
  // 普通文字仅匹配非状态单元；显式变量恢复也不能覆盖悬停、今天、选中或禁用色。
  [
    "--el-datepicker-text-color",
    " :is(.el-month-table, .el-year-table) :where(td:not(.current):not(.start-date):not(.end-date):not(.today):not(.disabled)) .el-date-table-cell__text:where(:not(:hover))",
    "color",
  ],
  ["--el-datepicker-text-color", " .el-picker-panel__shortcut", "color"],
  ["--el-text-color-primary", " .el-picker-panel__btn", "color"],
  ["--el-text-color-primary", " .el-time-panel__btn", "color"],
  ["--el-text-color-primary", " .el-time-spinner__item.is-active:not(.is-disabled)", "color"],
  ["--el-text-color-secondary", " .el-time-spinner__arrow", "color"],
  ["--el-text-color-secondary", " .el-scrollbar__thumb", "background-color"],
  ["--el-scrollbar-bg-color", " .el-scrollbar__thumb", "background-color"],
  ["--el-scrollbar-hover-bg-color", " .el-scrollbar__thumb:hover", "background-color"],
  [
    "--el-text-color-placeholder",
    " .el-date-table td:is(.prev-month, .next-month, .week)",
    "color",
  ],
  [
    "--el-datepicker-off-text-color",
    " .el-date-table td:is(.prev-month, .next-month, .week)",
    "color",
  ],
  [
    "--el-color-primary",
    " :is(.el-date-table, .el-month-table, .el-year-table) td.today:not(.current):not(.start-date):not(.end-date) .el-date-table-cell__text",
    "color",
  ],
  ["--el-color-primary", " .el-date-table td.available:hover", "color"],
  [
    "--el-color-primary",
    " :is(.el-month-table, .el-year-table) .el-date-table-cell__text:hover",
    "color",
  ],
  ["--el-color-primary", " .el-picker-panel__icon-btn:hover", "color"],
  ["--el-color-primary", " .el-picker-panel__icon-btn:focus-visible", "color"],
  ["--el-color-primary", " .el-date-picker__header-label:hover", "color"],
  ["--el-color-primary", " .el-date-picker__header-label:focus-visible", "color"],
  ["--el-color-primary", " .el-date-picker__header-label.active", "color"],
  ["--el-color-primary", " .el-picker-panel__shortcut:hover", "color"],
  ["--el-color-primary", " .el-picker-panel__shortcut.active", "color"],
  ["--el-color-primary", " .el-time-spinner__arrow:hover", "color"],
  ["--el-color-primary", " .el-time-panel__btn.confirm", "color"],
  ["--el-color-primary", " .el-button.is-text", "color"],
  ["--el-color-primary", " .el-button.is-plain:hover", "color"],
  ["--el-color-primary", " .el-button.is-plain:focus-visible", "color"],
  ["--el-color-primary", " .el-button.is-plain:hover", "border-color"],
  ["--el-color-primary", " .el-button.is-plain:focus-visible", "border-color"],
  ["--el-color-primary", " .el-button--primary", "background-color"],
  ["--el-color-primary", " .el-button--primary", "border-color"],
  ["--el-color-primary", CURRENT_TEXT, "background-color"],
  ["--el-color-primary", RANGE_TEXT, "background-color"],
  ["--el-datepicker-hover-text-color", " .el-date-table td.available:hover", "color"],
  [
    "--el-datepicker-hover-text-color",
    " :is(.el-month-table, .el-year-table) .el-date-table-cell__text:hover",
    "color",
  ],
  ["--el-datepicker-hover-text-color", " .el-picker-panel__icon-btn:hover", "color"],
  ["--el-datepicker-hover-text-color", " .el-picker-panel__icon-btn:focus-visible", "color"],
  ["--el-datepicker-hover-text-color", " .el-date-picker__header-label:hover", "color"],
  ["--el-datepicker-hover-text-color", " .el-date-picker__header-label:focus-visible", "color"],
  ["--el-datepicker-hover-text-color", " .el-picker-panel__shortcut:hover", "color"],
  ["--el-datepicker-active-color", CURRENT_TEXT, "background-color"],
  ["--el-datepicker-active-color", RANGE_TEXT, "background-color"],
  ["--el-datepicker-active-color", " .el-date-picker__header-label.active", "color"],
  ["--el-datepicker-active-color", " .el-picker-panel__shortcut.active", "color"],
  [
    "--el-datepicker-active-color",
    " :is(.el-date-table, .el-month-table, .el-year-table) td:focus-visible .el-date-table-cell__text",
    "outline-color",
  ],
  ["--el-timepicker-active-color", " .el-time-panel__btn.confirm", "color"],
  ["--el-color-primary-light-3", " .el-button.is-text:hover", "color"],
  ["--el-color-primary-light-3", " .el-button.is-text:focus-visible", "color"],
  ["--el-color-white", " .el-button--primary", "color"],
  ["--el-fill-color-light", " .el-date-table td.disabled .el-date-table-cell", "background-color"],
  [
    "--el-fill-color-light",
    " :is(.el-month-table, .el-year-table) td.disabled .el-date-table-cell__text",
    "background-color",
  ],
  [
    "--el-fill-color-light",
    " .el-time-spinner__item:hover:not(.is-disabled):not(.is-active)",
    "background-color",
  ],
  ["--el-text-color-placeholder", " .el-date-table td.disabled .el-date-table-cell", "color"],
  [
    "--el-text-color-placeholder",
    " :is(.el-month-table, .el-year-table) td.disabled .el-date-table-cell__text",
    "color",
  ],
  ["--el-text-color-placeholder", " .el-time-spinner__item.is-disabled", "color"],
  [
    "--el-datepicker-inrange-bg-color",
    " .el-date-table td.in-range .el-date-table-cell",
    "background-color",
  ],
  ["--el-datepicker-inrange-bg-color", CURRENT_WEEK_CELL, "background-color"],
  [
    "--el-datepicker-inrange-hover-bg-color",
    " .el-date-table td.in-range .el-date-table-cell:hover",
    "background-color",
  ],
  ["--el-datepicker-header-text-color", " .el-date-table th", "color"],
  ["--el-border-color-lighter", " .el-date-table th", "border-bottom-color"],
  ["--el-border-color-lighter", " .el-date-picker__header--bordered", "border-bottom-color"],
  ["--el-datepicker-inner-border-color", " .el-date-picker__time-header", "border-bottom-color"],
  ["--el-datepicker-inner-border-color", " .el-picker-panel__footer", "border-top-color"],
  ["--el-datepicker-inner-border-color", " .el-picker-panel__sidebar", "border-right-color"],
  ["--el-datepicker-icon-color", " .el-picker-panel__icon-btn", "color"],
  ["--el-fill-color-darker", " .el-picker-panel__btn", "border-color"],
  ["--el-text-color-disabled", " .el-picker-panel__btn[disabled]", "color"],
  ["--el-text-color-disabled", " .el-button.is-disabled", "color"],
  ["--el-fill-color-blank", " .el-button.is-plain", "background-color"],
  ["--el-border-color-light", " .el-button.is-plain", "border-color"],
];

function declarations(entries: readonly DatePopperProperty[], value: (name: string) => string) {
  return entries.map(([variable, suffix, property]) => ({
    suffix,
    css: `${property}:${value(variable)}`,
  }));
}

/** 业务 inline EP 变量沿原消费关系恢复优先级，不覆盖选中态的固定白色语义。 */
export function explicitDatePopperCss(owner: string): string {
  return DATE_POPPER_PROPERTIES.map(
    ([variable, suffix, property]) =>
      `${owner}[style*="${variable}:"]${suffix}{${property}:var(${variable})}`,
  ).join("\n");
}

/** EP 对多个日期／时间按钮编译了 outline:none；两种来源都只在所属实例补可见焦点。 */
function datePopperFocusCss(owner: string): string {
  return [
    `${owner} :is(.el-date-table, .el-month-table, .el-year-table) td:focus-visible .el-date-table-cell__text{outline:2px solid var(--fd-focus);outline-offset:1px}`,
    `${owner} :is(.el-date-picker__header-label, .el-picker-panel__icon-btn, .el-picker-panel__link-btn, .el-picker-panel__shortcut, .el-time-panel__btn, .el-button):focus-visible{outline:2px solid var(--fd-focus);outline-offset:3px}`,
  ].join("\n");
}

/** 品牌预设修复 EP 编译白色，并补齐周、时间与实际键盘焦点的配对状态。 */
export function brandDatePopperCss(owner: string): string {
  return [
    `${owner}{border-radius:var(--fd-radius)}`,
    `${owner} :is(.el-picker-panel, .el-time-panel){border-radius:var(--fd-radius)}`,
    `${owner}${CURRENT_TEXT}{color:var(--fd-on-primary);background-color:var(--fd-primary)}`,
    `${owner}${RANGE_TEXT}{color:var(--fd-on-primary);background-color:var(--fd-primary)}`,
    `${owner}${CURRENT_WEEK_CELL}{color:var(--fd-primary-ink);background-color:var(--fd-primary-soft)}`,
    `${owner}${CURRENT_WEEK_CELL}__text{color:var(--fd-primary-ink)}`,
    `${owner} .el-date-table td:is(.prev-month, .next-month, .week){color:var(--fd-muted)}`,
    `${owner} .el-time-spinner__item{color:var(--fd-secondary)}`,
    `${owner} .el-time-spinner__item.is-active:not(.is-disabled){color:var(--fd-primary-ink);background-color:var(--fd-primary-soft)}`,
    `${owner} .el-time-spinner__item.is-disabled{color:var(--fd-disabled-text)}`,
    `${owner} .el-picker-panel__shortcut.active{color:var(--fd-primary-ink);background-color:var(--fd-primary-soft)}`,
    datePopperFocusCss(owner),
    explicitDatePopperCss(owner),
  ].join("\n");
}

/**
 * 默认 Teleport 到 body 后面板读不到局部宿主变量；只映射实际可见 CSS 属性。
 * 日期选中文字继续保持 EP 编译白色，属于跟随宿主的原值例外，而非品牌配对。
 */
export function hostDatePopperCss(
  owner: string,
  host: HTMLElement,
  context: HostAppearanceContext,
): string {
  const styles = host.ownerDocument.defaultView?.getComputedStyle(host);
  const read = (name: string) => styles?.getPropertyValue(name).trim() || "";
  const border = read("--el-border-color-light") || context.border;
  const regular = read("--el-text-color-regular") || context.secondary;
  const primary = read("--el-color-primary") || context.primary;
  const secondary = read("--el-text-color-secondary") || context.secondary;
  const surface = read("--el-bg-color-overlay") || context.surface;
  const fallbacks: Record<string, string> = {
    "--el-border-radius-base": context.radius,
    "--el-popper-border-radius":
      read("--el-popper-border-radius") || read("--el-popover-border-radius") || context.radius,
    "--el-bg-color-overlay": surface,
    "--el-datepicker-bg-color": surface,
    "--el-border-color-light": border,
    "--el-timepicker-inner-border-color": border,
    "--el-datepicker-border-color": border,
    "--el-box-shadow-light": "none",
    "--el-font-family": context.fontFamily,
    "--el-text-color-regular": regular,
    "--el-datepicker-text-color": regular,
    "--el-text-color-primary": context.text,
    "--el-text-color-secondary": secondary,
    "--el-scrollbar-bg-color": secondary,
    "--el-scrollbar-hover-bg-color": secondary,
    "--el-text-color-placeholder": read("--el-text-color-placeholder") || context.disabledText,
    "--el-datepicker-off-text-color": read("--el-text-color-placeholder") || context.disabledText,
    "--el-color-primary": primary,
    "--el-datepicker-hover-text-color": primary,
    "--el-datepicker-active-color": primary,
    "--el-timepicker-active-color": primary,
    "--el-color-primary-light-3": context.primaryHover,
    "--el-color-white": context.onPrimary,
    "--el-fill-color-light": context.inset,
    "--el-datepicker-inrange-bg-color": read("--el-border-color-extra-light") || context.inset,
    "--el-datepicker-inrange-hover-bg-color": context.inset,
    "--el-datepicker-header-text-color": regular,
    "--el-border-color-lighter": border,
    "--el-datepicker-inner-border-color": border,
    "--el-datepicker-icon-color": read("--el-text-color-primary") || context.text,
    "--el-fill-color-darker": border,
    "--el-text-color-disabled": context.disabledText,
    "--el-fill-color-blank": surface,
  };
  const value = (name: string): string => {
    const sampled = read(name) || fallbacks[name];
    if (sampled === undefined) throw new Error(`未登记日期面板变量 ${name} 的宿主回退值`);
    return sampled;
  };
  const defaults = declarations(DATE_POPPER_PROPERTIES, value)
    .map(({ suffix, css }) => `${owner}${suffix}{${css}}`)
    .join("\n");
  // EP 2.14.6 的选中前景是编译常量而非变量；跟随宿主也须防止其他直接映射将其覆盖。
  const compiledSelectedForeground = [
    `${owner}${CURRENT_TEXT}{color:#fff}`,
    `${owner}${RANGE_TEXT}{color:#fff}`,
  ].join("\n");
  return [
    defaults,
    compiledSelectedForeground,
    datePopperFocusCss(owner),
    explicitDatePopperCss(owner),
  ].join("\n");
}
