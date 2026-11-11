import type { EngineAdapter } from "./engine-adapter.js";

/**
 * 项目绑定协议扩展包（ADR-0009 决策 5）：
 * bpmn:Process 上的 `flowduet:defaultFormKey` 保存流程默认表单引用，
 * 命名空间 URI 固定 `urn:flowduet:bpmn`。
 *
 * 描述符由创建（BpmnModel.create）与解析（parse）路径统一注册，与引擎
 * 适配器扩展包合并；未使用该属性的既有 XML 不受影响（moddle 只序列化
 * 实际用到的扩展属性，编译基准逐字一致的合同继续成立）。
 */
export const FLOWDUET_PREFIX = "flowduet";
export const FLOWDUET_NAMESPACE_URI = "urn:flowduet:bpmn";

const flowduetPackage = {
  name: "FlowDuet",
  uri: FLOWDUET_NAMESPACE_URI,
  prefix: FLOWDUET_PREFIX,
  xml: { tagAlias: "lowerCase" },
  types: [
    {
      name: "Process",
      extends: ["bpmn:Process"],
      properties: [{ name: "defaultFormKey", isAttr: true, type: "String" }],
    },
  ],
};

/**
 * 适配器扩展包 + 项目绑定描述符的合并出口（创建与解析共用）。
 * `flowduet` 前缀是项目保留命名空间：适配器若已占用同名前缀，其方言
 * 属性将与绑定协议混叠、序列化时静默丢失其中一方——在此明确拒绝合并。
 */
export function packagesWithFlowduet(adapter: EngineAdapter): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...adapter.additionalPackages };
  if (Object.hasOwn(merged, FLOWDUET_PREFIX)) {
    throw new Error(
      `适配器 ${adapter.id} 的扩展包已占用前缀 "${FLOWDUET_PREFIX}"（项目绑定协议命名空间 ${FLOWDUET_NAMESPACE_URI} 保留），拒绝合并`,
    );
  }
  merged[FLOWDUET_PREFIX] = flowduetPackage;
  return merged;
}
