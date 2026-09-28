import type { Config } from "@form-create/designer/types/index.d";

/**
 * 设计器收口配置（#74）：与 form-schema 守卫同一开放范围口径。
 * 单独成模块便于测试直接断言「菜单只有开放组件、范围外能力无 UI 入口」，
 * 不必依赖设计器内部 DOM 结构。
 */

/**
 * 菜单列表整体覆盖（name 对应 DragRule 的 name，icon 为包内样式类）。
 * 注意多行文本是 textarea DragRule：产出 type 仍为 input + props.type=textarea。
 * 类型上须保持可变（FcDesigner 的 menu prop 按 MenuList 可变类型约定）。
 */
export const FIELD_MENU = [
  {
    name: "main",
    title: "常用字段",
    list: [
      { label: "文本", name: "input", icon: "icon-input" },
      { label: "多行文本", name: "textarea", icon: "icon-textarea" },
      { label: "数字", name: "inputNumber", icon: "icon-number" },
      { label: "单选", name: "radio", icon: "icon-radio" },
      { label: "多选", name: "checkbox", icon: "icon-checkbox" },
      { label: "下拉单选", name: "select", icon: "icon-select" },
      { label: "日期", name: "datePicker", icon: "icon-date" },
      { label: "开关", name: "switch", icon: "icon-switch" },
    ],
  },
  {
    name: "layout",
    title: "布局",
    list: [{ label: "栅格布局", name: "fcRow", icon: "icon-row" }],
  },
];

/** 收口配置：范围外能力的 UI 入口逐一关闭 */
export const DESIGNER_CONFIG: Config = {
  // 不接入 AI 助理（Pro 能力红线，ADR-0006）
  showAi: false,
  // 验证面板只保留必填：字段配置面就是「选项 + 默认值 + 必填」
  validateOnlyRequired: true,
  showSaveBtn: false,
  showDevice: false,
  showLanguage: false,
  // 脚本入口：事件配置（FnEditor 写函数）不开放——组件事件面板与
  // 表单级事件配置（onSubmit 等）一并关闭
  showEventForm: false,
  hiddenFormConfig: ["formCreate_event"],
  // 数据录入入口不开放（设计态不往表单里手工录业务数据）
  showInputData: false,
  // 联动与自定义组件配置不开放
  showControl: false,
  showCustomProps: false,
  // 选项类型选择器整体隐藏：静态选项编辑（TableOptions）默认在场，
  // 「远程数据 / 文本 / json」分支无从切换，远程数据源不能通过 UI 新建；
  // _control（组件联动）与 showControl 双保险，选中字段后入口不渲染
  hiddenItemConfig: {
    default: ["_optionType", "_control"],
    select: ["multiple", "multipleLimit", "remote", "remoteMethod"],
    datePicker: ["type"],
  },
  // 栅格布局只允许顶层：checkDrag 仅在「拖入已有容器」时被调用，
  // 对 fcRow 一律拒绝即可杜绝布局嵌套（顶层拖入不走此钩子）
  checkDrag: ({ menu }) => menu.name !== "fcRow",
};
