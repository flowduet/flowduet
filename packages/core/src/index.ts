/**
 * @flowduet/core 入口。
 *
 * 导出的都是 ROADMAP 声明的接缝：BpmnModel（moddle 树包装）/ Compiler /
 * DiLayout / 引擎适配器。冒烟版本号供集成方做健康检查。
 */
export const CORE_VERSION = "0.1.2" as const;

export {
  APPROVAL_MODES,
  COMPLETION_CONDITIONS,
  DEFAULT_ELEMENT_VARIABLE,
  BpmnModel,
} from "./model/bpmn-model.js";
export type {
  ApprovalMode,
  ApprovalTaskSpec,
  BpmnModelSpec,
  CanvasShape,
  CcTaskSpec,
  NodeSpec,
  Point,
  SequenceFlowSpec,
  TaskSpec,
  UserTaskSpec,
} from "./model/bpmn-model.js";

export { IdentityDiLayout } from "./layout/di-layout.js";
export type { DiLayout } from "./layout/di-layout.js";
export {
  deriveBlockTree,
  deriveVerticalGeometry,
  verticalDiLayout,
} from "./layout/vertical-layout.js";
export type { BlockTreeNode, LayoutResult } from "./layout/vertical-layout.js";

export { compile } from "./compile/compiler.js";
export type { CompileOptions } from "./compile/compiler.js";

export { parse } from "./parse/parser.js";
export type { ParseOptions } from "./parse/parser.js";

export { flowableAdapter } from "./adapter/flowable-adapter.js";
export { assertAdapterContract } from "./adapter/adapter-contract.js";
export { TASK_KINDS } from "./adapter/engine-adapter.js";
export type { EngineAdapter, TaskKind, TaskTypeMapping } from "./adapter/engine-adapter.js";
/** moddle 元素类型：elementOf 等编辑访问器的返回契约（见 bpmn-moddle） */
export type { ModdleElement } from "bpmn-moddle";
