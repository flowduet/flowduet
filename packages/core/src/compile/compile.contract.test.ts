import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile } from "./compiler.js";
import { buildMinimalFlow } from "./__fixtures__/minimal-flow.js";
import { buildDefaultBranchFlow, buildParallelFlow } from "./__fixtures__/branching-flows.js";

/** 基准文件：手写意图，合法性由部署冒烟（ci issue）兜底 */
function readBaseline(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

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
});
