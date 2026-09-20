import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "../../packages/core/src/model/bpmn-model.js";
import type { CanvasShape, Point } from "../../packages/core/src/model/bpmn-model.js";
import { pushMany } from "../../packages/core/src/util/moddle-utils.js";
import type { DiLayout } from "../../packages/core/src/layout/di-layout.js";

/**
 * [PROTOTYPE] 迭代二问题 A:竖排坐标推导(throwaway)。
 *
 * 矛盾:内核 NodeSpec.shape 必填,钉钉式纵向编辑天然无画布坐标;
 * 无几何则只读投影无图可画、XML 导出无 DI 可写。
 *
 * 本模块把推导拆成两层,分别验证归属:
 * 1. deriveBlockTree —— 从模型树(flat 图)反推钉钉式"块结构树"(fork/join 配对)。
 *    钉钉式递归组件的渲染依据也是它,故必须公开、只依赖模型树;
 * 2. layoutVertical —— 块树 → 每节点 CanvasShape + 每连线正交 waypoints;
 * 3. verticalDiLayout —— DiLayout 接缝的第二实现(推导 + bpmndi 投影一体),
 *    调用面:compile(model, { diLayout: verticalDiLayout() })。
 *
 * 结论折回 docs/specs/iteration-2/dingtalk-view-mvp.md 待细化 1。
 */

// ---------- 尺寸与间距常量(与 compile fixtures 的元素尺寸惯例一致) ----------

const TASK = { width: 100, height: 80 };
const EVENT = { width: 36, height: 36 };
const GATEWAY = { width: 50, height: 50 };
/** 分支列之间的水平间隙 */
const COL_GAP = 90;
/** 主链相邻元素的垂直间隙 */
const V_GAP = 60;
/** fork/join 与分支首/末元素之间的垂直间隙 */
const BRANCH_V_GAP = 70;

function sizeOf(element: ModdleElement): { width: number; height: number } {
  switch (element.$type) {
    case "bpmn:StartEvent":
    case "bpmn:EndEvent":
      return EVENT;
    case "bpmn:ExclusiveGateway":
    case "bpmn:ParallelGateway":
      return GATEWAY;
    default:
      return TASK; // UserTask(含多实例)及后续服务任务类
  }
}

// ---------- 第一层:图 → 块结构树 ----------

/** 块树的节点:单个流元素,或一个 fork/join 配对的分支块 */
export type BlockTreeNode =
  | { kind: "element"; element: ModdleElement; id: string }
  | {
      kind: "block";
      /** exclusive = 条件分支,parallel = 并行分支 */
      gateway: "exclusive" | "parallel";
      forkId: string;
      joinId: string;
      /** 每条分支是纵向链(可再含嵌套块) */
      branches: BlockTreeNode[][];
    };

interface GraphIndex {
  byId: Map<string, ModdleElement>;
  outgoing: Map<string, ModdleElement[]>;
  incoming: Map<string, ModdleElement[]>;
}

function indexGraph(flowElements: ModdleElement[]): GraphIndex {
  const byId = new Map<string, ModdleElement>();
  const outgoing = new Map<string, ModdleElement[]>();
  const incoming = new Map<string, ModdleElement[]>();
  for (const el of flowElements) {
    byId.set(el.get("id") as string, el);
    if (el.$type !== "bpmn:SequenceFlow") continue;
    const source = el.get("sourceRef") as ModdleElement;
    const target = el.get("targetRef") as ModdleElement;
    pushMap(outgoing, source.get("id") as string, el);
    pushMap(incoming, target.get("id") as string, el);
  }
  return { byId, outgoing, incoming };
}

function pushMap(map: Map<string, ModdleElement[]>, key: string, value: ModdleElement): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function isGateway(el: ModdleElement): boolean {
  return el.$type === "bpmn:ExclusiveGateway" || el.$type === "bpmn:ParallelGateway";
}

/**
 * 良构假设(钉钉式生成保证):每个 fork 有唯一配对 join;
 * join = incoming > 1 的网关。嵌套 fork 的 fork 自身 incoming = 1,不会被误认。
 * 违反时(分支撞 end、交错收敛)显式抛错——钉钉式画不出,导出前就该知道。
 */
