import { describe, expect, it } from "vitest";
import {
  BpmnModel,
  compile,
  flowableAdapter,
  parse,
  verticalDiLayout,
  type ModdleElement,
} from "@flowduet/core";
import { convertApprovalToMulti, removeApprovalNode } from "./operations.js";
import { resolveCanvasGeometry } from "./geometry.js";

function chain() {
  return BpmnModel.create({ processId: "geometry_edit", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addUserTask({ id: "a" })
    .addUserTask({ id: "b" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sa", sourceRef: "s", targetRef: "a" })
    .addSequenceFlow({ id: "ab", sourceRef: "a", targetRef: "b" })
    .addSequenceFlow({ id: "be", sourceRef: "b", targetRef: "e" });
}

describe("编辑后的完整 DI 与推导边界", () => {
  for (const initial of ["full", "none", "mixed"] as const) {
    it(`${initial} DI 转换保持几何来源，删除重接整图推导，导出到达新目标`, async () => {
      const m =
        initial === "none"
          ? chain()
          : await parse(await compile(chain(), { diLayout: verticalDiLayout() }), {
              adapter: flowableAdapter,
            });
      if (initial === "mixed") {
        m.removeSequenceFlow("be");
        m.addSequenceFlow({ id: "be", sourceRef: "b", targetRef: "e" });
      }
      const source = initial === "full" ? "registry" : "derived";
      expect(resolveCanvasGeometry(m).source).toBe(source);
      convertApprovalToMulti(m, "a", { collection: "people", mode: "all" });
      expect(resolveCanvasGeometry(m).source).toBe(source);
      const edge = m.elementOf("sa");
      removeApprovalNode(m, "a");
      expect(m.elementOf("sa")).toBe(edge);
      expect(resolveCanvasGeometry(m).source).toBe("derived");
      expect(() => m.waypointsOf("sa")).toThrow();
      const beforeFailure = await m.toXML();
      await expect(compile(m)).rejects.toThrow();
      expect(await m.toXML()).toEqual(beforeFailure);
      const xml = await compile(m, { diLayout: verticalDiLayout() });
      const restored = await parse(xml, { adapter: flowableAdapter });
      expect(restored.elementOf("sa").get("targetRef")).toBe(restored.elementOf("b"));
      const shape = restored.shapeOf("b");
      expect(restored.waypointsOf("sa").at(-1)).toEqual({
        x: shape.x + shape.width / 2,
        y: shape.y,
      });
      const di = (
        (restored.definitions.get("diagrams") as ModdleElement[])[0]!.get("plane") as ModdleElement
      ).get("planeElement") as ModdleElement[];
      expect(di.map((e) => (e.get("bpmnElement") as ModdleElement).get("id"))).toEqual([
        "s",
        "b",
        "e",
        "sa",
        "be",
      ]);
      expect(resolveCanvasGeometry(restored).source).toBe("registry");
    });
  }
});
