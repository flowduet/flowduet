import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { BpmnModel } from "./bpmn-model.js";

/**
 * 多实例审批任务（会签/或签/依次）的建模 API 语义与守卫。
 * 三档 XML 形态经原型在 Flowable 6.8 部署 + 启动 + 逐人 assignee 实测
 *（分支 prototype/iter2-vertical-layout-mi），形态断言见编译合同。
 */

const SHAPE = { x: 140, y: 160, width: 100, height: 80 };

function createModel(): BpmnModel {
  return BpmnModel.create({ processId: "approval_api", adapter: flowableAdapter });
}

describe("addApprovalTask 守卫（三档固化，不开放覆盖）", () => {
  it("依次审批传完成条件覆盖即抛错", () => {
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: "chain",
        mode: "sequential",
        shape: SHAPE,
        completionCondition: "${nrOfCompletedInstances >= 1}",
      }),
    ).toThrow(/依次审批没有完成条件/);
  });

  it("会签/或签传完成条件覆盖即抛错（三档固化）", () => {
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: "approvers",
        mode: "all",
        shape: SHAPE,
        completionCondition: "${nrOfCompletedInstances >= 2}",
      }),
    ).toThrow(/不开放覆盖/);
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: "approvers",
        mode: "any",
        shape: SHAPE,
        completionCondition: "${nrOfCompletedInstances >= 2}",
      }),
    ).toThrow(/不开放覆盖/);
  });

  it("集合表达式与元素变量不能为空白", () => {
    expect(() =>
      createModel().addApprovalTask({ id: "t", collection: "  ", mode: "all", shape: SHAPE }),
    ).toThrow(/collection 不能为空白/);
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: "approvers",
        mode: "all",
        shape: SHAPE,
        elementVariable: " ",
      }),
    ).toThrow(/elementVariable 不能为空白/);
  });

  it("mode 非法值（绕过 TS 类型）即抛错，不静默落盘", () => {
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: "approvers",
        // 模拟 JS 调用方或 as any 绕过类型约束
        mode: "bogus" as unknown as "all",
        shape: SHAPE,
      }),
    ).toThrow(/mode 必须是 all\/any\/sequential 之一/);
  });

  it("collection 缺省（绕过 TS 类型）报语义化错误而非裸 TypeError", () => {
    expect(() =>
      createModel().addApprovalTask({
        id: "t",
        collection: undefined as unknown as string,
        mode: "all",
        shape: SHAPE,
      }),
    ).toThrow(/collection 不能为空白/);
  });

  it("collection/elementVariable 前后空白 trim 后落盘（引擎按变量名解析，带空格会静默取不到值）", async () => {
    const xml = await compile(
      createModel().addApprovalTask({
        id: "t",
        collection: "  approvers  ",
        mode: "all",
        shape: SHAPE,
        elementVariable: "  reviewer  ",
      }),
    );
    expect(xml).toContain('flowable:collection="approvers"');
    expect(xml).toContain('flowable:elementVariable="reviewer"');
    expect(xml).toContain('flowable:assignee="${reviewer}"');
  });
});

describe("addApprovalTask 语义", () => {
  it("默认元素变量 assignee：任务按 ${assignee} 逐实例指派", async () => {
    const xml = await compile(
      createModel().addApprovalTask({
        id: "counter_sign",
        collection: "approvers",
        mode: "all",
        shape: SHAPE,
      }),
    );
    expect(xml).toContain('flowable:assignee="${assignee}"');
    expect(xml).toContain('flowable:elementVariable="assignee"');
  });

  it("自定义元素变量贯穿指派表达式与元素变量属性", async () => {
    const xml = await compile(
      createModel().addApprovalTask({
        id: "review",
        collection: "reviewers",
        mode: "any",
        shape: SHAPE,
        elementVariable: "reviewer",
      }),
    );
    expect(xml).toContain('flowable:assignee="${reviewer}"');
    expect(xml).toContain('flowable:elementVariable="reviewer"');
  });

  it("解析恢复的树同样能继续建模多实例任务（注册表可用）", async () => {
    const { parse } = await import("../parse/parser.js");
    const xml = await compile(
      createModel().addApprovalTask({
        id: "solo",
        collection: "approvers",
        mode: "all",
        shape: SHAPE,
      }),
    );
    const restored = await parse(xml, { adapter: flowableAdapter });
    expect(() =>
      restored.addApprovalTask({
        id: "another",
        collection: "approvers",
        mode: "any",
        shape: SHAPE,
      }),
    ).not.toThrow();
  });
});
