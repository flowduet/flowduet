import { describe, expect, it } from "vitest";
import { BpmnModel, compile, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { convertApprovalToMulti, convertMultiToSingle, readApprovalMulti } from "./operations.js";
import { resolveCanvasGeometry } from "./geometry.js";

function chain() {
  const shape = { x: 10, y: 20, width: 100, height: 80 };
  const waypoints = [
    { x: 10, y: 20 },
    { x: 10, y: 100 },
  ];
  return BpmnModel.create({ processId: "preserve", adapter: flowableAdapter })
    .addStartEvent({ id: "s", shape })
    .addUserTask({ id: "a", name: "审批", assignee: "alice", formKey: "form_1", shape })
    .addEndEvent({ id: "e", shape })
    .addSequenceFlow({ id: "in", sourceRef: "s", targetRef: "a", waypoints })
    .addSequenceFlow({ id: "out", sourceRef: "a", targetRef: "e", waypoints });
}

describe("审批转换保持存续身份", () => {
  for (const mode of ["all", "any", "sequential"] as const) {
    it(`${mode} 往返保留引用、任务扩展和完整 DI`, async () => {
      const m = chain();
      const task = m.elementOf("a");
      const extension = m.moddle.create("bpmn:ExtensionElements");
      task.set("extensionElements", extension);
      task.set("documentation", [m.moddle.create("bpmn:Documentation", { text: "业务说明" })]);
      const elements = [...(m.process.get("flowElements") as ModdleElement[])];
      const shape = m.shapeOf("a");
      const route = m.waypointsOf("in");
      await compile(m);
      const diagrams = m.definitions.get("diagrams");
      convertApprovalToMulti(m, "a", { collection: " people ", mode, elementVariable: " person " });
      expect(m.elementOf("a")).toBe(task);
      expect(readApprovalMulti(m, "a")).toEqual({
        collection: "people",
        mode,
        elementVariable: "person",
      });
      expect(task.get("assignee")).toBe("${person}");
      convertMultiToSingle(m, "a");
      expect(task.get("loopCharacteristics")).toBeUndefined();
      expect(task.get("assignee")).toBeUndefined();
      expect(task.get("formKey")).toBe("form_1");
      expect(task.get("extensionElements")).toBe(extension);
      expect((task.get("documentation") as ModdleElement[])[0]?.get("text")).toBe("业务说明");
      const after = m.process.get("flowElements") as ModdleElement[];
      expect(after).toHaveLength(elements.length);
      elements.forEach((el, i) => expect(after[i]).toBe(el));
      expect(m.shapeOf("a")).toBe(shape);
      expect(m.waypointsOf("in")).toBe(route);
      expect(m.definitions.get("diagrams")).toBe(diagrams);
      expect(resolveCanvasGeometry(m).source).toBe("registry");
      await expect(compile(m)).resolves.toContain('id="in"');
    });
  }

  it("普通空集合拒绝且显式草稿允许，不改变形态以外字段", async () => {
    const m = chain();
    const before = await m.toXML();
    expect(() => convertApprovalToMulti(m, "a", { collection: "", mode: "all" })).toThrow();
    expect(await m.toXML()).toEqual(before);
    convertApprovalToMulti(m, "a", { collection: "", mode: "all" }, { allowIncomplete: true });
    expect(readApprovalMulti(m, "a")?.collection).toBe("");
    expect(m.elementOf("in").get("targetRef")).toBe(m.elementOf("a"));
  });

  for (const extra of [
    "loopCardinality",
    "extensionElements",
    "unknown:flag",
    "completion-language",
    "standard-loop",
    "custom-condition",
  ]) {
    it(`拒绝抹除 ${extra} 且不写入`, async () => {
      const m = chain();
      convertApprovalToMulti(m, "a", { collection: "people", mode: "all" });
      const task = m.elementOf("a");
      const loop = task.get("loopCharacteristics") as ModdleElement;
      if (extra === "standard-loop")
        task.set("loopCharacteristics", m.moddle.create("bpmn:StandardLoopCharacteristics"));
      else if (extra === "completion-language")
        (loop.get("completionCondition") as ModdleElement).set("language", "custom");
      else if (extra === "custom-condition")
        (loop.get("completionCondition") as ModdleElement).set("body", "${custom}");
      else if (extra === "loopCardinality")
        loop.set(extra, m.moddle.create("bpmn:FormalExpression", { body: "3" }));
      else if (extra === "extensionElements")
        loop.set(extra, m.moddle.create("bpmn:ExtensionElements"));
      else loop.set(extra, "keep");
      const before = await m.toXML();
      expect(() => convertMultiToSingle(m, "a")).toThrow(/不支持|固化/);
      expect(m.elementOf("a")).toBe(task);
      expect(await m.toXML()).toEqual(before);
    });
  }
});
