import { compile, verticalDiLayout } from "@flowduet/core";
import type { BpmnModel } from "@flowduet/core";

/**
 * XML 导出入口（顶层组件接缝的一部分）：
 * 钉钉式编辑无画布坐标，导出固定走竖排布局推导 DI。
 */
export async function exportXml(model: BpmnModel): Promise<string> {
  return compile(model, { diLayout: verticalDiLayout() });
}
