export { default as DingtalkDesigner } from "./components/DingtalkDesigner.vue";
export { default as BpmnCanvas } from "./components/BpmnCanvas.vue";
export { exportXml } from "./export.js";
/**
 * 抄送节点插入时的收件人占位串（#25 评审 W4 单一出处；本 PR 评审 S-5 补导出）。
 * 宿主可经此常量识别 exportXml 抛错中的占位串（做 i18n / 用户引导），
 * 或自建导出前校验时对齐 designer 内置草稿扫描口径。
 * 内部 operations 函数仍按 spec R5 的接缝原则不外漏。
 */
export { CC_RECIPIENTS_PLACEHOLDER } from "./operations.js";