function walkChain(
  firstFlow: ModdleElement,
  graph: GraphIndex,
): { items: BlockTreeNode[]; join?: ModdleElement } {
  let cur = firstFlow.get("targetRef") as ModdleElement;
  const items: BlockTreeNode[] = [];

  for (;;) {
    const id = cur.get("id") as string;
    const outs = graph.outgoing.get(id) ?? [];
    const ins = graph.incoming.get(id) ?? [];

    if (isGateway(cur) && ins.length > 1) {
      // 撞 join:链终止(join 不入链,由块消费)
      return { items, join: cur };
    }

    if (isGateway(cur) && outs.length > 1) {
      // fork:逐分支递归,良构下各分支收敛到同一 join
      const walked = outs.map((flow) => walkChain(flow, graph));
      const joins = walked.map((w) => w.join);
      if (
        joins.some((j) => j === undefined) ||
        new Set(joins.map((j) => j?.get("id"))).size !== 1
      ) {
        throw new Error(`分支块 ${id} 未良构收敛:各分支必须汇聚到同一 join 网关`);
      }
      const join = joins[0] as ModdleElement;
      items.push({
        kind: "block",
        gateway: cur.$type === "bpmn:ParallelGateway" ? "parallel" : "exclusive",
        forkId: id,
        joinId: join.get("id") as string,
        branches: walked.map((w) => w.items),
      });
      // 消费 join,跳到 join 的唯一出边继续外层链(不能重判 join)
      const joinOuts = graph.outgoing.get(join.get("id") as string) ?? [];
      if (joinOuts.length !== 1) {
        throw new Error(`join 网关 ${join.get("id")} 出边必须唯一`);
      }
      cur = joinOuts[0].get("targetRef") as ModdleElement;
      continue;
    }

    items.push({ kind: "element", element: cur, id });
    if (outs.length === 0) {
      // endEvent:仅主链合法;分支链里出现说明块未收敛
      return { items, join: undefined };
    }
    if (outs.length > 1) {
      throw new Error(`元素 ${id} 的多出边未按分支块处理(非网关多出边,不良构)`);
    }
    cur = outs[0].get("targetRef") as ModdleElement;
  }
}

/** 主入口:模型树 → 块结构树(顶层主链)。钉钉式递归组件与坐标推导共用此读视图 */
export function deriveBlockTree(model: BpmnModel): BlockTreeNode[] {
  const flowElements = (model.process.get("flowElements") as ModdleElement[]) ?? [];
  const graph = indexGraph(flowElements);

  const starts = flowElements.filter((el) => el.$type === "bpmn:StartEvent");
  if (starts.length !== 1) {
    throw new Error(`竖排推导要求恰好一个开始事件,实际 ${starts.length}`);
  }
  const start = starts[0];
  const startOuts = graph.outgoing.get(start.get("id") as string) ?? [];
  if (startOuts.length !== 1) {
    throw new Error("开始事件的出边必须唯一");
  }
  const { items, join } = walkChain(startOuts[0], graph);
  if (join !== undefined) {
    throw new Error("主链意外终止于 join 网关(分支交错,不良构)");
  }
  // walkChain 从出边 target 起步,开始事件自身在此补进主链头
  return [{ kind: "element", element: start, id: start.get("id") as string }, ...items];
}

/** 块树的缩进文本(调试 / demo 展示) */
export function renderTreeToString(items: BlockTreeNode[], indent = ""): string {
  const lines: string[] = [];
  for (const item of items) {
    if (item.kind === "element") {
      const name = item.element.get("name") as string | undefined;
      lines.push(`${indent}· ${item.element.$type.replace("bpmn:", "")}「${name ?? item.id}」`);
    } else {
      const label = item.gateway === "parallel" ? "并行分支" : "条件分支";
      lines.push(`${indent}┌ ${label}块（${item.forkId} → ${item.joinId}）`);
      for (const branch of item.branches) {
        lines.push(`${indent}│ ├ 分支：`);
        lines.push(renderTreeToString(branch, `${indent}│ │ `));
      }
      lines.push(`${indent}└`);
    }
  }
  return lines.join("\n");
}

// ---------- 第二层:块树 → 几何 ----------

export interface LayoutResult {
  shapes: Map<string, CanvasShape>;
  waypoints: Map<string, Point[]>;
  /** 全图尺寸(demo 渲染视口用) */
  size: { width: number; height: number };
}

/** 连线语义表:flowId → 端点(布局时用于连线归属) */
export type FlowTable = Map<string, { source: string; target: string; name?: string }>;

