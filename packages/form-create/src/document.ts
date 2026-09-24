import type { BpmnModel, ModdleElement } from "@flowduet/core";
import {
  compile,
  deriveVerticalGeometry,
  flowableAdapter,
  parse,
  verticalDiLayout,
} from "@flowduet/core";
import { collectDraftIssues, isCcServiceTask } from "@flowduet/designer";
import { assertFormDefinitionValid } from "./form-schema.js";
import { collectReferenceIssues } from "./binding.js";

/**
 * 流程设计文档（ADR-0009）：外层 JSON 封装单流程 BPMN XML 与文档内全部表单定义。
 * 流程结构与表单绑定以 XML 为事实源，外层不另存第二份可写关系。
 * #72 起表单目录可携带真实定义（文本字段），尚未绑定的表单也随文档保存。
 */
export const DESIGN_DOCUMENT_FORMAT = "flowduet.design" as const;
export const DESIGN_DOCUMENT_VERSION = 1 as const;
export const DESIGN_DOCUMENT_ENGINE = "flowable" as const;

/**
 * 表单定义（#72 起携带真实内容）：rules / options 由匹配版本的 FormCreate
 * 设计器接口成对序列化保存恢复，不能只存规则丢布局与表单配置。
 */
export interface FormDefinition {
  /** 文档内唯一且稳定；改名不换 ID */
  id: string;
  /** 非空显示名 */
  name: string;
  /** 提供者标识，固定 "form-create/element-plus" */
  provider: string;
  /** FormCreate 序列化字段规则（JSON 字符串） */
  rules: string;
  /** 表单配置序列化（JSON 字符串，与 rules 同接口版本配对） */
  options: string;
}

export interface FlowDesignDocument {
  format: typeof DESIGN_DOCUMENT_FORMAT;
  version: typeof DESIGN_DOCUMENT_VERSION;
  engine: typeof DESIGN_DOCUMENT_ENGINE;
  /** 单流程 BPMN XML（含流程结构与表单绑定，保存时生成可恢复 DI） */
  xml: string;
  /** 文档内全部表单定义（含尚未绑定） */
  forms: FormDefinition[];
}

export interface SaveDesignDocumentResult {
  document: FlowDesignDocument;
  /** 宿主可直接落盘的 JSON 文本（缩进两格，便于 diff 与人工检查） */
  json: string;
  /** 业务草稿待修复项：不阻塞保存，部署导出（exportDeployXml）会拦截 */
  pendingIssues: string[];
  /** 表单引用失效项：同样不阻塞保存（保留 key 的草稿），部署导出会拦截 */
  referenceIssues: string[];
}

export interface OpenDesignDocumentResult {
  document: FlowDesignDocument;
  model: BpmnModel;
  forms: FormDefinition[];
}

/** 钉钉式编辑子集内的流元素类型；ServiceTask 需另行认抄送形态 */
const SUBSET_ELEMENT_TYPES = new Set([
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:UserTask",
  "bpmn:SequenceFlow",
]);

