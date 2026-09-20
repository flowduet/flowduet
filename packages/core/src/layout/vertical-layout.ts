import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "../model/bpmn-model.js";
import type { CanvasShape, Point } from "../model/bpmn-model.js";
import { projectDiagram } from "./di-layout.js";
import type { DiLayout } from "./di-layout.js";

/**
 * 竖排自动布局器（#22，原型 prototype/iter2-vertical-layout-mi 正式化）。
 *
 * 钉钉式纵向编辑天然无画布坐标（NodeSpec.shape / SequenceFlowSpec.waypoints
 * 可选化），无几何则只读投影无图可画、XML 导出无 DI 可写。推导拆三层：
 * 1. deriveBlockTree —— 从模型树（flat 图）反推钉钉式"块结构树"（fork/join
 *    配对）。钉钉式递归组件的渲染依据也是它，故公开导出、只依赖模型树；
 * 2. layoutVertical —— 块树 → 每节点 CanvasShape + 每连线正交 waypoints，
 *    纯函数；
 * 3. verticalDiLayout —— DiLayout 接缝的第二实现（推导 + bpmndi 投影一体），
 *    调用面：compile(model, { diLayout: verticalDiLayout() })。
 */

// ---------- 尺寸与间距常量（与 compile fixtures 的元素尺寸惯例一致） ----------

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
      return TASK; // 用户任务（含多实例）与服务任务（含抄送）
  }
}

// ---------- 第一层：图 → 块结构树 ----------

/** 块树的节点：单个流元素，或一个 fork/join 配对的分支块 */
export type BlockTreeNode =
  | { kind: "element"; element: ModdleElement; id: string }
  | {
      kind: "block";
      /** exclusive = 条件分支，parallel = 并行分支 */
      gateway: "exclusive" | "parallel";
      forkId: string;
      joinId: string;
      /** 每条分支是纵向链（可再含嵌套块） */
      branches: BlockTreeNode[][];
    };

interface GraphIndex {
  outgoing: Map<string, ModdleElement[]>;
  incoming: Map<string, ModdleElement[]>;
}

function indexGraph(flowElements: ModdleElement[]): GraphIndex {
  const outgoing = new Map<string, ModdleElement[]>();
  const incoming = new Map<string, ModdleElement[]>();
  for (const el of flowElements) {
    if (el.$type !== "bpmn:SequenceFlow") continue;
    const source = el.get("sourceRef") as ModdleElement;
    const target = el.get("targetRef") as ModdleElement;
    pushMap(outgoing, source.get("id") as string, el);
    pushMap(incoming, target.get("id") as string, el);
  }
  return { outgoing, incoming };
}

function pushMap(map: Map<string, ModdleElement[]>, key: string, value: ModdleElement): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

/** 索引访问的非空收敛（长度已由调用方校验，此断言仅为类型收窄服务） */
function nonNull<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`竖排布局前提不满足：${what}不应为空`);
  }
  return value;
}

function isGateway(el: ModdleElement): boolean {
  return el.$type === "bpmn:ExclusiveGateway" || el.$type === "bpmn:ParallelGateway";
}

/**
 * 良构假设（钉钉式生成保证）：每个 fork 有唯一配对 join；
 * join = incoming > 1 的网关。嵌套 fork 的 fork 自身 incoming = 1，不会被误认。
 * 违反时（分支撞 end、交错收敛）显式抛错——钉钉式画不出，导出前就该知道。
 */
