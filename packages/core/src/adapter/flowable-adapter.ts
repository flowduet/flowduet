import type { EngineAdapter, TaskKind, TaskTypeMapping } from "./engine-adapter.js";

/** flowable 命名空间与扩展属性的 moddle 描述符（XML 方言跨 6/7/8 基本稳定，ADR-0005） */
const flowablePackage = {
  name: "Flowable",
  uri: "http://flowable.org/bpm",
  prefix: "flowable",
  xml: { tagAlias: "lowerCase" },
  types: [
    {
      name: "UserTask",
      extends: ["bpmn:UserTask"],
      properties: [{ name: "assignee", isAttr: true, type: "String" }],
    },
    {
      name: "ServiceTask",
      extends: ["bpmn:ServiceTask"],
      properties: [{ name: "type", isAttr: true, type: "String" }],
    },
  ],
};

/**
 * Flowable 任务类型映射。
 * BPMN 2.0 没有邮件任务，Flowable 的邮件 = ServiceTask + flowable:type="mail"，
 * 这正是"任务类型映射"收敛点存在的理由：语义任务与方言形态解耦。
 */
const flowableTaskTypeMapping: Readonly<Record<TaskKind, TaskTypeMapping>> = {
  user: { elementType: "bpmn:UserTask" },
  service: { elementType: "bpmn:ServiceTask" },
  script: { elementType: "bpmn:ScriptTask" },
  mail: { elementType: "bpmn:ServiceTask", attributes: { type: "mail" } },
};

/** Flowable 6.8 基准的首个适配器实例（对准方言即一代覆盖 6.x–8.x） */
export const flowableAdapter: EngineAdapter = {
  id: "flowable",
  namespacePrefix: "flowable",
  additionalPackages: { flowable: flowablePackage },
  taskTypeMapping: flowableTaskTypeMapping,
};