function entryIdOf(item: BlockTreeNode): string {
  return item.kind === "element" ? item.id : item.forkId;
}
function exitIdOf(item: BlockTreeNode): string {
  return item.kind === "element" ? item.id : item.joinId;
}
function entryAnchorOf(item: BlockTreeNode, shapes: Map<string, CanvasShape>): Point {
  const s = shapes.get(entryIdOf(item)) as CanvasShape;
  return { x: s.x + s.width / 2, y: s.y };
}
function exitAnchorOf(item: BlockTreeNode, shapes: Map<string, CanvasShape>): Point {
  const s = shapes.get(exitIdOf(item)) as CanvasShape;
  return { x: s.x + s.width / 2, y: s.y + s.height };
}

/**
 * 竖排布局:主链居中向下,分支块内各分支左右并排、内部递归纵向。
 * 自底向上测宽、自上而下落位;fork/join 的出/入点沿边错开,保证多线不重叠。
 * 连线全部正交折线(同列退化为直线)——与 bpmn.io 渲染观感对齐。
 */
export function layoutVertical(tree: BlockTreeNode[], flows: FlowTable): LayoutResult {
  const shapes = new Map<string, CanvasShape>();
  const waypoints = new Map<string, Point[]>();

  const flowIdOf = (source: string, target: string): string => {
    for (const [id, f] of flows) {
      if (f.source === source && f.target === target) return id;
    }
    throw new Error(`布局找不到连线:${source} → ${target}`);
  };

  /** 正交连线:同列直线,异列走中位水平线 */
  const route = (flowId: string, from: Point, to: Point): void => {
    const midY = (from.y + to.y) / 2;
    if (Math.abs(from.x - to.x) < 0.5) {
      waypoints.set(flowId, [from, to]);
    } else {
      waypoints.set(flowId, [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to]);
    }
  };

  // 链宽 = 最宽项;块宽 = 分支列宽之和 + 列间隙(不小于网关自身)
  const widthOfChain = (items: BlockTreeNode[]): number =>
    Math.max(...items.map((item) => widthOfItem(item)));
  const widthOfItem = (item: BlockTreeNode): number => {
    if (item.kind === "element") return sizeOf(item.element).width;
    const inner =
      item.branches.reduce((acc, b) => acc + widthOfChain(b), 0) +
      (item.branches.length - 1) * COL_GAP;
    return Math.max(GATEWAY.width, inner);
  };
  const heightOfChain = (items: BlockTreeNode[]): number => {
    let h = 0;
    items.forEach((item, i) => {
      if (i > 0) h += V_GAP;
      h += item.kind === "element" ? sizeOf(item.element).height : heightOfBlock(item);
    });
    return h;
  };
  const heightOfBlock = (item: Extract<BlockTreeNode, { kind: "block" }>): number =>
    GATEWAY.height +
    BRANCH_V_GAP +
    Math.max(...item.branches.map((b) => heightOfChain(b))) +
    BRANCH_V_GAP +
    GATEWAY.height;

  /** 落位一条纵向链,返回链底 y */
  const placeChain = (items: BlockTreeNode[], cx: number, top: number): number => {
    let y = top;
    let prevExit: { point: Point; id: string } | undefined;

    items.forEach((item, index) => {
      if (index > 0) y += V_GAP;

      if (item.kind === "element") {
        const size = sizeOf(item.element);
        shapes.set(item.id, { x: cx - size.width / 2, y, width: size.width, height: size.height });
        const entry = { x: cx, y };
        if (prevExit !== undefined) {
          route(flowIdOf(prevExit.id, item.id), prevExit.point, entry);
        }
        prevExit = { point: { x: cx, y: y + size.height }, id: item.id };
        y += size.height;
        return;
      }

      // —— 分支块 ——
      const blockWidth = widthOfItem(item);
      const forkX = cx - GATEWAY.width / 2;
      shapes.set(item.forkId, { x: forkX, y, width: GATEWAY.width, height: GATEWAY.height });
      if (prevExit !== undefined) {
        route(flowIdOf(prevExit.id, item.forkId), prevExit.point, { x: cx, y });
      }
      const forkBottom = y + GATEWAY.height;
      const branchTop = forkBottom + BRANCH_V_GAP;

      const n = item.branches.length;
      let offset = cx - blockWidth / 2;
      const branchBottoms: number[] = [];
      // 先落位全部分支,再取最深支底确定 joinTop——浅支的入线必须够到真正的 join 顶
      const branchLasts: BlockTreeNode[] = [];
      item.branches.forEach((branch, i) => {
        const colWidth = widthOfChain(branch);
        const colCx = offset + colWidth / 2;
        offset += colWidth + COL_GAP;
        branchBottoms.push(placeChain(branch, colCx, branchTop));
        branchLasts.push(branch[branch.length - 1]);

        // fork 底边出点沿边错开 → 分支首元素顶
        const forkOutX = forkX + ((i + 1) * GATEWAY.width) / (n + 1);
        route(
          flowIdOf(item.forkId, entryIdOf(branch[0])),
          { x: forkOutX, y: forkBottom },
          entryAnchorOf(branch[0], shapes),
        );
      });

      const joinTop = Math.max(...branchBottoms) + BRANCH_V_GAP;
      item.branches.forEach((branch, i) => {
        // 分支末元素底 → join 顶边入点沿边错开(to.y 用真实 joinTop)
        const joinInX = forkX + ((i + 1) * GATEWAY.width) / (n + 1);
        route(
          flowIdOf(exitIdOf(branchLasts[i]), item.joinId),
          exitAnchorOf(branchLasts[i], shapes),
          { x: joinInX, y: joinTop },
        );
      });
      shapes.set(item.joinId, {
        x: forkX,
        y: joinTop,
        width: GATEWAY.width,
        height: GATEWAY.height,
      });
      prevExit = { point: { x: cx, y: joinTop + GATEWAY.height }, id: item.joinId };
      y = joinTop + GATEWAY.height;
    });

    return y;
  };

  placeChain(tree, 400, 40);

  // 归一化:全图平移到 x>=40
  let minX = Infinity;
  for (const s of shapes.values()) minX = Math.min(minX, s.x);
  const dx = 40 - minX;
  if (dx !== 0) {
    for (const s of shapes.values()) s.x += dx;
    for (const pts of waypoints.values()) for (const p of pts) p.x += dx;
  }

  let maxX = 0;
  let maxY = 0;
  for (const s of shapes.values()) {
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }
  return { shapes, waypoints, size: { width: maxX + 40, height: maxY + 40 } };
}

