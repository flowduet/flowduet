/**
 * @flowduet/core 入口。
 *
 * 导出的都是 ROADMAP 声明的接缝：BpmnModel（moddle 树包装）/ Compiler /
 * DiLayout / 引擎适配器。冒烟版本号供集成方做健康检查。
 */
export const CORE_VERSION = "0.0.0" as const;

export { BpmnModel } from "./model/bpmn-model";
export type {
  BpmnModelSpec,
  CanvasShape,
  NodeSpec,
  Point,
  SequenceFlowSpec,
  TaskSpec,
  UserTaskSpec,
} from "./model/bpmn-model";

export { IdentityDiLayout } from "./layout/di-layout";
export type { DiLayout } from "./layout/di-layout";

export { compile } from "./compile/compiler";
export type { CompileOptions } from "./compile/compiler";

export { parse } from "./parse/parser";
export type { ParseOptions } from "./parse/parser";

export { flowableAdapter } from "./adapter/flowable-adapter";
export { assertAdapterContract } from "./adapter/adapter-contract";
export { TASK_KINDS } from "./adapter/engine-adapter";
export type { EngineAdapter, TaskKind, TaskTypeMapping } from "./adapter/engine-adapter";
