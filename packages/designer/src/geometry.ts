import type { BpmnModel, CanvasShape, Point } from "@flowduet/core";
import type { ModdleElement } from "@flowduet/core";
import { deriveBlockTree, layoutVertical } from "@flowduet/core";

/**
 * 只读投影的几何来源（#26）：优先直读 DI 登记表（shapeOf/waypointsOf
 * 零计算映射）；任一元素缺坐标（钉钉式零坐标建模）则全图走竖排布局
 * 推导——与 XML 导出同源，保证画布呈现与导出一致（互切零转换）。
 * 不做混搭：两套坐标拼一图必然错位，整图取一个来源。
 */

export interface CanvasGeometry {
  shapes: Map<string, CanvasShape>;
  waypoints: Map<string, Point[]>;
  /** registry = 登记表直读；derived = 竖排推导（与导出同源） */
  source: "registry" | "derived";
}

export function resolveCanvasGeometry(model: BpmnModel): CanvasGeometry {
  const flowElements = (model.process.get("flowElements") as ModdleElement[]) ?? [];
  const shapes = new Map<string, CanvasShape>();
  const waypoints = new Map<string, Point[]>();
  let complete = true;

  for (const element of flowElements) {
    const id = element.get("id") as string;
    if (element.$type === "bpmn:SequenceFlow") {
      try {
        waypoints.set(id, model.waypointsOf(id));
      } catch {
        complete = false;
      }
    } else {
      try {
        shapes.set(id, model.shapeOf(id));
      } catch {
        complete = false;
      }
    }
  }

  if (complete) {
    return { shapes, waypoints, source: "registry" };
  }
  // 缺坐标：竖排推导（与 compile 的 verticalDiLayout 同一推导链）
  const flows = new Map<string, { source: string; target: string }>();
  for (const element of flowElements) {
    if (element.$type !== "bpmn:SequenceFlow") continue;
    flows.set(element.get("id") as string, {
      source: (element.get("sourceRef") as ModdleElement).get("id") as string,
      target: (element.get("targetRef") as ModdleElement).get("id") as string,
    });
  }
  const tree = deriveBlockTree(model);
  const derived = layoutVertical(tree, flows);
  return { shapes: derived.shapes, waypoints: derived.waypoints, source: "derived" };
}

/** 边折线：waypoints ≥2 直用，否则退化为 source→target 直线 */
export function edgePolylinePoints(
  waypoints: Point[] | undefined,
  source: Point,
  target: Point,
): Point[] {
  if (waypoints !== undefined && waypoints.length >= 2) return waypoints;
  return [source, target];
}

/** 终点箭头（三角三顶点）：沿最后一段走向，边 SVG 与图坐标同空间可直接用 */
export function edgeArrowPoints(
  waypoints: Point[] | undefined,
  source: Point,
  target: Point,
): Point[] {
  const list = edgePolylinePoints(waypoints, source, target);
  const tip = list[list.length - 1] as Point;
  const prev = (list[list.length - 2] ?? source) as Point;
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 7;
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  return [
    tip,
    { x: base.x - uy * size * 0.45, y: base.y + ux * size * 0.45 },
    { x: base.x + uy * size * 0.45, y: base.y - ux * size * 0.45 },
  ];
}
