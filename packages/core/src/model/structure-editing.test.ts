import { describe, expect, it } from "vitest";
import type { ModdleElement } from "bpmn-moddle";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { BpmnModel } from "./bpmn-model.js";
import { compile } from "../compile/compiler.js";

function model() {
  const shape = { x: 0, y: 0, width: 100, height: 80 };
  const waypoints = [
    { x: 0, y: 0 },
    { x: 100, y: 80 },
  ];
  return BpmnModel.create({ processId: "rewire", adapter: flowableAdapter })
    .addExclusiveGateway({ id: "fork", shape })
    .addUserTask({ id: "a", shape })
    .addUserTask({ id: "b", shape })
    .addEndEvent({ id: "end", shape })
    .addSequenceFlow({
      id: "fa",
      sourceRef: "fork",
      targetRef: "a",
      name: "默认审批",
      default: true,
      waypoints,
    })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b", condition: "${ok}", waypoints })
    .addSequenceFlow({ id: "ae", sourceRef: "a", targetRef: "end", waypoints });
}
function refs(m: BpmnModel, id: string, prop: string) {
  return (m.elementOf(id).get(prop) as ModdleElement[]).map((el) => el.get("id"));
}
function plane(m: BpmnModel) {
  return (m.definitions.get("diagrams") as ModdleElement[])[0]!.get("plane") as ModdleElement;
}

describe("模型安全重接", () => {
  it("保留入边对象、默认引用、顺序；只废弃改接边的 DI", async () => {
    const m = model();
    await compile(m);
    const edge = m.elementOf("fa");
    const elements = [...(m.process.get("flowElements") as ModdleElement[])];
    const beforeDi = plane(m).get("planeElement") as ModdleElement[];
    const edgeDi = beforeDi.find((e) => e.get("bpmnElement") === edge)!;
    edgeDi.set("id", "arbitrary_route_name");
    const kept = beforeDi.filter((e) => e !== edgeDi);
    const bRoute = m.waypointsOf("fb");
    expect(m.retargetSequenceFlow("fa", "end")).toBe(m);
    expect(m.elementOf("fa")).toBe(edge);
    expect(edge.get("name")).toBe("默认审批");
    expect(m.elementOf("fork").get("default")).toBe(edge);
    expect(refs(m, "fork", "outgoing")).toEqual(["fa", "fb"]);
    expect(refs(m, "a", "incoming")).toEqual([]);
    expect(refs(m, "end", "incoming")).toEqual(["ae", "fa"]);
    elements.forEach((el, i) =>
      expect((m.process.get("flowElements") as ModdleElement[])[i]).toBe(el),
    );
    expect(() => m.waypointsOf("fa")).toThrow();
    expect(m.waypointsOf("fb")).toBe(bRoute);
    expect(plane(m).get("planeElement")).toEqual(kept);
  });

  it("保留完整条件对象，目标相同则连 DI 都不修改", async () => {
    const m = model();
    await compile(m);
    const edge = m.elementOf("fb");
    const expr = edge.get("conditionExpression") as ModdleElement;
    expr.set("language", "custom-language");
    const route = m.waypointsOf("fb");
    const before = await m.toXML();
    m.retargetSequenceFlow("fb", "b");
    expect(await m.toXML()).toEqual(before);
    expect(m.waypointsOf("fb")).toBe(route);
    m.retargetSequenceFlow("fb", "end");
    expect(edge.get("conditionExpression")).toBe(expr);
    expect(expr.get("language")).toBe("custom-language");
  });

  for (const bad of [
    "missing-flow",
    "missing-target",
    "flow-target",
    "self",
    "foreign-source",
    "missing-incoming",
    "duplicate-outgoing",
    "unregistered-flow",
    "non-node",
  ]) {
    it(`${bad} 拒绝且不写入`, async () => {
      const m = model();
      await compile(m);
      if (bad === "foreign-source") m.elementOf("fa").set("sourceRef", model().elementOf("fork"));
      if (bad === "missing-incoming") m.elementOf("a").set("incoming", []);
      if (bad === "duplicate-outgoing")
        (m.elementOf("fork").get("outgoing") as ModdleElement[]).push(m.elementOf("fa"));
      if (bad === "unregistered-flow")
        m.process.set(
          "flowElements",
          (m.process.get("flowElements") as ModdleElement[]).filter((e) => e !== m.elementOf("fa")),
        );
      if (bad === "non-node") {
        const data = m.moddle.create("bpmn:DataObjectReference", { id: "data" });
        (m.process.get("flowElements") as ModdleElement[]).push(data);
      }
      const current = bad === "non-node" ? BpmnModel.fromParsed(m.moddle, m.definitions) : m;
      const before = await current.toXML();
      const target =
        bad === "missing-target"
          ? "none"
          : bad === "flow-target"
            ? "fb"
            : bad === "self"
              ? "fork"
              : bad === "non-node"
                ? "data"
                : "end";
      expect(() =>
        current.retargetSequenceFlow(bad === "missing-flow" ? "none" : "fa", target),
      ).toThrow(/连线|端点|引用|流节点|自环/);
      expect(await current.toXML()).toEqual(before);
      expect(current.waypointsOf("fa")).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 80 },
      ]);
    });
  }

  it("级联删除同步清理所有图和历史 root 图，保留其他对象", async () => {
    const m = model();
    await compile(m);
    const first = plane(m);
    const second = m.moddle.create("bpmndi:BPMNPlane", {
      bpmnElement: m.process,
      planeElement: [...(first.get("planeElement") as ModdleElement[])],
    });
    const historical = m.moddle.create("bpmndi:BPMNDiagram", { id: "legacy", plane: second });
    (m.definitions.get("rootElements") as ModdleElement[]).push(historical);
    const removed = [m.elementOf("a"), m.elementOf("fa"), m.elementOf("ae")];
    m.removeNode("a");
    for (const p of [first, second]) {
      const remaining = p.get("planeElement") as ModdleElement[];
      expect(remaining.map((e) => (e.get("bpmnElement") as ModdleElement).get("id"))).toEqual([
        "fork",
        "b",
        "end",
        "fb",
      ]);
      expect(remaining.some((e) => removed.includes(e.get("bpmnElement") as ModdleElement))).toBe(
        false,
      );
    }
    expect(m.elementOf("fork").get("default")).toBeUndefined();
    expect(() => m.shapeOf("a")).toThrow();
    expect(() => m.waypointsOf("fa")).toThrow();
  });
});
