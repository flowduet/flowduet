import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BpmnModel } from "../../packages/core/src/model/bpmn-model.js";
import {
  prototypeFlowableAdapter,
  addApprovalTask,
  addCardinalityApprovalTask,
  prototypeAddFlow,
} from "./mi-approval.js";

/**
 * [PROTOTYPE] 问题 B 执行脚本:三档(会签/或签/依次)多实例 → toXML → 形态断言。
 * 运行:pnpm -C prototype/iter2-layout-mi play
 * 产物:out/mi-{all,any,sequential}.xml(供 Flowable 6.8 部署冒烟 + demo 展示)
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "out");

/** 最小可执行流程:开始 → 多实例审批 → 结束(几何占位,只验证语义形态) */
function buildMiFlow(mode: string, spec: Parameters<typeof addApprovalTask>[1]): BpmnModel {
  const model = BpmnModel.create({
    processId: `mi_${mode}`,
    processName: `多实例三档验证 · ${mode}`,
    adapter: prototypeFlowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addEndEvent({ id: "end", name: "结束", shape: { x: 160, y: 300, width: 36, height: 36 } });
  addApprovalTask(model, spec);
  prototypeAddFlow(model, { id: "f1", sourceRef: "start", targetRef: spec.id });
  prototypeAddFlow(model, { id: "f2", sourceRef: spec.id, targetRef: "end" });
  return model;
}

const CASES = [
  {
    mode: "all",
    spec: { id: "counter_sign", name: "部门会签", collection: "approvers", mode: "all" as const },
    // 方言属性落法(命名空间修正后实测可用)
    expect: [
      'flowable:collection="approvers"',
      'flowable:elementVariable="assignee"',
      "nrOfCompletedInstances == nrOfInstances",
    ],
    absent: ['isSequential="true"'],
  },
  {
    mode: "any",
    spec: { id: "any_sign", name: "主管或签", collection: "approvers", mode: "any" as const },
    expect: ["nrOfCompletedInstances &gt;= 1", 'flowable:assignee="${assignee}"'],
    absent: ['isSequential="true"'],
  },
  {
    mode: "sequential",
    spec: { id: "seq_sign", name: "逐级审批", collection: "chain", mode: "sequential" as const },
    expect: ['isSequential="true"', 'flowable:collection="chain"'],
    absent: ["completionCondition"],
  },
] as const;

describe("[PROTOTYPE] 问题 B:多实例三档编译手感", () => {
  const xmls: Record<string, string> = {};

  it("三档 spec → XML 形态符合 Flowable 落法", async () => {
    for (const c of CASES) {
      const xml = await buildMiFlow(c.mode, c.spec)
        .toXML({ format: true })
        .then((r) => r.xml);
      xmls[c.mode] = xml;
      for (const frag of c.expect) {
        expect(xml).toContain(frag);
      }
      for (const frag of c.absent) {
        expect(xml).not.toContain(frag);
      }
      console.log(`\n===== ${c.mode} =====\n${xml}`);
    }
  });

  it("sequential 档拒绝完成条件覆盖(内核固化边界的诚实面)", () => {
    const model = BpmnModel.create({
      processId: "mi_guard",
      adapter: prototypeFlowableAdapter,
    });
    expect(() =>
      addApprovalTask(model, {
        id: "t",
        collection: "approvers",
        mode: "sequential",
        completionCondition: "${nrOfCompletedInstances >= 1}",
      }),
    ).toThrow(/依次审批没有完成条件/);
  });

  it("反例对照:loopCardinality 落法的 XML 形态(对比 collection)", async () => {
    const model = BpmnModel.create({
      processId: "mi_card",
      adapter: prototypeFlowableAdapter,
    })
      .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
      .addEndEvent({ id: "end", name: "结束", shape: { x: 160, y: 300, width: 36, height: 36 } });
    addCardinalityApprovalTask(model, { id: "card_sign", count: 3, mode: "all" });
    prototypeAddFlow(model, { id: "f1", sourceRef: "start", targetRef: "card_sign" });
    prototypeAddFlow(model, { id: "f2", sourceRef: "card_sign", targetRef: "end" });
    const xml = await model.toXML({ format: true }).then((r) => r.xml);
    expect(xml).toContain("<bpmn:loopCardinality>3</bpmn:loopCardinality>");
    console.log(`\n===== cardinality 反例 =====\n${xml}`);
  });

  it("写产物供部署冒烟与 demo", async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const [mode, xml] of Object.entries(xmls)) {
      writeFileSync(join(OUT_DIR, `mi-${mode}.xml`), xml);
    }
    expect(Object.keys(xmls)).toHaveLength(3);
  });
});
