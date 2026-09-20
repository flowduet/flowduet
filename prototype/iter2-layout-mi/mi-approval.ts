import type { EngineAdapter } from "../../packages/core/src/adapter/engine-adapter.js";
import { flowableAdapter } from "../../packages/core/src/adapter/flowable-adapter.js";
import { pushMany } from "../../packages/core/src/util/moddle-utils.js";
import type { BpmnModel } from "../../packages/core/src/model/bpmn-model.js";
import type { ModdleElement } from "bpmn-moddle";

/**
 * [PROTOTYPE] 迭代二问题 B:多实例用户任务 API 草样(throwaway)。
 *
 * 三档 XML 落法(Flowable 6.8 Docker 实测,部署 + 启动 + assignee 逐人验证):
 *   userTask@flowable:assignee="${元素变量}"
 *   + multiInstanceLoopCharacteristics[@isSequential, @flowable:collection,
 *     @flowable:elementVariable] + completionCondition(非串行档)。
 *
 * ⚠ 关键坑(本轮最大发现):Flowable 6.8 引擎读方言属性的命名空间是
 *   http://flowable.org/bpmn(见引擎常量 FLOWABLE_EXTENSIONS_NAMESPACE),
 *   而官方文档写 http://flowable.org/bpm——后者会让所有 flowable: 属性静默失联:
 *   部署校验报 missing-collection,assignee/elementVariable 运行时全丢。
 *   正式适配器(flowable-adapter.ts)与基准文件正是错误 URI——迭代一冒烟
 *   只断言"部署注册"从未启动实例,缺陷潜伏。折回项(见 README)。
 *
 * 结论折回 docs/specs/iteration-2/multi-instance-user-task.md 待细化 1–3。
 */

/** 完成方式三档:会签(全员) / 或签(任一) / 依次(按序逐人)——CONTEXT.md 已入册术语 */
export type ApprovalMode = "all" | "any" | "sequential";

/** 单实例内引用"当前审批人"的元素变量默认名 */
export const DEFAULT_ELEMENT_VARIABLE = "assignee";

/** 内核按档固化的完成条件(Flowable 多实例内置变量) */
export const COMPLETION_CONDITIONS: Readonly<Record<"all" | "any", string>> = {
  all: "${nrOfCompletedInstances == nrOfInstances}",
  any: "${nrOfCompletedInstances >= 1}",
};

/**
 * 修正版 flowable 扩展包:命名空间钉引擎常量(bpmn 后缀),
 * 并为多实例补 collection / elementVariable 两个方言属性。
 * ⚠ 正式 flowable-adapter.ts 需同步此修正(折回项一)。
 */
export const prototypeFlowableAdapter: EngineAdapter = {
  ...flowableAdapter,
  additionalPackages: {
    flowable: {
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
        {
          name: "MultiInstanceLoopCharacteristics",
          extends: ["bpmn:MultiInstanceLoopCharacteristics"],
          properties: [
            { name: "collection", isAttr: true, type: "String" },
            { name: "elementVariable", isAttr: true, type: "String" },
          ],
        },
      ],
    },
  },
};

/** 多实例用户任务建模 spec(候选内核 API) */
export interface ApprovalTaskSpec {
  id: string;
  name?: string;
  /** 审批人集合表达式,如 "approvers"(裸变量名,运行时流程变量注入) */
  collection: string;
  /** 完成方式三档 */
  mode: ApprovalMode;
  /** 实例元素变量名(任务内引用当前审批人),默认 "assignee" */
  elementVariable?: string;
  /**
   * 覆盖固化的完成条件表达式——原型对照面:有它 vs 没它,API 的"诚实度"差异。
   * sequential 档语义上没有完成条件(逐人跑完即通过),传了应当报错。
   */
  completionCondition?: string;
}

/**
 * 候选内核 API:多实例用户任务建模。
 * 若进内核,形态为 BpmnModel.addApprovalTask(spec)(this 返回,链式);
 * 原型以函数形态摆调用面——同时是反例证据:绕过 addXxx 的元素不在
 * BpmnModel 私有注册表里,addSequenceFlow 的端点校验直接拒绝,
 * 外挂函数形态不成立,必须进内核方法面。
 */
