import type { BpmnModel } from "../model/bpmn-model";
import { IdentityDiLayout } from "../layout/di-layout";
import type { DiLayout } from "../layout/di-layout";

export interface CompileOptions {
  /** 缺省用恒等布局（画布坐标直映射，v0 口径）；钉钉式导出换自动布局器 */
  diLayout?: DiLayout;
}

/**
 * 编译：模型树 + DI 布局 → 引擎方言 XML。
 * 这是"唯一事实源导出即合法 BPMN"硬承诺的执行点（ADR-0002）；
 * 方言差异已由建模时绑定的适配器写进树里，此处只负责投影与序列化。
 */
export async function compile(model: BpmnModel, options: CompileOptions = {}): Promise<string> {
  const diLayout = options.diLayout ?? new IdentityDiLayout();
  diLayout.attach(model);
  const { xml } = await model.toXML({ format: true });
  return xml;
}
