import { BpmnModdle } from "bpmn-moddle";
import type { ModdleElement } from "bpmn-moddle";
import type { EngineAdapter } from "../adapter/flowable-adapter";
import { pushMany } from "../util/moddle-utils";

/** 画布形状（DI v0 恒等布局的坐标来源） */
export interface CanvasShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 画布折线点（连线 waypoint） */
export interface Point {
  x: number;
  y: number;
}

export interface BpmnModelSpec {
  processId: string;
  processName?: string;
  definitionsId?: string;
  targetNamespace?: string;
  /**
   * 引擎适配器：决定方言扩展包（命名空间 + 扩展属性 schema）。
   * 适配器绑定在模型层而非编译层——扩展属性在建模时就已写进树里。
   */
  adapter: EngineAdapter;
}

export interface NodeSpec {
  id: string;
  name?: string;
  shape: CanvasShape;
}

export interface UserTaskSpec extends NodeSpec {
  /** 审批人，Flowable 表达式（如 "${manager}"）或字面量 */
  assignee?: string;
}

export interface SequenceFlowSpec {
  id: string;
  name?: string;
  /** 必须是已登记的流节点 id */
  sourceRef: string;
  targetRef: string;
  /** 排他网关分支条件（FormalExpression 体）；无条件的默认流转不传 */
  condition?: string;
  /** 画布折线，至少 2 个点；DI v0 恒等布局直接采用 */
  waypoints: [Point, Point, ...Point[]];
}

/** 模型树的全部可变状态；私有字段收敛于此，使"从解析树包装"成为可能 */
interface ModelState {
  moddle: InstanceType<typeof BpmnModdle>;
  definitions: ModdleElement;
  process: ModdleElement;
  nodes: Map<string, ModdleElement>;
  flows: Map<string, ModdleElement>;
  shapes: Map<string, CanvasShape>;
  waypoints: Map<string, Point[]>;
}

const DEFAULT_TARGET_NAMESPACE = "http://flowduet.dev/bpmn";

/**
 * BPMN 模型树包装（ROADMAP 接缝之一）。
 *
 * moddle 树是唯一事实源（ADR-0002）；本类只做四件事：
 * 按方言创建树、从解析树恢复包装、维护语义元素与画布几何的登记表、
 * 防御非法引用。序列化交给 Compiler，DI 交给 DiLayout。
 */
export class BpmnModel {
  readonly #state: ModelState;

  private constructor(state: ModelState) {
    this.#state = state;
  }

  static create(spec: BpmnModelSpec): BpmnModel {
    if (spec.processId.trim() === "") {
      throw new Error("processId 不能为空");
    }
    const moddle = new BpmnModdle(spec.adapter.additionalPackages);
    const definitions = moddle.create("bpmn:Definitions", {
      id: spec.definitionsId ?? `${spec.processId}_defs`,
      targetNamespace: spec.targetNamespace ?? DEFAULT_TARGET_NAMESPACE,
    });
    const process = moddle.create("bpmn:Process", {
      id: spec.processId,
      name: spec.processName,
      // Flowable 部署后要求流程可执行；显式写死，避免依赖引擎默认值
      isExecutable: true,
    });
    pushMany(definitions, "rootElements", process);
    return new BpmnModel({
      moddle,
      definitions,
      process,
      nodes: new Map(),
      flows: new Map(),
      shapes: new Map(),
      waypoints: new Map(),
    });
  }

  /**
   * 从 moddle.fromXML 的解析结果包装出模型树：语义元素照单登记，
   * 画布几何从 bpmndi 段恢复（供恒等布局再次投影）。
   * 超出本模型表达范围的元素按只读保留（诚实条款，无损导入在 v1 打磨）。
   */
  static fromParsed(
    moddle: InstanceType<typeof BpmnModdle>,
    definitions: ModdleElement,
  ): BpmnModel {
    const rootElements = (definitions.get("rootElements") as ModdleElement[] | undefined) ?? [];
    const process = rootElements.find((el) => el.$type === "bpmn:Process");
    if (process === undefined) {
      throw new Error("XML 中没有 bpmn:Process，无法包装为模型树");
    }

    const shapes = new Map<string, CanvasShape>();
    const waypoints = new Map<string, Point[]>();
    // 解析后的图落在 definitions.diagrams（BPMNDiagram 不是 bpmn:RootElement）；
    // 兜底扫 rootElements 以兼容手工塞入的树
    const diagrams =
      (definitions.get("diagrams") as ModdleElement[] | undefined) ??
      rootElements.filter((el) => el.$type === "bpmndi:BPMNDiagram");
    for (const diagram of diagrams) {
      const plane = diagram.get("plane") as ModdleElement | undefined;
      if (plane === undefined || plane.get("bpmnElement") !== process) continue;
      const planeElements = (plane.get("planeElement") as ModdleElement[] | undefined) ?? [];
      for (const element of planeElements) {
        const semantic = element.get("bpmnElement") as ModdleElement | undefined;
        const id = semantic?.get("id") as string | undefined;
        if (id === undefined) continue;
        if (element.$type === "bpmndi:BPMNShape") {
          const bounds = element.get("bounds") as ModdleElement | undefined;
          if (bounds !== undefined) {
            shapes.set(id, {
              x: bounds.get("x") as number,
              y: bounds.get("y") as number,
              width: bounds.get("width") as number,
              height: bounds.get("height") as number,
            });
          }
        } else if (element.$type === "bpmndi:BPMNEdge") {
          const points = (element.get("waypoint") as ModdleElement[] | undefined) ?? [];
          waypoints.set(
            id,
            points.map((point) => ({ x: point.get("x") as number, y: point.get("y") as number })),
          );
        }
      }
      break;
    }

    const nodes = new Map<string, ModdleElement>();
    const flows = new Map<string, ModdleElement>();
    const flowElements = (process.get("flowElements") as ModdleElement[] | undefined) ?? [];
    for (const element of flowElements) {
      const id = element.get("id") as string | undefined;
      if (id === undefined) continue;
      if (element.$type === "bpmn:SequenceFlow") {
        flows.set(id, element);
      } else {
        nodes.set(id, element);
      }
    }

    return new BpmnModel({
      moddle,
      definitions,
      process,
      nodes,
      flows,
      shapes,
      waypoints,
    });
  }

