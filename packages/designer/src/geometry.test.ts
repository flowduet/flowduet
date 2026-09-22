import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { edgeArrowPoints, edgePolylinePoints, resolveCanvasGeometry } from "./geometry.js";

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
});

describe("边几何（折线与箭头）", () => {
  const source = { x: 0, y: 0 };
  const target = { x: 100, y: 100 };

  it("waypoints ≥2 直用；否则退化为直线", () => {
    const wps = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];
    expect(edgePolylinePoints(wps, source, target)).toBe(wps);
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
});
