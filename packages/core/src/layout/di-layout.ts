import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "../model/bpmn-model";
import { pushMany } from "../util/moddle-utils";

/**
 * DI 布局接缝（ROADMAP 接缝之一）：
 * 把画布几何投影成 bpmndi 段并挂到模型树上。
 * 钉钉式视图导出时替换为自动布局器（Step 3 起实现）。
 */
export interface DiLayout {
  attach(model: BpmnModel): void;
}

/**
 * v0 恒等布局：建模时登记的画布坐标/折线直映射为 bpmndi。
 * 不发明任何坐标——那是自动布局器的职责。
 */
export class IdentityDiLayout implements DiLayout {
  attach(model: BpmnModel): void {
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
          waypoint: model.waypointsOf(id).map((point) => moddle.create("dc:Point", point)),
        });
        pushMany(plane, "planeElement", edge);
      } else {
        const shape = moddle.create("bpmndi:BPMNShape", {
          id: `${id}_di`,
          bpmnElement: element,
          bounds: moddle.create("dc:Bounds", model.shapeOf(id)),
        });
        pushMany(plane, "planeElement", shape);
      }
    }

    // diagrams 是 BPMNDiagram 的规范归宿（moddle 元模型里它不是 bpmn:RootElement）
    pushMany(model.definitions, "diagrams", diagram);
  }
}
