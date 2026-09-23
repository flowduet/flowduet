import type { BpmnModel, CanvasShape, Point } from "@flowduet/core";
import type { ModdleElement } from "@flowduet/core";
import { deriveVerticalGeometry } from "@flowduet/core";

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
  // 缺坐标：竖排推导。与 compile 的 verticalDiLayout 共用 deriveVerticalGeometry
  // ——同一推导链、同一可达性守卫：不可达图形在画布与导出两侧一致显式抛错，
  // 不由画布静默丢图（消除「画布吞掉、导出拒绝」的不对称）。
  const derived = deriveVerticalGeometry(model);
  return { shapes: derived.shapes, waypoints: derived.waypoints, source: "derived" };
}

/**
 * 边折线：waypoints ≥2 时返回其副本，否则退化为 source→target 直线。
 * 返回副本而非入参数组引用——本函数是公开纯函数，调用方对结果 push/sort
 * 不得回写污染模型内核的 waypoints 注册表。
 */
export function edgePolylinePoints(
  waypoints: Point[] | undefined,
  source: Point,
  target: Point,
): Point[] {
  if (waypoints !== undefined && waypoints.length >= 2) return [...waypoints];
  return [source, target];
}

/** 终点箭头（三角三顶点）：沿最后一段走向，边 SVG 与图坐标同空间可直接用 */
export function edgeArrowPoints(
  waypoints: Point[] | undefined,
  source: Point,
  target: Point,
): Point[] {
  const list = edgePolylinePoints(waypoints, source, target);
  // edgePolylinePoints 保证 list.length >= 2，末点（箭头尖端）恒存在
  const tip = list[list.length - 1] as Point;
  // 从末端回溯最近的不重合点定朝向：末段退化（相邻点重合）时不能取零长度段，
  // 否则三顶点坍缩成不可见点（静默缺箭头）；全部重合时保留水平默认朝向。
  let ux = 1;
  let uy = 0;
  for (let i = list.length - 2; i >= 0; i--) {
    const p = list[i] as Point;
    const dx = tip.x - p.x;
    const dy = tip.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      ux = dx / len;
      uy = dy / len;
      break;
    }
  }
  const size = 7;
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  return [
    tip,
    { x: base.x - uy * size * 0.45, y: base.y + ux * size * 0.45 },
    { x: base.x + uy * size * 0.45, y: base.y - ux * size * 0.45 },
  ];
}