function labelOf(element: ModdleElement): string {
  const id = String(element.get("id") ?? "");
  const name = String(element.get("name") ?? "").trim();
  return name !== "" && name !== id ? `${name}（${id}）` : id;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 保存：当前模型 → 流程设计文档。
 * 与部署导出的合同区别——保存只要求「结构可恢复」（竖排推导能产出可恢复 DI，
 * 且产物重新解析后仍通过打开侧同一套结构守卫），审批人 / 条件等业务配置
 * 未配齐属于草稿，允许保存并随结果报告待修复项。
 * 注意：与 compile 的既有行为一致，本调用会重写模型树上的 DI 段（幂等投影）。
 */
export async function saveDesignDocument(
  model: BpmnModel,
  forms: readonly FormDefinition[] = [],
): Promise<SaveDesignDocumentResult> {
  // 表单定义结构守卫：重复 id、空名、未知提供者、坏 JSON、超范围字段都拒绝保存
  const knownIds = new Set<string>();
  for (const form of forms) {
    assertFormDefinitionValid(form, knownIds);
  }
  const xml = await compile(model, { diLayout: verticalDiLayout() });
  // 可恢复性自证：产物重新解析后必须仍能通过打开侧的结构守卫，防止序列化丢语义
  const reparsed = await parseForRestore(xml);
  assertEditableStructure(reparsed, "保存的流程结构无法恢复");
  restoreFlowReferences(reparsed);
  const document: FlowDesignDocument = {
    format: DESIGN_DOCUMENT_FORMAT,
    version: DESIGN_DOCUMENT_VERSION,
    engine: DESIGN_DOCUMENT_ENGINE,
    xml,
    forms: forms.map((form) => ({ ...form })),
  };
  return {
    document,
    json: JSON.stringify(document, null, 2),
    pendingIssues: collectDraftIssues(reparsed),
    // 引用失效不阻塞保存（保留 key 的草稿）；部署导出侧另行阻断
    referenceIssues: collectReferenceIssues(reparsed, forms),
  };
}

/**
 * 打开：设计文档文本 → 模型 + 表单目录。
 * 全部校验在返回前完成，调用方据此原子替换当前状态；
 * 任一环节失败抛错，不产出半成品结果。
 */
export async function openDesignDocument(text: string): Promise<OpenDesignDocumentResult> {
  const document = parseEnvelope(text);
  const model = await parseForRestore(document.xml);
  assertEditableStructure(model, "文档流程超出可编辑范围");
  restoreFlowReferences(model);
  return { document, model, forms: document.forms };
}

/**
 * incoming/outgoing 是可省略的节点侧引用；以顺序流端点重建，保证恢复后的
 * 插入、删除与草稿扫描都读取同一套连线关系，而非把省略误判为没有连线。
 */
function restoreFlowReferences(model: BpmnModel): void {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  const references = new Map<
    ModdleElement,
    { incoming: ModdleElement[]; outgoing: ModdleElement[] }
  >();
  for (const element of elements) {
    if (element.$type !== "bpmn:SequenceFlow") {
      references.set(element, { incoming: [], outgoing: [] });
    }
  }
  for (const flow of elements) {
    if (flow.$type !== "bpmn:SequenceFlow") continue;
    const source = references.get(flow.get("sourceRef") as ModdleElement);
    const target = references.get(flow.get("targetRef") as ModdleElement);
    if (source === undefined || target === undefined) {
      throw new Error(`顺序流「${labelOf(flow)}」的端点不属于当前流程节点`);
    }
    source.outgoing.push(flow);
    target.incoming.push(flow);
  }
  for (const [element, refs] of references) {
    element.set("incoming", refs.incoming);
    element.set("outgoing", refs.outgoing);
  }
}

function previewValue(value: unknown): string {
  return value === undefined ? "缺失" : JSON.stringify(value);
}

/** 外层协议校验：格式、版本、引擎、xml 与 forms 逐一核对，未知值明确拒绝 */
function parseEnvelope(text: string): FlowDesignDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`设计文档不是合法 JSON：${messageOf(e)}`, { cause: e });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("设计文档必须是 JSON 对象");
  }
  const doc = raw as Record<string, unknown>;
  if (doc.format !== DESIGN_DOCUMENT_FORMAT) {
    throw new Error(
      `未知的设计文档格式：期望 "${DESIGN_DOCUMENT_FORMAT}"，实际 ${previewValue(doc.format)}`,
    );
  }
  if (doc.version !== DESIGN_DOCUMENT_VERSION) {
    throw new Error(
      `不支持的设计文档版本：期望 ${DESIGN_DOCUMENT_VERSION}，实际 ${previewValue(doc.version)}；不自动迁移`,
    );
  }
  if (doc.engine !== DESIGN_DOCUMENT_ENGINE) {
    throw new Error(
      `不支持的目标引擎：期望 "${DESIGN_DOCUMENT_ENGINE}"，实际 ${previewValue(doc.engine)}；不猜测适配器`,
    );
  }
  if (typeof doc.xml !== "string" || doc.xml.trim() === "") {
    throw new Error("设计文档缺少非空的 xml 字段");
  }
  if (!Array.isArray(doc.forms)) {
    throw new Error("设计文档的 forms 字段必须是数组");
  }
  // 表单目录逐项校验：结构坏（重复 id / 空 name / 未知提供者 / 坏 JSON / 超范围字段）
  // 属于无法恢复的内容，明确拒绝打开；引用失效（key 不在目录）不在此列——可作草稿打开
  const forms: FormDefinition[] = [];
  const knownIds = new Set<string>();
  for (const raw of doc.forms) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("设计文档的 forms 每一项都必须是表单定义对象");
    }
    const entry = raw as Record<string, unknown>;
    const form: FormDefinition = {
      id: String(entry.id ?? ""),
      name: String(entry.name ?? ""),
      provider: String(entry.provider ?? ""),
      rules: typeof entry.rules === "string" ? entry.rules : "",
      options: typeof entry.options === "string" ? entry.options : "",
    };
    if (typeof entry.rules !== "string" || typeof entry.options !== "string") {
      throw new Error(`表单 ${form.id || "（缺 id）"} 的 rules/options 必须是字符串`);
    }
    assertFormDefinitionValid(form, knownIds);
    forms.push(form);
  }
  return {
    format: DESIGN_DOCUMENT_FORMAT,
    version: DESIGN_DOCUMENT_VERSION,
    engine: DESIGN_DOCUMENT_ENGINE,
    xml: doc.xml,
    forms,
  };
}

/** XML → 模型：统一错误出口，解析失败带上上下文前缀 */
async function parseForRestore(xml: string): Promise<BpmnModel> {
  try {
    return await parse(xml, { adapter: flowableAdapter, rejectWarnings: true });
  } catch (e) {
    throw new Error(`文档 XML 无法解析：${messageOf(e)}`, { cause: e });
  }
}

/**
 * 可编辑结构守卫（保存自证与打开共用同一口径）：
 * 1. 单流程——多流程明确拒绝，不静默取第一个（BPMN 流程只能作为
 *    definitions 的根元素出现，含协作/泳道的多流程形态同样按此计数命中）；
 * 2. 流元素在钉钉式编辑子集内（ServiceTask 仅放行 designer 判定的抄送
 *    形态），超子集内容拒绝而非静默删减；
 * 3. 竖排推导可行——它是钉钉式渲染与 DI 恢复的共用读视图，
 *    循环、多开始、不可达等不良构图形在此显式拒绝。
 */
function assertEditableStructure(model: BpmnModel, context: string): void {
  const roots = (model.definitions.get("rootElements") as ModdleElement[] | undefined) ?? [];
  const processCount = roots.filter((el) => el.$type === "bpmn:Process").length;
  if (processCount > 1) {
    throw new Error(`${context}：XML 包含 ${processCount} 个流程，本编辑器一次只编辑单流程文档`);
  }
  const flowElements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  for (const element of flowElements) {
    if (SUBSET_ELEMENT_TYPES.has(element.$type)) continue;
    if (isCcServiceTask(element)) continue;
    throw new Error(
      `${context}：流程元素「${labelOf(element)}」（${element.$type}）超出本编辑器支持的流程子集`,
    );
  }
  try {
    deriveVerticalGeometry(model);
  } catch (e) {
    throw new Error(`${context}：${messageOf(e)}`, { cause: e });
  }
}
