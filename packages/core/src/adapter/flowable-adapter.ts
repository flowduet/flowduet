/**
 * Flowable 引擎适配器 v0。
 *
 * 正式的适配器接口与合同测试在适配器合同 issue 中固化；
 * 当前只包含编译合同所需的最小扩展属性：用户任务的 flowable:assignee。
 * flowable XML 方言（命名空间 + 扩展属性）跨 6/7/8 基本稳定（ADR-0005）。
 */

export interface EngineAdapter {
  /** 适配器标识（引擎方言名） */
  readonly id: string;
  /**
   * 注入 bpmn-moddle 的扩展包描述符：方言命名空间与扩展属性 schema。
   * 这是 ADR-0005 "适配器三收敛点" 中前两点的物理载体。
   */
  readonly additionalPackages: Record<string, unknown>;
}

/** flowable 命名空间与扩展属性的 moddle 描述符 */
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
  ],
};

export const flowableAdapter: EngineAdapter = {
  id: "flowable",
  additionalPackages: { flowable: flowablePackage },
};