// ---------- 第三层:DiLayout 接缝第二实现 ----------

/**
 * 并行网关建模草样:正式内核尚无 addParallelGateway(迭代二 parallel-gateway 票),
 * 外挂元素不进 BpmnModel 注册表——其连线索性也必须走草样(prototypeAddFlow),
 * 注册表裂隙的活证据。
 */
export function prototypeAddGateway(
  model: BpmnModel,
  spec: { id: string; name?: string; type: "exclusive" | "parallel" },
): BpmnModel {
  const { moddle, process } = model;
  const element = moddle.create(
    spec.type === "parallel" ? "bpmn:ParallelGateway" : "bpmn:ExclusiveGateway",
    { id: spec.id, name: spec.name },
  );
  pushMany(process, "flowElements", element);
  return model;
}

/**
 * 竖排自动布局器:attach 时从模型树推导几何并直接投影 bpmndi,
 * 不读 BpmnModel 的几何注册表(那正是"shape 必填"想绑定的东西)。
 * 调用面:compile(model, { diLayout: verticalDiLayout() })。
 */
export function verticalDiLayout(): DiLayout {
  return {
    attach(model: BpmnModel): void {
      const { moddle, process } = model;
      const flowElements = (process.get("flowElements") as ModdleElement[]) ?? [];

      const flows: FlowTable = new Map();
      for (const el of flowElements) {
        if (el.$type !== "bpmn:SequenceFlow") continue;
        flows.set(el.get("id") as string, {
          source: (el.get("sourceRef") as ModdleElement).get("id") as string,
          target: (el.get("targetRef") as ModdleElement).get("id") as string,
          name: el.get("name") as string | undefined,
        });
      }

      const tree = deriveBlockTree(model);
      const { shapes, waypoints } = layoutVertical(tree, flows);

      const processId = process.get("id") as string;
      const plane = moddle.create("bpmndi:BPMNPlane", {
        id: `${processId}_plane`,
        bpmnElement: process,
      });
      const diagram = moddle.create("bpmndi:BPMNDiagram", { id: `${processId}_di`, plane });
      for (const element of flowElements) {
        const id = element.get("id") as string;
        if (element.$type === "bpmn:SequenceFlow") {
          pushMany(
            plane,
            "planeElement",
            moddle.create("bpmndi:BPMNEdge", {
              id: `${id}_di`,
              bpmnElement: element,
              waypoint: (waypoints.get(id) ?? []).map((p) => moddle.create("dc:Point", p)),
            }),
          );
        } else {
          pushMany(
            plane,
            "planeElement",
            moddle.create("bpmndi:BPMNShape", {
              id: `${id}_di`,
              bpmnElement: element,
              bounds: moddle.create("dc:Bounds", shapes.get(id)),
            }),
          );
        }
      }
      pushMany(model.definitions, "diagrams", diagram);
    },
  };
}
