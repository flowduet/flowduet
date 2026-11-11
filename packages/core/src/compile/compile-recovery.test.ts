import { describe, expect, it, vi } from "vitest";
import type { ModdleElement } from "bpmn-moddle";
import { BpmnModel } from "../model/bpmn-model.js";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { verticalDiLayout } from "../layout/vertical-layout.js";
import { compile } from "./compiler.js";

function build() {
  return BpmnModel.create({ processId: "recover_di", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addUserTask({ id: "a" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sa", sourceRef: "s", targetRef: "a" })
    .addSequenceFlow({ id: "ae", sourceRef: "a", targetRef: "e" });
}

describe("编译失败恢复调用前 DI", () => {
  for (const kind of ["identity", "serialization"] as const) {
    it(`${kind} 失败恢复原容器和序列化内容`, async () => {
      const m = build();
      await compile(m, { diLayout: verticalDiLayout() });
      const oldDiagrams = m.definitions.get("diagrams") as ModdleElement[];
      const oldRoots = m.definitions.get("rootElements") as ModdleElement[];
      const legacy = m.moddle.create("bpmndi:BPMNDiagram", { id: "legacy" });
      oldRoots.push(legacy);
      const before = await m.toXML();
      // 只替换外部序列化失败这一边界，布局与 DI 写入仍执行真实代码。
      if (kind === "serialization")
        vi.spyOn(m, "toXML").mockRejectedValueOnce(new Error("serialize failed"));
      await expect(
        compile(m, kind === "identity" ? {} : { diLayout: verticalDiLayout() }),
      ).rejects.toThrow();
      expect(m.definitions.get("diagrams")).toBe(oldDiagrams);
      expect(m.definitions.get("rootElements")).toBe(oldRoots);
      expect(await m.toXML()).toEqual(before);
    });
  }
  it("成功仍替换而不是重复追加 DI，自动布局不会回填登记表", async () => {
    const m = build();
    const first = await compile(m, { diLayout: verticalDiLayout() });
    const second = await compile(m, { diLayout: verticalDiLayout() });
    expect(second).toBe(first);
    expect(m.definitions.get("diagrams")).toHaveLength(1);
    expect(() => m.shapeOf("a")).toThrow();
  });
});
