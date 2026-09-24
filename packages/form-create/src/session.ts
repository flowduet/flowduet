import { BpmnModel, flowableAdapter } from "@flowduet/core";
import type { DesignerFormOption } from "@flowduet/designer";
import { openDesignDocument, saveDesignDocument } from "./document.js";
import type {
  FormDefinition,
  OpenDesignDocumentResult,
  SaveDesignDocumentResult,
} from "./document.js";
import { collectReferenceIssues } from "./binding.js";
import { assertFormDefinitionValid } from "./form-schema.js";

/** 表单内容（rules/options 序列化字符串）的最小可编辑初值 */
const EMPTY_FORM_RULES = "[]";
const EMPTY_FORM_OPTIONS = "{}";

/** 会话状态：流程模型与表单目录是一个整体，校验通过后整体替换（原子恢复） */
export interface FlowDesignState {
  model: BpmnModel;
  forms: readonly FormDefinition[];
}

export interface FlowDesignSessionInit {
  model: BpmnModel;
  forms?: readonly FormDefinition[];
}

export interface NewDesignOptions {
  processId?: string;
  processName?: string;
}

/**
 * 组合编辑会话（迭代三 #71 的最小组合入口）：持有「流程模型 + 表单目录」
 * 整体状态，向宿主提供新建、保存、打开三个动作。宿主只负责文件 I/O 与展示
 * （下载、读文件、把返回的模型接进视图），文档编解码全部收敛在本包。
 *
 * 模型刻意不做响应式：宿主用 shallowRef 持有返回的模型实例接视图即可，
 * 本类保持框架中立，后续表单票在此扩展为完整编辑装配而不更换接口形态。
 */
export class FlowDesignSession {
  #state: FlowDesignState | undefined;
  /** 状态换代序号：迟到的异步结果不覆盖更新的同步替换（新建/打开竞态守卫） */
  #revision = 0;

  constructor(initial?: BpmnModel | FlowDesignSessionInit) {
    if (initial === undefined) return;
    if (initial instanceof BpmnModel) {
      this.#state = { model: initial, forms: [] };
      return;
    }
    this.#state = { model: initial.model, forms: initial.forms ?? [] };
  }

  /** 当前状态；尚未初始化（未传初始模型、未新建、未打开）时为 undefined */
  get current(): FlowDesignState | undefined {
    return this.#state;
  }

  /**
   * 新建最小可编辑流程（开始 → 审批 → 结束），整体替换当前状态。
   * 审批节点刻意不带审批人：新设计天然是业务草稿——保存可用、部署导出会拦截，
   * 与「保存与部署导出是不同合同」的设计一致。
   */
  newDesign(options: NewDesignOptions = {}): BpmnModel {
    this.#revision += 1;
    const model = BpmnModel.create({
      processId: options.processId ?? "flow_1",
      processName: options.processName ?? "未命名流程",
      adapter: flowableAdapter,
    })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "approval_1", name: "审批节点" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "flow_start", sourceRef: "start", targetRef: "approval_1" })
      .addSequenceFlow({ id: "flow_end", sourceRef: "approval_1", targetRef: "end" });
    this.#state = { model, forms: [] };
    return model;
  }

  /** 保存当前设计为流程设计文档；业务草稿允许保存，待修复项随结果返回 */
  async save(): Promise<SaveDesignDocumentResult> {
    const state = this.#state;
    if (state === undefined) {
      throw new Error("会话中没有可保存的设计：请先新建设计或打开文档");
    }
    return saveDesignDocument(state.model, state.forms);
  }

  /**
   * 打开设计文档：外层格式、XML 与可编辑结构全部校验通过后才整体替换当前状态，
   * 任一失败保留原状态。revision 守卫：校验期间发生更新的新建/打开时，
   * 迟到的本次结果拒绝落地，当前状态保持为最新操作的结果。
   */
  async open(text: string): Promise<FlowDesignState> {
    const revision = ++this.#revision;
    const result: OpenDesignDocumentResult = await openDesignDocument(text);
    if (revision !== this.#revision) {
      throw new Error("本次打开已被更新的新建或打开操作取代，当前状态保持为最新操作的结果");
    }
    const state: FlowDesignState = { model: result.model, forms: result.forms };
    this.#state = state;
    return state;
  }

  // ---------- 表单目录管理（#72：创建 / 命名 / 内容编辑） ----------

  /**
   * 新建表单：生成文档内唯一且稳定的 id（改名不换 ID），内容为空规则。
   * 返回创建的定义副本；后续经 updateFormContent 写入设计器产物。
   */
  createForm(name: string): FormDefinition {
    const state = this.#requireState();
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new Error("表单名称不能为空白");
    }
    const form: FormDefinition = {
      id: this.#nextFormId(state.forms),
      name: trimmed,
      provider: "form-create/element-plus",
      rules: EMPTY_FORM_RULES,
      options: EMPTY_FORM_OPTIONS,
    };
    this.#state = { model: state.model, forms: [...state.forms, form] };
    return { ...form };
  }

  /** 表单改名：名称非空校验；ID 保持不变，已有绑定持续有效 */
  renameForm(id: string, name: string): void {
    const state = this.#requireState();
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new Error("表单名称不能为空白");
    }
    this.#requireForm(state, id);
    this.#state = {
      model: state.model,
      forms: state.forms.map((form) => (form.id === id ? { ...form, name: trimmed } : form)),
    };
  }

  /**
   * 写入设计器产物：rules / options 必须是可解析且在支持范围内的序列化字符串。
   * 校验失败时目录不变（不留半写状态）。
   */
  updateFormContent(id: string, rules: string, options: string): void {
    const state = this.#requireState();
    const next: FormDefinition = {
      ...this.#requireForm(state, id),
      rules,
      options,
    };
    // 在副本上做结构校验（含 JSON 可解析与文本字段子集守卫），通过后才落目录
    assertFormDefinitionValid(
      next,
      new Set(state.forms.filter((f) => f.id !== id).map((f) => f.id)),
    );
    this.#state = {
      model: state.model,
      forms: state.forms.map((form) => (form.id === id ? next : form)),
    };
  }

  /** 表单目录的中立摘要（designer 的 formOptions 接缝直接可用） */
  formOptions(): DesignerFormOption[] {
    const state = this.#state;
    return state === undefined ? [] : state.forms.map((form) => ({ id: form.id, name: form.name }));
  }

  /** 当前引用诊断：默认 / 节点 key 指向目录外定义的失效项（含定位） */
  get referenceIssues(): string[] {
    const state = this.#state;
    return state === undefined ? [] : collectReferenceIssues(state.model, state.forms);
  }

  #requireState(): FlowDesignState {
    if (this.#state === undefined) {
      throw new Error("会话中没有可操作的设计：请先新建设计或打开文档");
    }
    return this.#state;
  }

  #requireForm(state: FlowDesignState, id: string): FormDefinition {
    const form = state.forms.find((candidate) => candidate.id === id);
    if (form === undefined) {
      throw new Error(`表单 ${id} 不存在`);
    }
    return form;
  }

  #nextFormId(existing: readonly FormDefinition[]): string {
    let index = existing.length + 1;
    const ids = new Set(existing.map((form) => form.id));
    while (ids.has(`form_${index}`)) index += 1;
    return `form_${index}`;
  }
}
