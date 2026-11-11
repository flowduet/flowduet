import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "../model/bpmn-model.js";
import type { CanvasShape, Point } from "../model/bpmn-model.js";
import { pushMany } from "../util/moddle-utils.js";

/**
 * DI 布局接缝（ROADMAP 接缝之一）：
 * 把画布几何投影成 bpmndi 段并挂到模型树上。
 * 两个实现：恒等布局（建模坐标直映射）与竖排布局器（钉钉式推导）。
 */
export interface DiLayout {
  attach(model: BpmnModel): void;
}

/** 把几何投影成 bpmndi 段并挂到模型树（两个 DiLayout 实现共用的出口） */
export function projectDiagram(
  model: BpmnModel,
  geometry: { shapes: Map<string, CanvasShape>; waypoints: Map<string, Point[]> },
): void {
  const { moddle, process } = model;
  const processId = process.get("id") as string;
  const plane = moddle.create("bpmndi:BPMNPlane", {
    id: `${processId}_plane`,
    bpmnElement: process,
  });
  const diagram = moddle.create("bpmndi:BPMNDiagram", {
    id: `${processId}_di`,
    plane,
  });

  const flowElements = process.get("flowElements") as ModdleElement[] | undefined;
  for (const element of flowElements ?? []) {
    const id = element.get("id") as string;
    if (element.$type === "bpmn:SequenceFlow") {
      const edge = moddle.create("bpmndi:BPMNEdge", {
        id: `${id}_di`,
        bpmnElement: element,
        // 内置 di 包的 waypoint 属性类型是 dc:Point（序列化时带 xsi:type）
        waypoint: (geometry.waypoints.get(id) ?? []).map((point) =>
          moddle.create("dc:Point", point),
        ),
      });
      pushMany(plane, "planeElement", edge);
    } else {
      const shape = moddle.create("bpmndi:BPMNShape", {
        id: `${id}_di`,
        bpmnElement: element,
        bounds: moddle.create("dc:Bounds", geometry.shapes.get(id)),
      });
      pushMany(plane, "planeElement", shape);
    }
  }

  // diagrams 是 BPMNDiagram 的规范归宿（moddle 元模型里它不是 bpmn:RootElement）
  pushMany(model.definitions, "diagrams", diagram);
}

/**
 * v0 恒等布局：建模时登记的画布坐标/折线直映射为 bpmndi。
 * 不发明任何坐标——那是自动布局器的职责；缺坐标在此诚实抛错。
 */
export class IdentityDiLayout implements DiLayout {
  attach(model: BpmnModel): void {
    const shapes = new Map<string, CanvasShape>();
    const waypoints = new Map<string, Point[]>();
    const flowElements = (model.process.get("flowElements") as ModdleElement[]) ?? [];
    for (const element of flowElements) {
      const id = element.get("id") as string;
      if (element.$type === "bpmn:SequenceFlow") {
        waypoints.set(id, model.waypointsOf(id));
      } else {
        shapes.set(id, model.shapeOf(id));
      }
    }
    projectDiagram(model, { shapes, waypoints });
  }
}
