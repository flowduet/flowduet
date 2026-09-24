/**
 * @flowduet/form-create 入口（迭代三 #71 最小形态）。
 *
 * 公开两层面向宿主的能力：
 * 1. 设计文档接口——saveDesignDocument / openDesignDocument 纯函数编解码；
 * 2. 组合编辑入口——FlowDesignSession 持有「模型 + 表单目录」整体状态，
 *    承载新建、保存与原子恢复。
 * 表单设计与 FormCreate 装配由后续票在本包扩展，core / designer 保持零
 * FormCreate 依赖（ADR-0006）。
 */
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
