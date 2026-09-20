import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile } from "./compiler";
import { buildMinimalFlow } from "./__fixtures__/minimal-flow";

/** 基准文件：手写意图，合法性由部署冒烟（ci issue）兜底 */
const baseline = readFileSync(
  new URL("./__fixtures__/minimal-flow.flowable68.baseline.xml", import.meta.url),
  "utf8",
);

describe("编译合同（Flowable 6.8 方言）", () => {
  it("最小流程输出与基准文件逐字一致", async () => {
    const xml = await compile(buildMinimalFlow());
    expect(xml).toBe(baseline);
  });
});
