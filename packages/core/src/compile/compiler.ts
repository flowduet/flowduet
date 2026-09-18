import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "../model/bpmn-model";
import { IdentityDiLayout } from "../layout/di-layout";
import type { DiLayout } from "../layout/di-layout";

export interface CompileOptions {
  /** 缺省用恒等布局（画布坐标直映射，v0 口径）；钉钉式导出换自动布局器 */
  diLayout?: DiLayout;
}

/** 清除树上已有的 DI 图，保证投影由本次 compile 全权生成（幂等的关键） */
function stripDi(model: BpmnModel): void {
  const definitions = model.definitions;
  const roots = definitions.get("rootElements") as ModdleElement[] | undefined;
  if (roots !== undefined && roots.some((el) => el.$type === "bpmndi:BPMNDiagram")) {
    definitions.set(
      "rootElements",
      roots.filter((el) => el.$type !== "bpmndi:BPMNDiagram"),
    );
  }
  definitions.set("diagrams", []);
}

/**
 * 编译：模型树 + DI 布局 → 引擎方言 XML。
 * 这是"唯一事实源导出即合法 BPMN"硬承诺的执行点（ADR-0002）；
 * 方言差异已由建模时绑定的适配器写进树里，此处只负责投影与序列化。
 * 幂等：对同一模型或解析恢复的模型重复编译，产出完全一致。
 */
export async function compile(model: BpmnModel, options: CompileOptions = {}): Promise<string> {
  stripDi(model);
  const diLayout = options.diLayout ?? new IdentityDiLayout();
  diLayout.attach(model);
  const { xml } = await model.toXML({ format: true });
  return xml;
}
