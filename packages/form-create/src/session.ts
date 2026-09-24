import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { openDesignDocument, saveDesignDocument } from "./document.js";
import type {
  FormDefinition,
  OpenDesignDocumentResult,
  SaveDesignDocumentResult,
} from "./document.js";

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
}
