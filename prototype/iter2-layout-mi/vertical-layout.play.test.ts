import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModdleElement } from "bpmn-moddle";
import { BpmnModel } from "../../packages/core/src/model/bpmn-model.js";
import { compile } from "../../packages/core/src/compile/compiler.js";
import { prototypeFlowableAdapter, addApprovalTask, prototypeAddFlow } from "./mi-approval.js";
import {
  deriveBlockTree,
  layoutVertical,
  prototypeAddGateway,
  renderTreeToString,
  verticalDiLayout,
} from "./vertical-layout.js";
import type { FlowTable } from "./vertical-layout.js";

/**
 * [PROTOTYPE] 问题 A 执行脚本:嵌套分支块场景 → 块树推导 → 竖排几何 → XML 导出。
 * 运行:pnpm -C prototype/iter2-layout-mi play
 * 产物:out/vertical-scenario.xml(demo 渲染与部署冒烟共用)
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "out");

/** shape 必填逼出的哑坐标——问题 A 要消除的别扭,原样保留作证据 */
const DUMMY = { x: 0, y: 0, width: 10, height: 10 };

/**
 * 验证场景(五类节点中抽掉抄送,覆盖条件分支 + 并行分支多层嵌套 + 多实例三档):
 * 开始 → 发起 → 条件分支{
 *   支1: 并行分支{ 会签, HR 审批, 依次审批 }
 *   支2: 总监审批 → 条件分支{ 整改, 归档复核 }
 * } → 结束
 */
function buildScenario(): BpmnModel {
  const model = BpmnModel.create({
    processId: "vertical_scenario",
    processName: "竖排推导场景",
    adapter: prototypeFlowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: DUMMY })
    .addUserTask({ id: "initiate", name: "发起申请", assignee: "${initiator}", shape: DUMMY })
    .addExclusiveGateway({ id: "cond1_fork", name: "金额判断", shape: DUMMY });
  // 支1:并行分支块(三支)——并行网关外挂建模(正式内核尚无 addParallelGateway)
  prototypeAddGateway(model, { id: "par_fork", name: "并行开始", type: "parallel" });
  prototypeAddGateway(model, { id: "par_join", name: "并行结束", type: "parallel" });
  model
    .addUserTask({ id: "hr_approve", name: "HR 审批", assignee: "${hr}", shape: DUMMY })
    // 支2:独立审批 + 嵌套条件分支块
    .addUserTask({
      id: "director_approve",
      name: "总监审批",
      assignee: "${director}",
      shape: DUMMY,
    })
    .addExclusiveGateway({ id: "cond2_fork", name: "是否通过", shape: DUMMY })
    .addExclusiveGateway({ id: "cond2_join", name: "汇聚", shape: DUMMY })
    .addUserTask({ id: "rectify", name: "整改", assignee: "${owner}", shape: DUMMY })
    .addUserTask({ id: "archive_review", name: "归档复核", assignee: "${auditor}", shape: DUMMY })
    .addExclusiveGateway({ id: "cond1_join", name: "汇聚", shape: DUMMY })
    .addEndEvent({ id: "end", name: "结束", shape: DUMMY });

  // 多实例三档(外挂 API + 草样连线——注册表裂隙的活证据)
  addApprovalTask(model, {
    id: "counter_sign",
    name: "部门会签",
    collection: "${approvers}",
    mode: "all",
  });
  addApprovalTask(model, {
    id: "sequential_sign",
    name: "逐级审批",
    collection: "${chain}",
    mode: "sequential",
  });

  // 与外挂元素(并行网关、多实例任务)相关的连线全走草样;其余走正门
  prototypeAddFlow(model, { id: "f_c1_par", sourceRef: "cond1_fork", targetRef: "par_fork" });
  prototypeAddFlow(model, { id: "f_par_cs", sourceRef: "par_fork", targetRef: "counter_sign" });
  prototypeAddFlow(model, { id: "f_par_hr", sourceRef: "par_fork", targetRef: "hr_approve" });
  prototypeAddFlow(model, { id: "f_par_seq", sourceRef: "par_fork", targetRef: "sequential_sign" });
  prototypeAddFlow(model, { id: "f_cs_join", sourceRef: "counter_sign", targetRef: "par_join" });
  prototypeAddFlow(model, { id: "f_hr_pj", sourceRef: "hr_approve", targetRef: "par_join" });
  prototypeAddFlow(model, {
    id: "f_seq_join",
    sourceRef: "sequential_sign",
    targetRef: "par_join",
  });
  prototypeAddFlow(model, { id: "f_pj_j1", sourceRef: "par_join", targetRef: "cond1_join" });

  return model
    .addSequenceFlow({
      id: "f_s_init",
      sourceRef: "start",
      targetRef: "initiate",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_init_c1",
      sourceRef: "initiate",
      targetRef: "cond1_fork",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_c1_dir",
      sourceRef: "cond1_fork",
      targetRef: "director_approve",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_dir_c2",
      sourceRef: "director_approve",
      targetRef: "cond2_fork",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_c2_rect",
      sourceRef: "cond2_fork",
      targetRef: "rectify",
      condition: "${!passed}",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_rect_j2",
      sourceRef: "rectify",
      targetRef: "cond2_join",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_c2_arch",
      sourceRef: "cond2_fork",
      targetRef: "archive_review",
      condition: "${passed}",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_arch_j2",
      sourceRef: "archive_review",
      targetRef: "cond2_join",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_j2_j1",
      sourceRef: "cond2_join",
      targetRef: "cond1_join",
      waypoints: [DUMMY, DUMMY],
    })
    .addSequenceFlow({
      id: "f_j1_end",
      sourceRef: "cond1_join",
      targetRef: "end",
      waypoints: [DUMMY, DUMMY],
    });
}

