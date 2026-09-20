import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { BpmnModel } from "../model/bpmn-model.js";
import { deriveBlockTree, verticalDiLayout } from "./vertical-layout.js";
import { buildVerticalScenario } from "./__fixtures__/vertical-scenario.js";

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
    expect(block.branches[0][0].kind).toBe("block");
    if (block.branches[0][0].kind === "block") {
      expect(block.branches[0][0].gateway).toBe("parallel");
      expect(block.branches[0][0].branches).toHaveLength(3);
    }
    expect(block.branches[1].some((n) => n.kind === "block")).toBe(true);
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
      shapes.push({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] });
    }
    expect(shapes).toHaveLength(16); // 16 个节点全有 DI
    const waypointCount = (xml.match(/<di:waypoint/g) ?? []).length;
    expect(waypointCount).toBeGreaterThanOrEqual(19 * 2); // 19 条连线各至少 2 点
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i];
        const b = shapes[j];
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

  it("场景产物与落盘 XML 同步（推导确定性 + 冒烟部署载体）", async () => {
    const xml = await compile(buildVerticalScenario(), { diLayout: verticalDiLayout() });
    expect(xml).toBe(
      readFileSync(new URL("./__fixtures__/vertical-scenario.xml", import.meta.url), "utf8"),
    );
  });
});