function walkChain(
  firstFlow: ModdleElement,
  graph: GraphIndex,
): {
  items: BlockTreeNode[];
  join?: ModdleElement;
} {
  let cur = firstFlow.get("targetRef") as ModdleElement;
  const items: BlockTreeNode[] = [];
  // 链上已访问元素：循环图（任务间回跳）不在竖排推导服务范围，
  // 重复访问即显式抛错，避免无限循环挂死进程
  const visited = new Set<string>();

  for (;;) {
    const id = cur.get("id") as string;
    if (visited.has(id)) {
      throw new Error(`竖排推导不支持循环结构：元素 ${id} 在链上被重复访问`);
    }
    visited.add(id);
    const outs = graph.outgoing.get(id) ?? [];
    const ins = graph.incoming.get(id) ?? [];

    if (isGateway(cur) && ins.length > 1) {
      // 撞 join：链终止（join 不入链，由块消费）
      return { items, join: cur };
    }

    if (isGateway(cur) && outs.length > 1) {
      // fork：逐分支递归，良构下各分支收敛到同一 join
      const walked = outs.map((flow) => walkChain(flow, graph));
      walked.forEach(({ items: branch }, i) => {
        if (branch.length === 0) {
          throw new Error(
            `分支块 ${id} 的第 ${i + 1} 条分支为空（fork 直连 join），竖排布局不支持`,
          );
        }
      });
      const joins = walked.map((w) => w.join);
      if (
        joins.some((j) => j === undefined) ||
        new Set(joins.map((j) => j?.get("id"))).size !== 1
      ) {
        throw new Error(`分支块 ${id} 未良构收敛：各分支必须汇聚到同一 join 网关`);
      }
      const join = nonNull(joins[0], "join 网关");
      items.push({
        kind: "block",
        gateway: cur.$type === "bpmn:ParallelGateway" ? "parallel" : "exclusive",
        forkId: id,
        joinId: join.get("id") as string,
        branches: walked.map((w) => w.items),
      });
      // 消费 join，跳到 join 的唯一出边继续外层链（不能重判 join）
      // 钉钉式生成保证 join 只做汇合不做再分裂；网关兼作 join+fork 的
      // 通用 BPMN 形态不在竖排推导的服务范围（spec 良构节适用边界）
      const joinOuts = graph.outgoing.get(join.get("id") as string) ?? [];
      if (joinOuts.length !== 1) {
        throw new Error(`join 网关 ${join.get("id")} 出边必须唯一`);
      }
      cur = nonNull(joinOuts[0], "join 出边").get("targetRef") as ModdleElement;
      continue;
    }

    items.push({ kind: "element", element: cur, id });
    if (outs.length === 0) {
      // endEvent：仅主链合法；分支链里出现说明块未收敛
      return { items };
    }
    if (outs.length > 1) {
      throw new Error(`元素 ${id} 的多出边未按分支块处理（非网关多出边，不良构）`);
    }
    cur = nonNull(outs[0], "链后继出边").get("targetRef") as ModdleElement;
  }
}

/**
 * 主入口：模型树 → 块结构树（顶层主链）。
 * 钉钉式递归组件与坐标推导共用此读视图（公开导出，只依赖模型树）。
 * 推导仅从唯一开始事件可达的图形出发；不可达元素/连线不在块树中，
 * 由调用方（verticalDiLayout）显式拒绝——竖排推导不服务半残几何。
 */
export function deriveBlockTree(model: BpmnModel): BlockTreeNode[] {
  const flowElements = (model.process.get("flowElements") as ModdleElement[]) ?? [];
  const graph = indexGraph(flowElements);

  const starts = flowElements.filter((el) => el.$type === "bpmn:StartEvent");
  if (starts.length !== 1) {
    throw new Error(`竖排推导要求恰好一个开始事件，实际 ${starts.length}`);
  }
  const start = nonNull(starts[0], "开始事件");
  const startOuts = graph.outgoing.get(start.get("id") as string) ?? [];
  if (startOuts.length !== 1) {
    throw new Error("开始事件的出边必须唯一");
  }
  const { items, join } = walkChain(nonNull(startOuts[0], "开始出边"), graph);
  if (join !== undefined) {
    throw new Error("主链意外终止于 join 网关（分支交错，不良构）");
  }
  // walkChain 从出边 target 起步，开始事件自身在此补进主链头
  return [{ kind: "element", element: start, id: start.get("id") as string }, ...items];
}

// ---------- 第二层：块树 → 几何 ----------

export interface LayoutResult {
  shapes: Map<string, CanvasShape>;
  waypoints: Map<string, Point[]>;
}

/** 连线语义表：flowId → 端点（布局时用于连线归属） */
export type FlowTable = Map<string, { source: string; target: string }>;

function entryIdOf(item: BlockTreeNode): string {
  return item.kind === "element" ? item.id : item.forkId;
}
function exitIdOf(item: BlockTreeNode): string {
  return item.kind === "element" ? item.id : item.joinId;
}
function entryAnchorOf(item: BlockTreeNode, shapes: Map<string, CanvasShape>): Point {
  const s = nonNull(shapes.get(entryIdOf(item)), "分支首项形状");
  return { x: s.x + s.width / 2, y: s.y };
}
function exitAnchorOf(item: BlockTreeNode, shapes: Map<string, CanvasShape>): Point {
  const s = nonNull(shapes.get(exitIdOf(item)), "分支末项形状");
  return { x: s.x + s.width / 2, y: s.y + s.height };
}

/**
 * 竖排布局：主链居中向下，分支块内各分支左右并排、内部递归纵向。
 * 自底向上测宽、自上而下落位；fork/join 的出/入点沿边错开，保证多线不重叠。
 * 连线全部正交折线（同列退化为直线）——与 bpmn.io 渲染观感对齐。
 */
