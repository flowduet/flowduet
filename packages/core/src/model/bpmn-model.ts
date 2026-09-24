import { BpmnModdle } from "bpmn-moddle";
import type { ModdleElement } from "bpmn-moddle";
import type { EngineAdapter, TaskKind } from "../adapter/engine-adapter.js";
import { packagesWithFlowduet } from "../adapter/flowduet-package.js";
import { pushMany, removeFromArray } from "../util/moddle-utils.js";

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
  /**
   * 画布形状。钉钉式纵向编辑天然无坐标（#22 起可选）：
   * 缺省时恒等布局在 compile 处诚实抛错，导出请用 verticalDiLayout 推导。
   */
  shape?: CanvasShape;
}

export interface UserTaskSpec extends NodeSpec {
  /** 审批人，Flowable 表达式（如 "${manager}"）或字面量 */
  assignee?: string;
  /** 表单绑定占位（#25 抽屉字段面；Flowable 以 flowable:formKey 序列化） */
  formKey?: string;
}

/**
 * 抄送任务建模参数（R3 决策：经引擎中立任务映射落 ServiceTask + 扩展属性）。
 * 收件人是字面量逗号分隔（"张三,李四"）或运行时表达式（"${ccUsers}"），
 * 单属性承载——XML 属性单值，多值不拆属性。
 *
 * 宿主合同：方言写占位 delegate 引用 ${flowduetCcTask}——部署合法不要求
 * bean 在场，但执行到抄送节点需要宿主绑定该 bean 实现知会行为（ADR-0004）。
 */
export interface CcTaskSpec extends NodeSpec {
  recipients: string;
}

/** addTask 的建模参数（用户任务与抄送任务的并集） */
export type TaskSpec = UserTaskSpec | CcTaskSpec;

/** 多实例审批的完成方式三档（CONTEXT.md：会签 / 或签 / 依次审批） */
export type ApprovalMode = "all" | "any" | "sequential";

/** 完成方式三档全集（测试与工具枚举用） */
export const APPROVAL_MODES: readonly ApprovalMode[] = ["all", "any", "sequential"];

/** 内核按档固化的完成条件（Flowable 多实例内置变量；原型实测形态） */
export const COMPLETION_CONDITIONS: Readonly<Record<Exclude<ApprovalMode, "sequential">, string>> =
  {
    all: "${nrOfCompletedInstances == nrOfInstances}",
    any: "${nrOfCompletedInstances >= 1}",
  };

/**
 * 单实例内引用"当前审批人"的元素变量默认名。
 * 公开导出：designer 侧 setApprovalMode 直改档时须复用同一默认名，
 * 避免本地复刻字面量导致内外核分叉（#25 评审 W1）。
 */
export const DEFAULT_ELEMENT_VARIABLE = "assignee";

/**
 * 多实例审批任务建模参数。完成方式是 BPMN 标准多实例语义（非方言差异），
 * 故不经任务类型映射、直建用户任务；方言属性（collection/elementVariable）
 * 由适配器描述符绑定前缀，与 assignee 同一机制。
 */
export interface ApprovalTaskSpec extends NodeSpec {
  /** 审批人集合表达式，裸变量名（如 "approvers"，运行时流程变量注入） */
  collection: string;
  /** 完成方式：会签（全员同意）/ 或签（任一同意）/ 依次审批（按序逐人） */
  mode: ApprovalMode;
  /** 逐实例元素变量名（任务内引用当前审批人），默认 "assignee" */
  elementVariable?: string;
  /** 表单绑定占位（#25 抽屉字段面；Flowable 以 flowable:formKey 序列化） */
  formKey?: string;
  /**
   * 不支持——三档完成条件由内核固化，传入即抛错。
   * 字段保留在类型上是为了让误用的调用方在运行时得到明确报错而非静默忽略。
   */
  completionCondition?: string;
}

export interface SequenceFlowSpec {
  id: string;
  name?: string;
  /** 必须是已登记的流节点 id */
  sourceRef: string;
  targetRef: string;
  /** 排他网关分支条件（FormalExpression 体）；默认流转不传条件 */
  condition?: string;
  /**
   * 标记本分支为源排他网关的默认流转（「其余情况」）。
   * 调用面归分支（钉钉式抽屉心智），内核落 BPMN 语义：写源网关 default
   * 引用属性。与 condition 互斥；源必须是排他网关；同网关至多一条。
   */
  default?: boolean;
  /**
   * 画布折线，至少 2 个点；恒等布局直接采用。
   * 钉钉式纵向编辑不传（#22 起可选）：缺省时恒等布局在 compile 处
   * 诚实抛错，导出请用 verticalDiLayout 推导。
   */
  waypoints?: [Point, Point, ...Point[]];
}

