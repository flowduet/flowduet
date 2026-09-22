import { compile, verticalDiLayout } from "@flowduet/core";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { CC_RECIPIENTS_PLACEHOLDER } from "./operations.js";

/**
 * 草稿字段扫描（评审 S-5）：#25 引入的两处「插入即带占位」形态可绕过抽屉直接导出——
 *   ・抄送节点插入时 ccTo = CC_RECIPIENTS_PLACEHOLDER，抽屉守卫只在保存路径生效；
 *   ・多→单切换留空 assignee 的 UserTask，或多实例集合变量被宿主直接改空。
 * 部署不报错、运行时静默丢知会/取不到人，属可导出的脏数据。
 * 全模型系统性校验另立 #35；此处只拦 #25 自己引入的两个源头，成本低、口径明确。
 */
function assertNoDraftFields(model: BpmnModel): void {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  for (const el of elements) {
    const label = String(el.get("name") ?? el.get("id") ?? "");
    if (el.$type === "bpmn:ServiceTask") {
      const ccTo = el.get("ccTo");
      // 非抄送 ServiceTask（当前适配器不产出，防御宿主直写）跳过
      if (ccTo === undefined) continue;
      if (String(ccTo).trim() === CC_RECIPIENTS_PLACEHOLDER) {
        throw new Error(`抄送节点「${label}」的收件人仍是插入占位串，请在抽屉填真实名单后再导出`);
      }
      continue;
    }
    if (el.$type === "bpmn:UserTask") {
      const loop = el.get("loopCharacteristics") as ModdleElement | undefined;
      if (loop === undefined) continue;
      const collection = String(loop.get("collection") ?? "").trim();
      if (collection === "") {
        throw new Error(`多人审批节点「${label}」的集合变量为空白，请在抽屉补填后再导出`);
      }
    }
  }
}

/**
 * XML 导出入口（顶层组件接缝的一部分）：
 * 钉钉式编辑无画布坐标，导出固定走竖排布局推导 DI。
 * 前置草稿扫描（评审 S-5）：拒绝部署合法但运行时静默失效的形态。
 */
export async function exportXml(model: BpmnModel): Promise<string> {
  assertNoDraftFields(model);
  return compile(model, { diLayout: verticalDiLayout() });
}