export function layoutVertical(tree: BlockTreeNode[], flows: FlowTable): LayoutResult {
  const shapes = new Map<string, CanvasShape>();
  const waypoints = new Map<string, Point[]>();

  // (source|target) → flowId 复合索引：布局期按端点查连线为 O(1)
  const flowIndex = new Map<string, string>();
  for (const [id, f] of flows) flowIndex.set(`${f.source}|${f.target}`, id);
  const flowIdOf = (source: string, target: string): string => {
    const id = flowIndex.get(`${source}|${target}`);
    if (id === undefined) {
      throw new Error(`布局找不到连线：${source} → ${target}`);
    }
    return id;
  };

  /** 正交连线：同列直线，异列走中位水平线 */
  const route = (flowId: string, from: Point, to: Point): void => {
    const midY = (from.y + to.y) / 2;
    if (Math.abs(from.x - to.x) < 0.5) {
      waypoints.set(flowId, [from, to]);
    } else {
      waypoints.set(flowId, [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to]);
    }
  };

  // 链宽 = 最宽项；块宽 = 分支列宽之和 + 列间隙（不小于网关自身）
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

  /** 落位一条纵向链，返回链底 y */
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
      // 先落位全部分支，再取最深支底确定 joinTop——浅支的入线必须够到真正的 join 顶
      const branchLasts: BlockTreeNode[] = [];
      item.branches.forEach((branch, i) => {
        const colWidth = widthOfChain(branch);
        const colCx = offset + colWidth / 2;
        offset += colWidth + COL_GAP;
        branchBottoms.push(placeChain(branch, colCx, branchTop));
        branchLasts.push(nonNull(branch[branch.length - 1], "分支末项"));

        // fork 底边出点沿边错开 → 分支首元素顶
        const first = nonNull(branch[0], "分支首项");
        const forkOutX = forkX + ((i + 1) * GATEWAY.width) / (n + 1);
        route(
          flowIdOf(item.forkId, entryIdOf(first)),
          { x: forkOutX, y: forkBottom },
          entryAnchorOf(first, shapes),
        );
      });

      const joinTop = Math.max(...branchBottoms) + BRANCH_V_GAP;
      item.branches.forEach((branch, i) => {
        // 分支末元素底 → join 顶边入点沿边错开（to.y 用真实 joinTop）
        const joinInX = forkX + ((i + 1) * GATEWAY.width) / (n + 1);
        const last = nonNull(branchLasts[i], "分支末项登记");
        route(flowIdOf(exitIdOf(last), item.joinId), exitAnchorOf(last, shapes), {
          x: joinInX,
          y: joinTop,
        });
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

  // 归一化：全图平移到 x >= 40
  let minX = Infinity;
  for (const s of shapes.values()) minX = Math.min(minX, s.x);
  const dx = 40 - minX;
  if (dx !== 0) {
    for (const s of shapes.values()) s.x += dx;
    for (const pts of waypoints.values()) for (const p of pts) p.x += dx;
  }

  return { shapes, waypoints };
}

// ---------- 第三层：DiLayout 接缝第二实现 ----------

/**
 * 竖排自动布局器：attach 时从模型树推导几何并经共用出口投影 bpmndi，
 * 不读 BpmnModel 的几何注册表（那正是"shape 可选化"要松绑的东西）。
 * 调用面：compile(model, { diLayout: verticalDiLayout() })。
 */
export function verticalDiLayout(): DiLayout {
  return {
    attach(model: BpmnModel): void {
      const flowElements = (model.process.get("flowElements") as ModdleElement[]) ?? [];

      const flows: FlowTable = new Map();
      for (const el of flowElements) {
        if (el.$type !== "bpmn:SequenceFlow") continue;
        flows.set(el.get("id") as string, {
          source: (el.get("sourceRef") as ModdleElement).get("id") as string,
          target: (el.get("targetRef") as ModdleElement).get("id") as string,
        });
      }

      const tree = deriveBlockTree(model);
      const { shapes, waypoints } = layoutVertical(tree, flows);

      // 块树只覆盖从开始事件可达的图形；不可达元素/连线若静默投影会产出
      // 空 Bounds/空折线的半残 DI——竖排推导的适用边界在此显式拒绝
      for (const el of flowElements) {
        const id = el.get("id") as string;
        if (el.$type === "bpmn:SequenceFlow") {
          if (!waypoints.has(id)) {
            throw new Error(`竖排布局仅支持从开始事件可达的图形，连线 ${id} 不在块树中`);
          }
        } else if (!shapes.has(id)) {
          throw new Error(`竖排布局仅支持从开始事件可达的图形，元素 ${id} 不在块树中`);
        }
      }

      projectDiagram(model, { shapes, waypoints });
    },
  };
}
