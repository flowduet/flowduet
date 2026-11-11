// 与 2026-11-09 版本准备复审补齐的七项公开合同对应；新增合同须同步驱动与清单。
export const requiredRuntime = [
  { id: "external-control", name: "external 受控选择、焦点、结构请求及零模型写入" },
  { id: "capture-reentrancy", name: "同步捕获重入屏障" },
  { id: "field-lifetime", name: "字段删除重建不继承旧输入" },
  { id: "designer-mode", name: "FormDesigner 模式固定" },
  { id: "late-header-close", name: "旧页头迟到 DOM 事件不关闭新会话" },
  { id: "late-confirm-close", name: "旧关闭确认迟到不消费新会话授权" },
  { id: "manager-mode", name: "FormManager 双向模式拒绝及 legacy 提交" },
];
