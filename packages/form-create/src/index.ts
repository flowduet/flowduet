/**
 * @flowduet/form-create 入口。
 *
 * 公开三层面向宿主的能力：
 * 1. 设计文档接口——saveDesignDocument / openDesignDocument 纯函数编解码；
 * 2. 组合编辑入口——FlowDesignSession 持有「模型 + 表单目录」整体状态，
 *    承载新建、保存、原子恢复与表单目录管理（创建/命名/内容编辑）；
 * 3. 表单装配组件——FormManager（管理面板）、FormDesigner（真实 FormCreate
 *    设计器封装，本票文本字段）、FormPreview（真实渲染器试填，与设计隔离）；
 *    组合部署导出 exportDeployXml 在流程校验外补表单引用完整性检查。
 * core 与 designer 保持零 FormCreate 依赖（ADR-0006）。
 */
import "@form-create/designer/src/style/index.css";

export {
  DESIGN_DOCUMENT_FORMAT,
  DESIGN_DOCUMENT_VERSION,
  DESIGN_DOCUMENT_ENGINE,
  saveDesignDocument,
  openDesignDocument,
} from "./document.js";
export type {
  FormDefinition,
  FlowDesignDocument,
  SaveDesignDocumentResult,
  OpenDesignDocumentResult,
} from "./document.js";
export { FlowDesignSession } from "./session.js";
export type { FlowDesignState, FlowDesignSessionInit, NewDesignOptions } from "./session.js";
export { collectReferenceIssues } from "./binding.js";
export { exportDeployXml } from "./export.js";
export { parseFormRules, parseFormOptions } from "./form-schema.js";
export type { FieldRule } from "./form-schema.js";
export { default as FormManager } from "./components/FormManager.vue";
export { default as FormDesigner } from "./components/FormDesigner.vue";
export { default as FormPreview } from "./components/FormPreview.vue";
