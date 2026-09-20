/**
 * 引擎适配器合同接口（ADR-0005）。
 *
 * 内核只面向标准 BPMN；引擎差异收敛为三点：命名空间前缀、扩展属性
 * schema、任务类型映射。适配器无引擎运行时依赖——产物是 XML。
 * 机器可验收形式见 adapter-contract.ts 的 assertAdapterContract。
 */

/** 引擎中立的任务种类（v1 元素集的任务面；ADR-0004 的钉钉式节点最终也落到这里） */
export type TaskKind = "user" | "service" | "script" | "mail" | "cc";

export const TASK_KINDS: readonly TaskKind[] = ["user", "service", "script", "mail", "cc"];

/** 语义任务种类 → 方言任务形态 */
export interface TaskTypeMapping {
  /** BPMN 元素类型，如 "bpmn:UserTask" */
  readonly elementType: string;
  /** 创建任务后必须设置的方言属性（键为扩展包内属性名，序列化时带方言前缀） */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface EngineAdapter {
  /** 方言标识（同时是 moddle 扩展包前缀） */
  readonly id: string;
  /** 合同点一：命名空间前缀（扩展属性的 xmlns 前缀） */
  readonly namespacePrefix: string;
  /** 合同点二：扩展属性 schema（moddle 扩展包描述符，必须以前缀为键注册） */
  readonly additionalPackages: Record<string, unknown>;
  /** 合同点三：任务类型映射 */
  readonly taskTypeMapping: Readonly<Record<TaskKind, TaskTypeMapping>>;
}
