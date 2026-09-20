import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { BpmnModel } from "./bpmn-model.js";

/**
 * 模型编辑 API（#23 视图基座）：视图的增删改直接落在模型方法面（R4 决策），
 * removeSequenceFlow/removeNode 维护登记表与 moddle 树的一致性，
 * elementOf 是抽屉字段读写的访问器。
 */

function buildChain(): BpmnModel {
  return BpmnModel.create({ processId: "edit_chain", adapter: flowableAdapter })
    .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addUserTask({
      id: "t1",
      name: "一级审批",
      assignee: "${manager}",
      shape: { x: 140, y: 160, width: 100, height: 80 },
    })
    .addUserTask({
      id: "t2",
      name: "二级审批",
      assignee: "${director}",
      shape: { x: 140, y: 300, width: 100, height: 80 },
    })
    .addEndEvent({ id: "end", shape: { x: 172, y: 440, width: 36, height: 36 } })
    .addSequenceFlow({
      id: "f1",
      sourceRef: "start",
      targetRef: "t1",
      waypoints: [
        { x: 178, y: 96 },
        { x: 178, y: 160 },
      ],
    })
    .addSequenceFlow({
      id: "f2",
      sourceRef: "t1",
      targetRef: "t2",
      waypoints: [
        { x: 190, y: 240 },
        { x: 190, y: 300 },
      ],
    })
    .addSequenceFlow({
      id: "f3",
      sourceRef: "t2",
      targetRef: "end",
      waypoints: [
        { x: 190, y: 380 },
        { x: 190, y: 440 },
      ],
    });
}

function flowElements(model: BpmnModel): { id: string; type: string }[] {
  const elements = (model.process.get("flowElements") as { get(key: string): unknown }[]) ?? [];
  return elements.map((el) => ({ id: el.get("id") as string, type: String(el.get("$type")) }));
}

describe("removeSequenceFlow", () => {
  it("从流程、双向引用与登记表移除，id 可复用", () => {
    const model = buildChain();
    model.removeSequenceFlow("f2");
    expect(flowElements(model).map((el) => el.id)).not.toContain("f2");
    // 双向引用同步清理
    const t1 = model.elementOf("t1");
    const outgoing = (t1.get("outgoing") as { get(key: string): unknown }[]) ?? [];
    expect(outgoing.map((f) => f.get("id"))).toEqual([]);
    const t2 = model.elementOf("t2");
    const incoming = (t2.get("incoming") as { get(key: string): unknown }[]) ?? [];
    expect(incoming.map((f) => f.get("id"))).toEqual([]);
    // 登记表已释放：同 id 可重新登记
    expect(() =>
      model.addSequenceFlow({
        id: "f2",
        sourceRef: "t1",
        targetRef: "t2",
        waypoints: [
          { x: 190, y: 240 },
          { x: 190, y: 300 },
        ],
      }),
    ).not.toThrow();
  });

  it("清理指向该连线的网关 default 引用", () => {
    const model = BpmnModel.create({ processId: "edit_default", adapter: flowableAdapter })
      .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
      .addExclusiveGateway({ id: "fork", shape: { x: 165, y: 160, width: 50, height: 50 } })
      .addEndEvent({ id: "end_a", shape: { x: 250, y: 300, width: 36, height: 36 } })
      .addEndEvent({ id: "end_b", shape: { x: 100, y: 300, width: 36, height: 36 } })
      .addSequenceFlow({
        id: "f_in",
        sourceRef: "start",
        targetRef: "fork",
        waypoints: [
          { x: 178, y: 96 },
          { x: 190, y: 160 },
        ],
      })
      .addSequenceFlow({
        id: "f_a",
        sourceRef: "fork",
        targetRef: "end_a",
        condition: "${ok}",
        waypoints: [
          { x: 215, y: 185 },
          { x: 268, y: 300 },
        ],
      })
      .addSequenceFlow({
        id: "f_b",
        sourceRef: "fork",
        targetRef: "end_b",
        default: true,
        waypoints: [
          { x: 165, y: 185 },
          { x: 118, y: 300 },
        ],
      });
    model.removeSequenceFlow("f_b");
    expect(model.elementOf("fork").get("default")).toBeUndefined();
  });

  it("未知连线 id 抛错", () => {
    expect(() => buildChain().removeSequenceFlow("nope")).toThrow(/连线 nope 不存在/);
  });
});

describe("removeNode", () => {
  it("级联删除关联连线并清理登记表", () => {
    const model = buildChain();
    model.removeNode("t1");
    const ids = flowElements(model).map((el) => el.id);
    expect(ids).not.toContain("t1");
    expect(ids).not.toContain("f1");
    expect(ids).not.toContain("f2");
    expect(ids).toContain("t2");
    // 登记表同步：shapeOf 不再有 t1
    expect(() => model.shapeOf("t1")).toThrow(/没有画布形状|不存在/);
  });

  it("未知节点 id 抛错", () => {
    expect(() => buildChain().removeNode("nope")).toThrow(/节点 nope 不存在/);
  });
});

describe("elementOf", () => {
  it("节点与连线都取得到，字段写直达模型树", async () => {
    const model = buildChain();
    model.elementOf("t1").set("name", "改判审批");
    const xml = await compile(model);
    expect(xml).toContain('name="改判审批"');
    expect(model.elementOf("f2").get("sourceRef")).toBeDefined();
  });

  it("未知元素 id 抛错", () => {
    expect(() => buildChain().elementOf("nope")).toThrow(/元素 nope 不存在/);
  });
});