  /** moddle 实例（DiLayout 复用同一实例创建 DI 元素） */
  get moddle(): InstanceType<typeof BpmnModdle> {
    return this.#state.moddle;
  }

  get definitions(): ModdleElement {
    return this.#state.definitions;
  }

  get process(): ModdleElement {
    return this.#state.process;
  }

  addStartEvent(spec: NodeSpec): this {
    this.#addNode("bpmn:StartEvent", spec);
    return this;
  }

  addEndEvent(spec: NodeSpec): this {
    this.#addNode("bpmn:EndEvent", spec);
    return this;
  }

  addExclusiveGateway(spec: NodeSpec): this {
    this.#addNode("bpmn:ExclusiveGateway", spec);
    return this;
  }

  addUserTask(spec: UserTaskSpec): this {
    const element = this.#addNode("bpmn:UserTask", spec);
    if (spec.assignee !== undefined) {
      if (spec.assignee.trim() === "") {
        throw new Error(`用户任务 ${spec.id} 的 assignee 不能为空白`);
      }
      element.set("assignee", spec.assignee);
    }
    return this;
  }

  addSequenceFlow(spec: SequenceFlowSpec): this {
    if (this.#state.flows.has(spec.id) || this.#state.nodes.has(spec.id)) {
      throw new Error(`重复的元素 id: ${spec.id}`);
    }
    const source = this.#state.nodes.get(spec.sourceRef);
    const target = this.#state.nodes.get(spec.targetRef);
    if (source === undefined || target === undefined) {
      throw new Error(
        `连线 ${spec.id} 的端点不存在：sourceRef=${spec.sourceRef}, targetRef=${spec.targetRef}`,
      );
    }
    if (spec.condition !== undefined && spec.condition.trim() === "") {
      throw new Error(`连线 ${spec.id} 的 condition 不能为空白`);
    }
    const flow = this.#state.moddle.create("bpmn:SequenceFlow", {
      id: spec.id,
      name: spec.name,
    });
    flow.set("sourceRef", source);
    flow.set("targetRef", target);
    if (spec.condition !== undefined) {
      // FormalExpression 序列化时由 moddle 自动补 xsi:type
      flow.set(
        "conditionExpression",
        this.#state.moddle.create("bpmn:FormalExpression", { body: spec.condition }),
      );
    }
    // BPMN 要求流节点维护 incoming/outgoing 双向引用；二者是 isReference 的
    // SequenceFlow 引用，必须存元素对象，moddle 序列化时才解析为连线 id 文本
    pushMany(source, "outgoing", flow);
    pushMany(target, "incoming", flow);
    pushMany(this.#state.process, "flowElements", flow);
    this.#state.flows.set(spec.id, flow);
    this.#state.waypoints.set(spec.id, spec.waypoints);
    return this;
  }

  shapeOf(id: string): CanvasShape {
    const shape = this.#state.shapes.get(id);
    if (shape === undefined) {
      throw new Error(`元素 ${id} 没有画布形状`);
    }
    return shape;
  }

  waypointsOf(id: string): Point[] {
    const points = this.#state.waypoints.get(id);
    if (points === undefined) {
      throw new Error(`连线 ${id} 没有画布折线`);
    }
    return points;
  }

  /** 用建树时绑定的 moddle 实例序列化（保证方言扩展包在场） */
  toXML(options?: { format?: boolean; preamble?: boolean }): Promise<{ xml: string }> {
    return this.#state.moddle.toXML(this.#state.definitions, options);
  }

  #addNode(type: string, spec: NodeSpec): ModdleElement {
    if (this.#state.nodes.has(spec.id) || this.#state.flows.has(spec.id)) {
      throw new Error(`重复的元素 id: ${spec.id}`);
    }
    const element = this.#state.moddle.create(type, { id: spec.id, name: spec.name });
    pushMany(this.#state.process, "flowElements", element);
    this.#state.nodes.set(spec.id, element);
    this.#state.shapes.set(spec.id, spec.shape);
    return element;
  }
}
