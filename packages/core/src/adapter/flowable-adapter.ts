import type { EngineAdapter, TaskKind, TaskTypeMapping } from "./engine-adapter.js";

/**
 * flowable 命名空间与扩展属性的 moddle 描述符（XML 方言跨 6/7/8 基本稳定，ADR-0005）。
 *
 * ⚠ uri 必须是 http://flowable.org/bpmn（引擎常量 FLOWABLE_EXTENSIONS_NAMESPACE），
 * 官方文档写的 http://flowable.org/bpm 会让引擎读不到任何 flowable: 属性——
 * 部署校验报 missing-collection、assignee 运行时全丢且无报错（2026-09-20 原型
 * 部署+启动实例实锤，分支 prototype/iter2-vertical-layout-mi）。
 */
const flowablePackage = {
  name: "Flowable",
  uri: "http://flowable.org/bpmn",
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
