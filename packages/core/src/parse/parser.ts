import { BpmnModdle } from "bpmn-moddle";
import type { EngineAdapter } from "../adapter/engine-adapter.js";
import { packagesWithFlowduet } from "../adapter/flowduet-package.js";
import { BpmnModel } from "../model/bpmn-model.js";
import { collectUnregisteredNamespaceUsage } from "./namespace-usage.js";
import type { NamespaceUsageIssue } from "./namespace-usage.js";

export interface ParseOptions {
  /**
   * 引擎适配器：解析方言扩展属性（如 flowable:assignee）时需要同样的
   * 扩展包在场。适配器与建模时绑定的必须是同一方言。
   */
  adapter: EngineAdapter;
  /** 文档恢复可主动拒绝解析警告；默认保持既有宽松解析行为。 */
  rejectWarnings?: boolean;
  /**
   * 文档恢复可主动拒绝「实际使用未注册命名空间」的扩展内容；默认关闭，
   * 既有调用者行为不变。动机：moddle 对未注册 URI 的带前缀属性不告警
   * 而静默收进 $attrs，语义丢失不可见（详见 namespace-usage.ts）。
   */
  rejectUnregisteredNamespaces?: boolean;
}

/** 命名空间审计错误：组合恢复路径可据 instanceof 单独包装诊断上下文 */
export class UnregisteredNamespaceError extends Error {
  readonly issues: readonly NamespaceUsageIssue[];
  constructor(issues: readonly NamespaceUsageIssue[]) {
    super(formatNamespaceIssues(issues));
    this.name = "UnregisteredNamespaceError";
    this.issues = issues;
  }
}

function formatNamespaceIssues(issues: readonly NamespaceUsageIssue[]): string {
  const details = issues
    .map((issue) =>
      issue.uri === ""
        ? `第 ${issue.line} 行的 ${issue.qualifiedName}（前缀 "${issue.prefix}" 未声明）`
        : `第 ${issue.line} 行的 ${issue.qualifiedName}（前缀 "${issue.prefix}"，命名空间 ${issue.uri}）`,
    )
    .join("；");
  return `XML 实际使用了未注册命名空间的内容：${details}。这些内容不在目标适配器与项目协议的已注册扩展范围内，无法无损恢复，拒绝打开`;
}

/**
 * 解析：引擎方言 XML → 模型树（ROADMAP 接缝之一）。
 * 语义元素与 bpmndi 几何全部登记进包装，供属性面板与再次编译使用。
 */
export async function parse(xml: string, options: ParseOptions): Promise<BpmnModel> {
  if (xml.trim() === "") {
    throw new Error("XML 不能为空白");
  }
  const moddle = new BpmnModdle(packagesWithFlowduet(options.adapter));
  const { rootElement, warnings = [] } = await moddle.fromXML(xml);
  if (options.rejectUnregisteredNamespaces) {
    // 审计放在解析成功之后：结构坏 XML 先由解析层报「无法解析」，
    // 审计只针对「能解析但未注册扩展被静默收进 $attrs」的语义丢失。
    // 已注册集合以 moddle registry 为准（标准四包 + 适配器方言 + 项目协议），
    // 新适配器注册扩展包后自动进入放行范围，无需维护第二份名单
    const packages = (moddle as unknown as { registry: { packages: Array<{ uri: string }> } })
      .registry.packages;
    const registered = new Set(packages.map((pkg) => pkg.uri));
    const issues = collectUnregisteredNamespaceUsage(xml, registered);
    if (issues.length > 0) {
      throw new UnregisteredNamespaceError(issues);
    }
  }
  if (options.rejectWarnings && warnings.length > 0) {
    throw new Error(`XML 解析产生警告：${warnings.map((warning) => warning.message).join("\n")}`);
  }
  return BpmnModel.fromParsed(moddle, rootElement, options.adapter);
}