describe("[PROTOTYPE] 问题 A:竖排坐标推导", () => {
  it("块树推导:条件/并行多层嵌套结构正确", () => {
    const tree = deriveBlockTree(buildScenario());
    const text = renderTreeToString(tree);
    console.log(`\n===== 块结构树 =====\n${text}`);
    // 顶层主链:开始、发起、外层条件块、结束
    expect(tree.filter((n) => n.kind === "element")).toHaveLength(3);
    const block = tree.find((n) => n.kind === "block");
    expect(block).toBeDefined();
    if (block?.kind !== "block") throw new Error("unreachable");
    expect(block.branches).toHaveLength(2);
    // 支1 首项是并行块;支2 含嵌套条件块
    expect(block.branches[0][0].kind).toBe("block");
    expect(block.branches[1].some((n) => n.kind === "block")).toBe(true);
  });

  it("竖排布局:嵌套块坐标互不重叠 + 连线齐备", async () => {
    const model = buildScenario();
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain("<bpmndi:BPMNDiagram");

    // 从 DI 段回读几何,做两两不相交断言(重叠面积必须为 0,允许边贴合)
    const shapes: { x: number; y: number; width: number; height: number }[] = [];
    const boundsRe = /<dc:Bounds x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" \/>/g;
    let m: RegExpExecArray | null;
    while ((m = boundsRe.exec(xml)) !== null) {
      shapes.push({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] });
    }
    expect(shapes).toHaveLength(15); // 15 个节点全有 DI
    const waypointCount = (xml.match(/<di:waypoint/g) ?? []).length;
    expect(waypointCount).toBeGreaterThanOrEqual(18 * 2); // 18 条连线各至少 2 点
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i];
        const b = shapes[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(
          overlapX <= 0 || overlapY <= 0,
          `形状重叠: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
        ).toBe(true);
      }
    }
    console.log(`\n===== 形状 ${shapes.length} 个,waypoint ${waypointCount} 个 =====`);

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "vertical-scenario.xml"), xml);
  });

  it("反例:分支不收敛(分支撞 end)时推导显式抛错", () => {
    const model = BpmnModel.create({
      processId: "bad_shape",
      adapter: prototypeFlowableAdapter,
    })
      .addStartEvent({ id: "start", name: "开始", shape: DUMMY })
      .addExclusiveGateway({ id: "fork", name: "判断", shape: DUMMY })
      .addEndEvent({ id: "end1", name: "结束1", shape: DUMMY })
      .addEndEvent({ id: "end2", name: "结束2", shape: DUMMY })
      .addSequenceFlow({
        id: "f1",
        sourceRef: "start",
        targetRef: "fork",
        waypoints: [DUMMY, DUMMY],
      })
      .addSequenceFlow({
        id: "f2",
        sourceRef: "fork",
        targetRef: "end1",
        waypoints: [DUMMY, DUMMY],
      })
      .addSequenceFlow({
        id: "f3",
        sourceRef: "fork",
        targetRef: "end2",
        waypoints: [DUMMY, DUMMY],
      });
    expect(() => deriveBlockTree(model)).toThrow(/未良构收敛/);
  });

  it("生成 demo.html(几何 + XML 内嵌,双击即看)", async () => {
    const model = buildScenario();
    const tree = deriveBlockTree(model);
    const flowTable: FlowTable = new Map();
    const elementById = new Map<string, ModdleElement>();
    for (const el of model.process.get("flowElements") as ModdleElement[]) {
      if (el.$type === "bpmn:SequenceFlow") {
        flowTable.set(el.get("id") as string, {
          source: (el.get("sourceRef") as ModdleElement).get("id") as string,
          target: (el.get("targetRef") as ModdleElement).get("id") as string,
          name: el.get("name") as string | undefined,
        });
      } else {
        elementById.set(el.get("id") as string, el);
      }
    }
    const { shapes, waypoints, size } = layoutVertical(tree, flowTable);
    const miModes: Record<string, string> = { counter_sign: "all", sequential_sign: "sequential" };
    const nodes = [...shapes.entries()].map(([id, shape]) => {
      const el = elementById.get(id) as ModdleElement;
      return {
        id,
        type: el.$type as string,
        name: el.get("name") as string | undefined,
        shape,
        mi: miModes[id] ?? null,
      };
    });
    const flows = [...flowTable.entries()].map(([id, f]) => ({
      id,
      name: f.name ?? null,
      points: waypoints.get(id) ?? [],
    }));

    const scenarioXml = await compile(model, { diLayout: verticalDiLayout() });
    const data = {
      tree: renderTreeToString(tree),
      size,
      nodes,
      flows,
      xmls: {
        scenario: scenarioXml,
        all: readFileSync(join(OUT_DIR, "mi-all.xml"), "utf8"),
        any: readFileSync(join(OUT_DIR, "mi-any.xml"), "utf8"),
        sequential: readFileSync(join(OUT_DIR, "mi-sequential.xml"), "utf8"),
      },
    };
    const template = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "demo.template.html"),
      "utf8",
    );
    writeFileSync(join(OUT_DIR, "demo.html"), template.replace("__DATA__", JSON.stringify(data)));
    expect(readFileSync(join(OUT_DIR, "demo.html"), "utf8")).toContain("viewBox");
  });
});
