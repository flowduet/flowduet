import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile } from "./compiler.js";
import { buildMinimalFlow } from "./__fixtures__/minimal-flow.js";
import { buildMiFlow } from "./__fixtures__/mi-flow.js";
import { buildDefaultBranchFlow, buildParallelFlow } from "./__fixtures__/branching-flows.js";
import { APPROVAL_MODES } from "../model/bpmn-model.js";
import type { ApprovalMode } from "../model/bpmn-model.js";

/** 基准文件：手写意图，合法性由部署冒烟（ci issue）兜底 */
function readBaseline(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

/** 多实例三档基准（形态与原型 6.8 实测产物对应，含 DI） */
const MI_BASELINES = Object.fromEntries(
  APPROVAL_MODES.map((mode) => [
    mode,
    readFileSync(
      new URL(`./__fixtures__/mi-${mode}.flowable68.baseline.xml`, import.meta.url),
      "utf8",
    ),
  ]),
) as Readonly<Record<ApprovalMode, string>>;

describe("编译合同（Flowable 6.8 方言）", () => {
  it("最小流程输出与基准文件逐字一致", async () => {
    const xml = await compile(buildMinimalFlow());
    expect(xml).toBe(readBaseline("minimal-flow.flowable68.baseline.xml"));
  });

  it("并行分裂-汇合输出与基准文件逐字一致", async () => {
    const xml = await compile(buildParallelFlow());
    expect(xml).toContain('<bpmn:parallelGateway id="fork"');
    expect(xml).toContain('<bpmn:parallelGateway id="join"');
    expect(xml).toBe(readBaseline("parallel-flow.flowable68.baseline.xml"));
  });

  it("带默认分支的排他网关输出与基准文件逐字一致", async () => {
    const xml = await compile(buildDefaultBranchFlow());
    // 默认流转落网关 default 引用属性（无条件的「其余情况」分支）
    expect(xml).toContain(
      '<bpmn:exclusiveGateway id="decision" name="是否同意" default="flow_rejected">',
    );
    expect(xml).toBe(readBaseline("default-branch.flowable68.baseline.xml"));
  });

  describe("多实例审批三档", () => {
    it("会签（all）：非串行 + 全员完成条件，与基准逐字一致", async () => {
      const xml = await compile(buildMiFlow("all"));
      expect(xml).toContain("nrOfCompletedInstances == nrOfInstances");
      expect(xml).not.toContain("isSequential");
      expect(xml).toBe(MI_BASELINES.all);
    });

    it("或签（any）：非串行 + 任一完成条件，与基准逐字一致", async () => {
      const xml = await compile(buildMiFlow("any"));
      expect(xml).toContain("nrOfCompletedInstances &gt;= 1");
      expect(xml).not.toContain("isSequential");
      expect(xml).toBe(MI_BASELINES.any);
    });

    it("依次审批（sequential）：串行标记且无完成条件，与基准逐字一致", async () => {
      const xml = await compile(buildMiFlow("sequential"));
      expect(xml).toContain('isSequential="true"');
      expect(xml).not.toContain("completionCondition");
      expect(xml).toBe(MI_BASELINES.sequential);
    });
  });
});
