import { BpmnModdle } from "bpmn-moddle";
import type { EngineAdapter } from "../adapter/engine-adapter.js";
import { BpmnModel } from "../model/bpmn-model.js";

export interface ParseOptions {
  /**
   * 引擎适配器：解析方言扩展属性（如 flowable:assignee）时需要同样的
   * 扩展包在场。适配器与建模时绑定的必须是同一方言。
   */
  adapter: EngineAdapter;
}

/**
 * 解析：引擎方言 XML → 模型树（ROADMAP 接缝之一）。
 * 语义元素与 bpmndi 几何全部登记进包装，供属性面板与再次编译使用。
 */
export async function parse(xml: string, options: ParseOptions): Promise<BpmnModel> {
  if (xml.trim() === "") {
    throw new Error("XML 不能为空白");
  }
  const moddle = new BpmnModdle(options.adapter.additionalPackages);
  const { rootElement } = await moddle.fromXML(xml);
  return BpmnModel.fromParsed(moddle, rootElement, options.adapter);
}
