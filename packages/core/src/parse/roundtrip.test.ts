import { describe, expect, it } from "vitest";
import type { ModdleElement } from "bpmn-moddle";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { BpmnModel } from "../model/bpmn-model.js";
import { compile } from "../compile/compiler.js";
import { parse } from "./parser.js";
import { buildMinimalFlow } from "../compile/__fixtures__/minimal-flow.js";
import { buildMiFlow } from "../compile/__fixtures__/mi-flow.js";
import { APPROVAL_MODES } from "../model/bpmn-model.js";

/**
 * 往返保真（ROADMAP Step 1 测试链 2，全项目最高优先级不变量，ADR-0002）：
 * parse(xml) → model → compile() 语义等价。
 * 本项目产出的 XML 是规范形，语义等价用逐字一致来表达（最严格判定）。
 */

async function roundTrip(build: () => BpmnModel): Promise<{ first: string; second: string }> {
  const first = await compile(build());
  const second = await compile(await parse(first, { adapter: flowableAdapter }));
  return { first, second };
}

describe("往返保真（parse → model → compile 语义等价）", () => {
  it("最小流程往返逐字一致", async () => {
    const { first, second } = await roundTrip(buildMinimalFlow);
    expect(second).toBe(first);
  });

  it("compile 幂等：同一模型重复编译逐字一致", async () => {
    const model = buildMinimalFlow();
    expect(await compile(model)).toBe(await compile(model));
  });

  it("变体：分支交换（条件与名称互换）往返逐字一致", async () => {
    const build = (): BpmnModel => {
      const model = buildMinimalFlow();
      rewriteCondition(model, "flow_approved", "拒绝", "${!approved}");
      rewriteCondition(model, "flow_rejected", "同意", "${approved}");
      return model;
    };
    const { first, second } = await roundTrip(build);
    expect(second).toBe(first);
  });

  it("变体：线性流程（无网关）往返逐字一致", async () => {
    const build = (): BpmnModel =>
      BpmnModel.create({
        processId: "linear_flow",
        processName: "线性流程",
        adapter: flowableAdapter,
      })
        .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
        .addUserTask({
          id: "solo_approval",
          name: "唯一审批",
          assignee: "${boss}",
          shape: { x: 140, y: 160, width: 100, height: 80 },
        })
        .addEndEvent({ id: "end", shape: { x: 172, y: 300, width: 36, height: 36 } })
        .addSequenceFlow({
          id: "f1",
          sourceRef: "start",
          targetRef: "solo_approval",
          waypoints: [
            { x: 178, y: 96 },
            { x: 178, y: 160 },
          ],
        })
        .addSequenceFlow({
          id: "f2",
          sourceRef: "solo_approval",
          targetRef: "end",
          waypoints: [
            { x: 190, y: 240 },
            { x: 190, y: 300 },
          ],
        });
    const { first, second } = await roundTrip(build);
    expect(second).toBe(first);
  });

  it("变体：审批链加签（同意分支追加总监任务）往返逐字一致", async () => {
    const build = (): BpmnModel =>
      BpmnModel.create({
        processId: "leave_approval",
        processName: "请假审批",
        adapter: flowableAdapter,
      })
        .addStartEvent({
          id: "start",
          name: "开始",
          shape: { x: 160, y: 60, width: 36, height: 36 },
        })
        .addUserTask({
          id: "manager_approval",
          name: "经理审批",
          assignee: "${manager}",
          shape: { x: 140, y: 160, width: 100, height: 80 },
        })
        .addExclusiveGateway({
          id: "decision",
          name: "是否同意",
          shape: { x: 165, y: 290, width: 50, height: 50 },
        })
        .addUserTask({
          id: "director_approval",
          name: "总监审批",
          assignee: "${director}",
          shape: { x: 218, y: 380, width: 100, height: 80 },
        })
        .addEndEvent({
          id: "end_approved",
          name: "同意归档",
          shape: { x: 250, y: 520, width: 36, height: 36 },
        })
        .addEndEvent({
          id: "end_rejected",
          name: "拒绝结束",
          shape: { x: 100, y: 400, width: 36, height: 36 },
        })
        .addSequenceFlow({
          id: "flow_start_approve",
          sourceRef: "start",
          targetRef: "manager_approval",
          waypoints: [
            { x: 178, y: 96 },
            { x: 178, y: 160 },
          ],
        })
        .addSequenceFlow({
          id: "flow_approve_decision",
          sourceRef: "manager_approval",
          targetRef: "decision",
          waypoints: [
            { x: 190, y: 240 },
            { x: 190, y: 290 },
          ],
        })
        .addSequenceFlow({
          id: "flow_to_director",
          name: "同意",
          sourceRef: "decision",
          targetRef: "director_approval",
          condition: "${approved}",
          waypoints: [
            { x: 215, y: 315 },
            { x: 268, y: 380 },
          ],
        })
        .addSequenceFlow({
          id: "flow_director_end",
          sourceRef: "director_approval",
          targetRef: "end_approved",
          waypoints: [
            { x: 268, y: 460 },
            { x: 268, y: 520 },
          ],
        })
        .addSequenceFlow({
          id: "flow_rejected",
          name: "拒绝",
          sourceRef: "decision",
          targetRef: "end_rejected",
          condition: "${!approved}",
          waypoints: [
            { x: 165, y: 315 },
            { x: 118, y: 400 },
          ],
        });
    const { first, second } = await roundTrip(build);
    expect(second).toBe(first);
  });

  it("parse 恢复语义元素、扩展属性与几何", async () => {
    const xml = await compile(buildMinimalFlow());
    const model = await parse(xml, { adapter: flowableAdapter });

    // 5 节点 + 4 连线
    expect(model.process.get("flowElements")).toHaveLength(9);
    expect(model.shapeOf("start")).toEqual({ x: 160, y: 60, width: 36, height: 36 });

    const task = findFlowElement(model, "manager_approval");
    expect(task.get("assignee")).toBe("${manager}");
  });

  describe("多实例审批三档", () => {
    for (const mode of APPROVAL_MODES) {
      it(`${mode} 档往返逐字一致（loopCharacteristics 与方言属性等价恢复）`, async () => {
        const { first, second } = await roundTrip(() => buildMiFlow(mode));
        expect(second).toBe(first);
      });
    }

    it("parse 恢复多实例结构与方言属性", async () => {
      const xml = await compile(buildMiFlow("all"));
      const model = await parse(xml, { adapter: flowableAdapter });
      const task = findFlowElement(model, "counter_sign");
      expect(task.get("assignee")).toBe("${assignee}");
      const loop = task.get("loopCharacteristics") as ModdleElement;
      expect(loop.$type).toBe("bpmn:MultiInstanceLoopCharacteristics");
      expect(loop.get("collection")).toBe("approvers");
      expect(loop.get("elementVariable")).toBe("assignee");
      const condition = loop.get("completionCondition") as ModdleElement;
      expect(condition.get("body")).toBe("${nrOfCompletedInstances == nrOfInstances}");
    });
  });

  it("空白 XML 拒绝解析", async () => {
    await expect(parse("   ", { adapter: flowableAdapter })).rejects.toThrow("XML 不能为空白");
  });
});

function findFlowElement(model: BpmnModel, id: string): ModdleElement {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  const found = elements.find((el) => el.get("id") === id);
  if (found === undefined) {
    throw new Error(`找不到流程元素 ${id}`);
  }
  return found;
}

/** 直接改写连线的名称与条件体（分支交换变体用） */
function rewriteCondition(model: BpmnModel, flowId: string, name: string, body: string): void {
  const flow = findFlowElement(model, flowId);
  flow.set("name", name);
  (flow.get("conditionExpression") as ModdleElement | undefined)?.set("body", body);
}
