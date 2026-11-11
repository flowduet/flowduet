import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import {
  edgeArrowPoints,
  edgePolylinePoints,
  initialCanvasViewport,
  resolveCanvasGeometry,
} from "./geometry.js";

/**
 * 只读投影的几何来源（#26）：优先直读 DI 登记表（shapeOf/waypointsOf
 * 零计算映射）；任一元素缺坐标（钉钉式零坐标建模）则全图走竖排布局
 * 推导——与 XML 导出同源，保证画布呈现与导出一致（spec：互切零转换）。
 */

describe("resolveCanvasGeometry", () => {
  it("全坐标建模：直读登记表", () => {
    const model = BpmnModel.create({ processId: "geo_full", adapter: flowableAdapter })
      .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
      .addEndEvent({ id: "end", shape: { x: 172, y: 200, width: 36, height: 36 } })
      .addSequenceFlow({
        id: "f1",
        sourceRef: "start",
        targetRef: "end",
        waypoints: [
          { x: 178, y: 96 },
          { x: 190, y: 218 },
        ],
      });
    const geo = resolveCanvasGeometry(model);
    expect(geo.source).toBe("registry");
    expect(geo.shapes.get("start")).toEqual({ x: 160, y: 60, width: 36, height: 36 });
    expect(geo.waypoints.get("f1")).toHaveLength(2);
  });

  it("零坐标建模：全图竖排推导（与导出同源），元素齐备", () => {
    const model = BpmnModel.create({ processId: "geo_none", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "t1", name: "审批" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    const geo = resolveCanvasGeometry(model);
    expect(geo.source).toBe("derived");
    expect(geo.shapes.size).toBe(3);
    expect(geo.waypoints.size).toBe(2);
    // 纵向排布：start 在 t1 上方
    expect(geo.shapes.get("start")!.y).toBeLessThan(geo.shapes.get("t1")!.y);
  });

  it("混合坐标（部分缺）：回退全图推导保持整图一致", () => {
    const model = BpmnModel.create({ processId: "geo_mixed", adapter: flowableAdapter })
      .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
      .addUserTask({ id: "t1" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    const geo = resolveCanvasGeometry(model);
    expect(geo.source).toBe("derived");
    expect(geo.shapes.size).toBe(3);
  });

  it("不可达孤立元素：竖排推导显式抛错，与导出同口径（W-1）", () => {
    // orphan 不在从开始事件可达的主链上，块树不覆盖它；缺坐标 → 走推导 → 守卫拒绝。
    // 与 core verticalDiLayout 的反例（拒绝半残 DI）同一口径，画布不再静默丢图。
    const model = BpmnModel.create({ processId: "geo_orphan", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "t1", name: "主链任务" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "orphan", name: "孤立任务" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    expect(() => resolveCanvasGeometry(model)).toThrow(/元素 orphan 不在块树中/);
  });
});

describe("BPMN 初始视角", () => {
  it("保持可读缩放并将流程顶部放在画布留白内", () => {
    const geometry = {
      shapes: new Map([
        ["start", { x: 160, y: 40, width: 36, height: 36 }],
        ["task", { x: 120, y: 136, width: 100, height: 80 }],
      ]),
      waypoints: new Map(),
      source: "registry" as const,
    };
    expect(initialCanvasViewport(geometry, 800)).toEqual({ x: 196, y: -24, zoom: 1.2 });
  });

  it("宽流程保留文字可读的最小缩放，空画布尺寸不计算视角", () => {
    const geometry = {
      shapes: new Map([["wide", { x: 0, y: 40, width: 1200, height: 80 }]]),
      waypoints: new Map(),
      source: "registry" as const,
    };
    expect(initialCanvasViewport(geometry, 800)?.zoom).toBe(1.1);
    expect(initialCanvasViewport(geometry, 0)).toBeNull();
  });
});

describe("边几何（折线与箭头）", () => {
  const source = { x: 0, y: 0 };
  const target = { x: 100, y: 100 };

  it("waypoints ≥2 返回副本；否则退化为直线", () => {
    const wps = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];
    // S-1：返回等值副本而非入参引用，杜绝调用方变异回写模型注册表
    const result = edgePolylinePoints(wps, source, target);
    expect(result).toEqual(wps);
    expect(result).not.toBe(wps);
    expect(edgePolylinePoints(undefined, source, target)).toEqual([source, target]);
    expect(edgePolylinePoints([{ x: 1, y: 1 }], source, target)).toEqual([source, target]);
  });

  it("箭头尖端落在最后一段走向上，且为三顶点", () => {
    const wps = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    const arrow = edgeArrowPoints(wps, source, { x: 100, y: 100 });
    expect(arrow).toHaveLength(3);
    // 无 waypoints：沿 source→target 直线方向
    const arrowStraight = edgeArrowPoints(undefined, source, target);
    expect(arrowStraight[0]).toEqual(target);
  });

  it("末段退化（相邻点重合）：箭头回溯上一段定向，不坍缩为不可见点（S-3）", () => {
    // 末两点重合：方向须回溯到 {0,0}→{100,0} 段，而非取零长度段
    const wps = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
    ];
    const arrow = edgeArrowPoints(wps, source, { x: 100, y: 0 });
    expect(arrow).toHaveLength(3);
    // 三顶点不全重合 → 有可见面积（未坍缩成点）
    const collapsed = arrow.every((p) => p.x === arrow[0]!.x && p.y === arrow[0]!.y);
    expect(collapsed).toBe(false);
  });
});