/** 模型树的全部可变状态；私有字段收敛于此，使"从解析树包装"成为可能 */
interface ModelState {
  moddle: InstanceType<typeof BpmnModdle>;
  definitions: ModdleElement;
  process: ModdleElement;
  /** 绑定的引擎适配器；解析恢复的模型可能未知（addTask 会拒绝） */
  adapter: EngineAdapter | undefined;
  nodes: Map<string, ModdleElement>;
  flows: Map<string, ModdleElement>;
  shapes: Map<string, CanvasShape>;
  waypoints: Map<string, Point[]>;
}

const DEFAULT_TARGET_NAMESPACE = "http://flowduet.dev/bpmn";

/**
 * formKey 字段归一化：空白拒绝 + trim 后落盘（与 assignee/ccTo 口径对齐）。
 * 抽为纯函数便于 addTask/addApprovalTask 在 #addNode 之前前置校验（评审 S-1）：
 * 抛错时不留半写节点，下游无需再写补偿型 fail-fast。
 */
function normalizeFormKey(id: string, formKey: string | undefined): string | undefined {
  if (formKey === undefined) return undefined;
  const trimmed = formKey.trim();
  if (trimmed === "") {
    throw new Error(`任务 ${id} 的 formKey 不能为空白`);
  }
  return trimmed;
}

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
    const moddle = new BpmnModdle(packagesWithFlowduet(spec.adapter));
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
      adapter: spec.adapter,
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
    adapter?: EngineAdapter,
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

    // 多 process 场景下，若 diagram 指向非第一个 process，几何信息会静默丢失；
    // 显式警告，避免后续 compile 时 IdentityDiLayout.attach 抛错难以定位
    if (shapes.size === 0 && waypoints.size === 0) {
      const flowElements = (process.get("flowElements") as ModdleElement[] | undefined) ?? [];
      if (flowElements.length > 0) {
        console.warn(
          "[BpmnModel] 未找到与 process 匹配的 DI 图，几何信息丢失；" +
            "多 process 场景请确保 diagram 指向第一个 bpmn:Process",
        );
      }
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
      adapter,
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

  /**
   * 流程默认表单引用（ADR-0009）：落在 bpmn:Process 的
   * flowduet:defaultFormKey，供未单独指定表单的审批节点继承。
   * XML 是事实源——本访问器只做读写收口与空白守卫。
   */
  get defaultFormKey(): string | undefined {
    return this.#state.process.get("defaultFormKey") as string | undefined;
  }

  setDefaultFormKey(key: string | undefined): this {
    if (key === undefined) {
      this.#state.process.set("defaultFormKey", undefined);
      return this;
    }
    const trimmed = key.trim();
    if (trimmed === "") {
      throw new Error("默认表单 key 不能为空白（传 undefined 清除引用）");
    }
    this.#state.process.set("defaultFormKey", trimmed);
    return this;
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

  addParallelGateway(spec: NodeSpec): this {
    this.#addNode("bpmn:ParallelGateway", spec);
    return this;
  }

  addUserTask(spec: UserTaskSpec): this {
    return this.addTask("user", spec);
  }

  /**
   * 多实例审批任务（会签/或签/依次，CONTEXT.md 三档术语）。
   * 三档完成条件内核固化（依次档语义上无完成条件）；per-instance 指派用
   * ${元素变量} 表达式，集合用裸变量名在运行时注入。
   * XML 形态经 Flowable 6.8 部署 + 启动 + 逐人 assignee 实测
   * （分支 prototype/iter2-vertical-layout-mi）。
   */
  addApprovalTask(spec: ApprovalTaskSpec): this {
    if (spec.completionCondition !== undefined) {
      if (spec.mode === "sequential") {
        throw new Error(`任务 ${spec.id}：依次审批没有完成条件（逐人跑完即通过），不允许覆盖`);
      }
      throw new Error(`任务 ${spec.id}：完成方式三档已固化完成条件，不开放覆盖`);
    }
    // ApprovalMode 仅靠 TS 类型约束；JS 调用方或 as any 绕过时，非法 mode 会静默
    // 落出空 body 的 completionCondition——运行时守卫兜底，与下方空白校验同层
    if (!APPROVAL_MODES.includes(spec.mode)) {
      throw new Error(
        `任务 ${spec.id} 的 mode 必须是 ${APPROVAL_MODES.join("/")} 之一，实际是 ${String(spec.mode)}`,
      );
    }
    if (typeof spec.collection !== "string" || spec.collection.trim() === "") {
      throw new Error(`任务 ${spec.id} 的 collection 不能为空白`);
    }
    // 前后空白原样落盘会让引擎按带空格变量名解析集合、静默取不到值——统一 trim 后再用
    const collection = spec.collection.trim();
    const elementVariable = (spec.elementVariable ?? DEFAULT_ELEMENT_VARIABLE).trim();
    if (elementVariable === "") {
      throw new Error(`任务 ${spec.id} 的 elementVariable 不能为空白`);
    }
    // formKey 空白校验前置到 #addNode 之前：抛错时不留半写节点（评审 S-1）
    const formKey = normalizeFormKey(spec.id, spec.formKey);
    const task = this.#addNode("bpmn:UserTask", spec);
    task.set("assignee", `\${${elementVariable}}`);
    // addApprovalTask 直建 UserTask，元素类型天然合法，无需再做映射校验
    if (formKey !== undefined) {
      task.set("formKey", formKey);
    }
    // isSequential=false 是 XSD 缺省，moddle 序列化时省略（bpmn.io 同款）
    const loop = this.#state.moddle.create("bpmn:MultiInstanceLoopCharacteristics", {
      isSequential: spec.mode === "sequential",
    });
    loop.set("collection", collection);
    loop.set("elementVariable", elementVariable);
    if (spec.mode !== "sequential") {
      loop.set(
        "completionCondition",
        this.#state.moddle.create("bpmn:FormalExpression", {
          body: COMPLETION_CONDITIONS[spec.mode],
        }),
      );
    }
    task.set("loopCharacteristics", loop);
    return this;
  }

  /**
   * 引擎中立的任务建模：经适配器的任务类型映射（合同点三）落成方言任务。
   * 这是"任务类型映射"的消费点——映射由适配器声明，而非写死在内核。
   * 抄送（cc）的方言形态带占位 delegate 引用，执行需宿主绑定 bean（见 CcTaskSpec）。
   */
  addTask(kind: "cc", spec: CcTaskSpec): this;
  addTask(kind: Exclude<TaskKind, "cc">, spec: UserTaskSpec): this;
  addTask(kind: TaskKind, spec: UserTaskSpec | CcTaskSpec): this {
    const adapter = this.#state.adapter;
    if (adapter === undefined) {
      throw new Error("模型未绑定引擎适配器（解析恢复的树请经 parse(xml, { adapter }) 包装）");
    }
    const mapping = adapter.taskTypeMapping[kind];
    if (mapping === undefined) {
      throw new Error(`适配器 ${adapter.id} 未定义任务类型映射：${kind}`);
    }
    // 所有校验前置到 #addNode 之前：任一守卫抛错时不留半写节点（评审 S-1）
    const assignee = "assignee" in spec ? spec.assignee : undefined;
    if (assignee !== undefined) {
      if (assignee.trim() === "") {
        throw new Error(`任务 ${spec.id} 的 assignee 不能为空白`);
      }
      if (mapping.elementType !== "bpmn:UserTask") {
        throw new Error(`任务类型 ${kind} 的方言形态是 ${mapping.elementType}，不支持 assignee`);
      }
    }
    const formKey = normalizeFormKey(
      spec.id,
      "formKey" in spec ? (spec as UserTaskSpec).formKey : undefined,
    );
    // formKey 仅在适配器为其声明了扩展属性的元素类型上合法（当前只有 UserTask）：
    // 未声明的类型上直写会落进 moddle $attrs、序列化时丢掉 flowable 前缀，
    // 产出 schema 非法 XML——引擎侧静默忽略，严格校验器报未知属性（评审 C-2）
    if (formKey !== undefined && mapping.elementType !== "bpmn:UserTask") {
      throw new Error(`任务类型 ${kind} 的方言形态是 ${mapping.elementType}，不支持 formKey`);
    }
    let recipientsTrimmed: string | undefined;
    if (kind === "cc") {
      // 仅靠 TS 类型约束不够（JS 调用方可绕过）；收件人带空白落盘会让
      // 引擎按带空格的表达式/名单解析，静默取不到人——统一校验并 trim
      const recipients = "recipients" in spec ? spec.recipients : undefined;
      if (typeof recipients !== "string" || recipients.trim() === "") {
        throw new Error(`抄送任务 ${spec.id} 的 recipients 不能为空白`);
      }
      recipientsTrimmed = recipients.trim();
    } else if ("recipients" in spec) {
      // 对称守卫：JS 调用方可能绕过 TS 类型，把 recipients 传给非 cc 任务
      throw new Error(`任务类型 ${kind} 不支持 recipients（仅抄送任务支持）`);
    }
    // 前置校验全通过后再动模型
    const element = this.#addNode(mapping.elementType, spec);
    if (assignee !== undefined) {
      element.set("assignee", assignee);
    }
    if (formKey !== undefined) {
      element.set("formKey", formKey);
    }
    if (recipientsTrimmed !== undefined) {
      // ccTo 是语义名，方言前缀由适配器描述符绑定（与 assignee 同一机制）
      element.set("ccTo", recipientsTrimmed);
    }
    for (const [attr, value] of Object.entries(mapping.attributes ?? {})) {
      element.set(attr, value);
    }
    return this;
  }

  addSequenceFlow(spec: SequenceFlowSpec): this {
    if (spec.waypoints !== undefined && spec.waypoints.length < 2) {
      throw new Error(`连线 ${spec.id} 的 waypoints 至少需要 2 个点`);
    }
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
    // 默认流转三重守卫：语义互斥、源限定排他网关、同网关唯一（R2 决策）
    if (spec.default === true) {
      if (spec.condition !== undefined) {
        throw new Error(
          `默认流转 ${spec.id} 不能同时携带条件表达式（默认分支是"其余情况"，语义互斥）`,
        );
      }
      if (source.$type !== "bpmn:ExclusiveGateway") {
        throw new Error(`默认流转 ${spec.id} 的源必须是排他网关，实际是 ${source.$type}`);
      }
      if (source.get("default") !== undefined) {
        throw new Error(`排他网关 ${spec.sourceRef} 已有默认流转，连线 ${spec.id} 不得重复标记`);
      }
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
    if (spec.default === true) {
      // default 是网关的 isReference 属性：存元素对象，序列化为连线 id 文本
      source.set("default", flow);
    }
    // BPMN 要求流节点维护 incoming/outgoing 双向引用；二者是 isReference 的
    // SequenceFlow 引用，必须存元素对象，moddle 序列化时才解析为连线 id 文本
    pushMany(source, "outgoing", flow);
    pushMany(target, "incoming", flow);
    pushMany(this.#state.process, "flowElements", flow);
    this.#state.flows.set(spec.id, flow);
    if (spec.waypoints !== undefined) {
      this.#state.waypoints.set(spec.id, spec.waypoints);
    }
    return this;
  }

  /** 移除一条连线：流程元素、双向引用、网关 default 引用与登记表同步清理 */
  removeSequenceFlow(id: string): this {
    const flow = this.#state.flows.get(id);
    if (flow === undefined) {
      throw new Error(`连线 ${id} 不存在`);
    }
    removeFromArray(this.#state.process, "flowElements", flow);
    const source = flow.get("sourceRef") as ModdleElement;
    const target = flow.get("targetRef") as ModdleElement;
    removeFromArray(source, "outgoing", flow);
    removeFromArray(target, "incoming", flow);
    if (source.get("default") === flow) {
      source.set("default", undefined);
    }
    this.#state.flows.delete(id);
    this.#state.waypoints.delete(id);
    return this;
  }

  /** 移除一个节点及其全部关联连线（级联）；开始/结束事件的去留由调用方决定 */
  removeNode(id: string): this {
    const node = this.#state.nodes.get(id);
    if (node === undefined) {
      throw new Error(`节点 ${id} 不存在`);
    }
    const incoming = [...((node.get("incoming") as ModdleElement[] | undefined) ?? [])];
    const outgoing = [...((node.get("outgoing") as ModdleElement[] | undefined) ?? [])];
    for (const flow of [...incoming, ...outgoing]) {
      this.removeSequenceFlow(flow.get("id") as string);
    }
    removeFromArray(this.#state.process, "flowElements", node);
    this.#state.nodes.delete(id);
    this.#state.shapes.delete(id);
    return this;
  }

  /**
   * 语义元素读访问器（节点与连线）：抽屉等编辑面经此直接读写模型字段
   * （R4 决策——视图无独立状态，字段变更直达模型树）。
   */
  elementOf(id: string): ModdleElement {
    const element = this.#state.nodes.get(id) ?? this.#state.flows.get(id);
    if (element === undefined) {
      throw new Error(`元素 ${id} 不存在`);
    }
    return element;
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
    if (spec.shape !== undefined) {
      this.#state.shapes.set(spec.id, spec.shape);
    }
    return element;
  }
}
