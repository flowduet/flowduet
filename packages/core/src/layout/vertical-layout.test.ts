import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { BpmnModel } from "../model/bpmn-model.js";
import type { BlockTreeNode } from "./vertical-layout.js";
import { deriveBlockTree, verticalDiLayout } from "./vertical-layout.js";
import { buildVerticalScenario } from "./__fixtures__/vertical-scenario.js";

/** 测试断言的非空收敛（前置 expect 已保证存在，此断言仅为类型收窄服务） */
function nonNull<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`测试断言失败：${what}不应为空`);
  return value;
}

/**
 * 竖排布局器与可选几何（#22，原型 prototype/iter2-vertical-layout-mi 的正式化）：
 * 钉钉式纵向编辑天然无画布坐标——shape/waypoints 可选化后，
 * 无坐标建模经 verticalDiLayout 推导几何落 DI；恒等布局遇缺坐标诚实抛错。
 * deriveBlockTree 是钉钉式递归组件与坐标推导共用的读视图（公开导出）。
 */

describe("deriveBlockTree：图 → 块结构树", () => {
  it("条件/并行多层嵌套结构正确", () => {
    const tree = deriveBlockTree(buildVerticalScenario());
    // 顶层主链：开始、发起、外层条件块、结束
    expect(tree.filter((n) => n.kind === "element")).toHaveLength(3);
    const block = tree.find((n) => n.kind === "block");
    expect(block).toBeDefined();
    if (block?.kind !== "block") throw new Error("unreachable");
    expect(block.gateway).toBe("exclusive");
    expect(block.branches).toHaveLength(2);
    // 支 1 首项是并行块；支 2 含嵌套条件块
    const branch0 = nonNull(block.branches[0], "支 1");
    const branch1 = nonNull(block.branches[1], "支 2");
    const firstOfBranch0: BlockTreeNode = nonNull(branch0[0], "支 1 首项");
    expect(firstOfBranch0.kind).toBe("block");
    if (firstOfBranch0.kind === "block") {
      expect(firstOfBranch0.gateway).toBe("parallel");
      expect(firstOfBranch0.branches).toHaveLength(3);
    }
    expect(branch1.some((n) => n.kind === "block")).toBe(true);
  });

  it("反例：分支不收敛（撞 end）显式抛错", () => {
    const model = BpmnModel.create({ processId: "bad_shape", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addExclusiveGateway({ id: "fork" })
      .addEndEvent({ id: "end1" })
      .addEndEvent({ id: "end2" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "fork" })
      .addSequenceFlow({ id: "f2", sourceRef: "fork", targetRef: "end1" })
      .addSequenceFlow({ id: "f3", sourceRef: "fork", targetRef: "end2" });
    expect(() => deriveBlockTree(model)).toThrow(/未良构收敛/);
  });

  it("反例：交错收敛（内外层分支交叉汇合）显式抛错", () => {
    // fork1 的支 A 直落内层 join2（跨块），fork2 的支 D 也落 join2、支 C 落外层
    // join1——两组 fork/join 交叉配对，任何 fork 的分支都收敛不到同一个 join
    const model = BpmnModel.create({ processId: "cross_join", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addExclusiveGateway({ id: "fork1" })
      .addUserTask({ id: "t1", name: "外层支A" })
      .addUserTask({ id: "t2", name: "外层支B" })
      .addExclusiveGateway({ id: "fork2" })
      .addUserTask({ id: "t3", name: "内层支C" })
      .addUserTask({ id: "t4", name: "内层支D" })
      .addExclusiveGateway({ id: "join1" })
      .addExclusiveGateway({ id: "join2" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "fork1" })
      .addSequenceFlow({ id: "f2", sourceRef: "fork1", targetRef: "t1" })
      .addSequenceFlow({ id: "f3", sourceRef: "fork1", targetRef: "t2" })
      .addSequenceFlow({ id: "f4", sourceRef: "t1", targetRef: "join2" })
      .addSequenceFlow({ id: "f5", sourceRef: "t2", targetRef: "fork2" })
      .addSequenceFlow({ id: "f6", sourceRef: "fork2", targetRef: "t3" })
      .addSequenceFlow({ id: "f7", sourceRef: "fork2", targetRef: "t4" })
      .addSequenceFlow({ id: "f8", sourceRef: "t3", targetRef: "join1" })
      .addSequenceFlow({ id: "f9", sourceRef: "t4", targetRef: "join2" })
      .addSequenceFlow({ id: "f10", sourceRef: "join2", targetRef: "join1" })
      .addSequenceFlow({ id: "f11", sourceRef: "join1", targetRef: "end" });
    expect(() => deriveBlockTree(model)).toThrow(/未良构收敛/);
  });

  it("反例：循环结构（任务间回跳）显式抛错，不挂死", () => {
    // t1 → t2 → t1 构成单入单出回环，无 visited 守卫时 walkChain 无限循环
    const model = BpmnModel.create({ processId: "loop_back", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "t1", name: "起草" })
      .addUserTask({ id: "t2", name: "复核" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "t2" })
      .addSequenceFlow({ id: "f3", sourceRef: "t2", targetRef: "t1" });
    expect(() => deriveBlockTree(model)).toThrow(/不支持循环结构/);
  });

  it("反例：fork 直连 join 的空分支显式抛错（含分支序号）", () => {
    // fork 的第 2 条分支直达 join，分支链为空——布局阶段无从落位
    const model = BpmnModel.create({ processId: "empty_branch", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addParallelGateway({ id: "fork" })
      .addUserTask({ id: "t1", name: "并行支" })
      .addParallelGateway({ id: "join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "fork" })
      .addSequenceFlow({ id: "f2", sourceRef: "fork", targetRef: "t1" })
      .addSequenceFlow({ id: "f3", sourceRef: "fork", targetRef: "join" })
      .addSequenceFlow({ id: "f4", sourceRef: "t1", targetRef: "join" })
      .addSequenceFlow({ id: "f5", sourceRef: "join", targetRef: "end" });
    expect(() => deriveBlockTree(model)).toThrow(/第 2 条分支为空/);
  });
});

describe("可选几何与竖排布局", () => {
  it("无坐标建模 + 恒等布局：诚实抛错（缺画布形状）", async () => {
    const model = BpmnModel.create({ processId: "no_shape", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "end" });
    await expect(compile(model)).rejects.toThrow(/没有画布形状/);
  });

  it("无坐标建模 + verticalDiLayout：推导几何、投影 bpmndi", async () => {
    const xml = await compile(buildVerticalScenario(), { diLayout: verticalDiLayout() });
    expect(xml).toContain("<bpmndi:BPMNDiagram");

    // DI 段回读几何做两两不重叠断言（重叠面积必须为 0，允许边贴合）
    const shapes: { x: number; y: number; width: number; height: number }[] = [];
    const boundsRe =
      /<dc:Bounds x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" \/>/g;
    let m: RegExpExecArray | null;
    while ((m = boundsRe.exec(xml)) !== null) {
      shapes.push({
        x: +nonNull(m[1], "bounds x"),
        y: +nonNull(m[2], "bounds y"),
        width: +nonNull(m[3], "bounds width"),
        height: +nonNull(m[4], "bounds height"),
      });
    }
    expect(shapes).toHaveLength(16); // 16 个节点全有 DI
    const waypointCount = (xml.match(/<di:waypoint/g) ?? []).length;
    expect(waypointCount).toBeGreaterThanOrEqual(19 * 2); // 19 条连线各至少 2 点
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = nonNull(shapes[i], `形状 ${i}`);
        const b = nonNull(shapes[j], `形状 ${j}`);
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(
          overlapX <= 0 || overlapY <= 0,
          `形状重叠: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
        ).toBe(true);
      }
    }
  });

  it("竖排产物幂等：同模型两次编译逐字一致（推导确定性）", async () => {
    const model = buildVerticalScenario();
    const first = await compile(model, { diLayout: verticalDiLayout() });
    const second = await compile(model, { diLayout: verticalDiLayout() });
    expect(second).toBe(first);
  });

  it("无 waypoints 的连线经恒等布局：诚实抛错（缺画布折线）", async () => {
    const model = BpmnModel.create({ processId: "no_waypoints", adapter: flowableAdapter })
      .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
      .addEndEvent({ id: "end", shape: { x: 160, y: 200, width: 36, height: 36 } })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "end" });
    await expect(compile(model)).rejects.toThrow(/没有画布折线/);
  });

  it("反例：从开始事件不可达的孤立节点显式抛错（拒绝半残 DI）", async () => {
    // orphan 不在主链可达范围内，块树不覆盖它——静默投影会产出空 Bounds
    const model = BpmnModel.create({ processId: "unreachable", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "t1", name: "主链任务" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "orphan", name: "孤立任务" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    await expect(compile(model, { diLayout: verticalDiLayout() })).rejects.toThrow(
      /元素 orphan 不在块树中/,
    );
  });

  it("场景产物与落盘 XML 同步（推导确定性 + 冒烟部署载体）", async () => {
    const xml = await compile(buildVerticalScenario(), { diLayout: verticalDiLayout() });
    expect(xml).toBe(
      readFileSync(new URL("./__fixtures__/vertical-scenario.xml", import.meta.url), "utf8"),
    );
  });
});
