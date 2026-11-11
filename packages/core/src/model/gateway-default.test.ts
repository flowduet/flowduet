import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { BpmnModel } from "./bpmn-model.js";

/**
 * 并行网关与排他网关默认流转的建模 API 语义与三重守卫。
 * 默认流转在调用面是分支属性（钉钉式抽屉「本分支设为默认」心智，R2 决策），
 * 内核落 BPMN 语义（网关 default 引用属性）。
 */

const SHAPE = { x: 160, y: 160, width: 100, height: 80 };
const GATEWAY_SHAPE = { x: 165, y: 290, width: 50, height: 50 };

function createBranchingModel(): BpmnModel {
  return BpmnModel.create({ processId: "branch_guard", adapter: flowableAdapter })
    .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addUserTask({ id: "approval", name: "审批", assignee: "${manager}", shape: SHAPE })
    .addExclusiveGateway({ id: "decision", name: "是否同意", shape: GATEWAY_SHAPE })
    .addEndEvent({ id: "end_ok", shape: { x: 250, y: 400, width: 36, height: 36 } })
    .addEndEvent({ id: "end_no", shape: { x: 100, y: 400, width: 36, height: 36 } });
}

describe("默认流转三重守卫", () => {
  it("默认标记与条件表达式同传即抛错", () => {
    expect(() =>
      createBranchingModel().addSequenceFlow({
        id: "f_ok",
        sourceRef: "decision",
        targetRef: "end_ok",
        condition: "${approved}",
        default: true,
        waypoints: [
          { x: 215, y: 315 },
          { x: 268, y: 400 },
        ],
      }),
    ).toThrow(/默认流转.*不能同时携带条件表达式/);
  });

  it("默认出线的源不是排他网关即抛错", () => {
    expect(() =>
      createBranchingModel().addSequenceFlow({
        id: "f_from_start",
        sourceRef: "start",
        targetRef: "end_ok",
        default: true,
        waypoints: [
          { x: 178, y: 78 },
          { x: 268, y: 400 },
        ],
      }),
    ).toThrow(/源必须是排他网关/);
  });

  it("同一排他网关标记第二条默认流转即抛错", () => {
    const model = createBranchingModel()
      .addSequenceFlow({
        id: "f_ok",
        sourceRef: "decision",
        targetRef: "end_ok",
        condition: "${approved}",
        waypoints: [
          { x: 215, y: 315 },
          { x: 268, y: 400 },
        ],
      })
      .addSequenceFlow({
        id: "f_no",
        sourceRef: "decision",
        targetRef: "end_no",
        default: true,
        waypoints: [
          { x: 165, y: 315 },
          { x: 118, y: 400 },
        ],
      });
    expect(() =>
      model.addSequenceFlow({
        id: "f_dup",
        sourceRef: "decision",
        targetRef: "end_ok",
        default: true,
        waypoints: [
          { x: 215, y: 340 },
          { x: 268, y: 420 },
        ],
      }),
    ).toThrow(/已有默认流转/);
  });
});

describe("网关建模语义", () => {
  it("并行网关与排他网关同构建模", async () => {
    const xml = await compile(
      BpmnModel.create({ processId: "gateway_tags", adapter: flowableAdapter })
        .addStartEvent({ id: "start", shape: { x: 160, y: 60, width: 36, height: 36 } })
        .addParallelGateway({ id: "fork", name: "并行分裂", shape: GATEWAY_SHAPE })
        .addExclusiveGateway({ id: "choice", name: "条件", shape: GATEWAY_SHAPE })
        .addEndEvent({ id: "end", shape: { x: 160, y: 400, width: 36, height: 36 } })
        .addSequenceFlow({
          id: "f1",
          sourceRef: "start",
          targetRef: "fork",
          waypoints: [
            { x: 178, y: 96 },
            { x: 190, y: 290 },
          ],
        })
        .addSequenceFlow({
          id: "f2",
          sourceRef: "fork",
          targetRef: "choice",
          waypoints: [
            { x: 203, y: 175 },
            { x: 165, y: 290 },
          ],
        })
        .addSequenceFlow({
          id: "f3",
          sourceRef: "choice",
          targetRef: "end",
          default: true,
          waypoints: [
            { x: 190, y: 340 },
            { x: 178, y: 400 },
          ],
        }),
    );
    expect(xml).toContain('<bpmn:parallelGateway id="fork" name="并行分裂"');
    expect(xml).toContain('<bpmn:exclusiveGateway id="choice" name="条件" default="f3">');
  });
});
