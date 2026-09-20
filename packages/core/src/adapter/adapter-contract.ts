import type { EngineAdapter, TaskKind } from "./engine-adapter.js";
import { TASK_KINDS } from "./engine-adapter.js";
import { BpmnModel } from "../model/bpmn-model.js";
import { compile } from "../compile/compiler.js";

const SAMPLE_SHAPE = { x: 160, y: 160, width: 100, height: 80 };

/**
 * 适配器合同（ADR-0005 三收敛点的机器可验收形式）。
 *
 * 任何 EngineAdapter 实现都必须通过本合同；违反即抛错。
 * 刻意不依赖测试框架——随包发布，社区适配器作者可直接复用。
 */
export async function assertAdapterContract(adapter: EngineAdapter): Promise<void> {
  const prefix = adapter.namespacePrefix;

  // 点一：命名空间前缀——扩展包必须以方言前缀注册
  if (adapter.additionalPackages[prefix] === undefined) {
    throw new Error(`[合同点一] additionalPackages 缺少以方言前缀 ${prefix} 注册的扩展包`);
  }

  // 点二：扩展属性 schema——用户任务的审批人以方言前缀序列化
  const userFlow = BpmnModel.create({ processId: "adapter_contract_user", adapter }).addUserTask({
    id: "review",
    name: "审批",
    assignee: "contract-user",
    shape: SAMPLE_SHAPE,
  });
  const userXml = await compile(userFlow);
  if (!userXml.includes(`xmlns:${prefix}=`)) {
    throw new Error("[合同点一] 序列化输出未声明方言命名空间前缀");
  }
  if (!userXml.includes(`${prefix}:assignee="contract-user"`)) {
    throw new Error(`[合同点二] 扩展属性 schema 未把 assignee 以 ${prefix}:assignee 序列化`);
  }

  // 点三：任务类型映射——完备、可创建、方言属性可序列化
  for (const kind of TASK_KINDS) {
    if (adapter.taskTypeMapping[kind] === undefined) {
      throw new Error(`[合同点三] 任务类型映射缺少 ${kind satisfies TaskKind}`);
    }
  }
  const mailMapping = adapter.taskTypeMapping["mail"];
  if (mailMapping === undefined) {
    throw new Error("[合同点三] 任务类型映射缺少 mail");
  }
  const mailFlow = BpmnModel.create({ processId: "adapter_contract_mail", adapter }).addTask(
    "mail",
    { id: "notify", name: "抄送通知", shape: SAMPLE_SHAPE },
  );
  const mailXml = await compile(mailFlow);
  // 元模型类型名 bpmn:ServiceTask 序列化时按 tagAlias 只小写首字母 → serviceTask
  const rawLocalName = mailMapping.elementType.split(":")[1];
  const mailTag =
    rawLocalName === undefined
      ? undefined
      : rawLocalName.charAt(0).toLowerCase() + rawLocalName.slice(1);
  if (mailTag === undefined || !mailXml.includes(`${mailTag} id="notify"`)) {
    throw new Error(`[合同点三] mail 映射的元素类型 ${mailMapping.elementType} 未出现在序列化输出`);
  }
  if (!mailXml.includes(`${prefix}:type="mail"`)) {
    throw new Error(`[合同点三] 邮件任务的方言属性未以 ${prefix}:type 序列化`);
  }
}