export function addApprovalTask(model: BpmnModel, spec: ApprovalTaskSpec): BpmnModel {
  const { moddle, process } = model;

  if (spec.mode === "sequential" && spec.completionCondition !== undefined) {
    throw new Error(`任务 ${spec.id}:依次审批没有完成条件(逐人跑完即通过),不允许覆盖`);
  }

  const elementVariable = spec.elementVariable ?? DEFAULT_ELEMENT_VARIABLE;
  const task: ModdleElement = moddle.create("bpmn:UserTask", { id: spec.id, name: spec.name });
  // per-instance 指派:每个实例解析元素变量取当前审批人(Flowable 标准组合)
  task.set("assignee", `\${${elementVariable}}`);

  const loop = moddle.create("bpmn:MultiInstanceLoopCharacteristics", {
    isSequential: spec.mode === "sequential",
  });
  // Flowable 方言属性(命名空间修正后实测:部署 + 启动 + 逐人 assignee 全通过)
  loop.set("collection", spec.collection);
  loop.set("elementVariable", elementVariable);

  const condition =
    spec.completionCondition ??
    (spec.mode === "sequential" ? undefined : COMPLETION_CONDITIONS[spec.mode]);
  if (condition !== undefined) {
    loop.set("completionCondition", moddle.create("bpmn:FormalExpression", { body: condition }));
  }

  task.set("loopCharacteristics", loop);
  pushMany(process, "flowElements", task);
  return model;
}

/**
 * 连线草样:与 BpmnModel.addSequenceFlow 同构,但绕过注册表校验——
 * 只因本原型试图以"外部函数"形态挂多实例任务,才需要它(见上,反例证据)。
 */
export function prototypeAddFlow(
  model: BpmnModel,
  spec: { id: string; sourceRef: string; targetRef: string; condition?: string },
): BpmnModel {
  const { moddle, process } = model;
  const flowElements = process.get("flowElements") as ModdleElement[];
  const byId = new Map(flowElements.map((el) => [el.get("id") as string, el]));
  const source = byId.get(spec.sourceRef);
  const target = byId.get(spec.targetRef);
  if (source === undefined || target === undefined) {
    throw new Error(`草样连线端点不存在:${spec.sourceRef} → ${spec.targetRef}`);
  }
  const flow = moddle.create("bpmn:SequenceFlow", { id: spec.id });
  flow.set("sourceRef", source);
  flow.set("targetRef", target);
  if (spec.condition !== undefined) {
    flow.set(
      "conditionExpression",
      moddle.create("bpmn:FormalExpression", { body: spec.condition }),
    );
  }
  pushMany(source, "outgoing", flow);
  pushMany(target, "incoming", flow);
  pushMany(process, "flowElements", flow);
  return model;
}

/**
 * 反例对照:loopCardinality 落法(固定人数)。
 * 钉钉式选人是动态列表,集合表达式才同构;且 cardinality 在 BPMN 元模型里是
 * Expression 元素(set 字符串直接序列化崩溃),拿不到 per-instance 审批人。
 */
export function addCardinalityApprovalTask(
  model: BpmnModel,
  spec: { id: string; name?: string; count: number; mode: ApprovalMode },
): BpmnModel {
  const { moddle, process } = model;
  const task = moddle.create("bpmn:UserTask", { id: spec.id, name: spec.name });
  const loop = moddle.create("bpmn:MultiInstanceLoopCharacteristics", {
    isSequential: spec.mode === "sequential",
  });
  loop.set("loopCardinality", moddle.create("bpmn:Expression", { body: String(spec.count) }));
  const condition = spec.mode === "sequential" ? undefined : COMPLETION_CONDITIONS[spec.mode];
  if (condition !== undefined) {
    loop.set("completionCondition", moddle.create("bpmn:FormalExpression", { body: condition }));
  }
  task.set("loopCharacteristics", loop);
  pushMany(process, "flowElements", task);
  return model;
}
