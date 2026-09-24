import { describe, expect, it } from "vitest";
import { BpmnModel, deriveBlockTree, flowableAdapter } from "@flowduet/core";
import { exportXml } from "@flowduet/designer";
import {
  DESIGN_DOCUMENT_ENGINE,
  DESIGN_DOCUMENT_FORMAT,
  DESIGN_DOCUMENT_VERSION,
  openDesignDocument,
  saveDesignDocument,
} from "./document.js";
import type { FormDefinition } from "./document.js";

/**
 * 设计文档编解码合同（#71）：
 * 保存放行业务草稿并报告待修复项，部署导出继续拦截；
 * 打开对外层协议、XML 与可编辑结构做原子校验，坏输入明确拒绝。
 */

/** 业务草稿：审批人未配（保存应放行并报告，部署导出应拦截） */
function buildDraftFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "draft_flow",
    processName: "草稿流程",
    adapter: flowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "approval_1", name: "审批节点" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "end" });
}

function buildConfiguredFlow(): BpmnModel {
  const model = buildDraftFlow();
  model.elementOf("approval_1").set("assignee", "${manager}");
  return model;
}

function wrapDocument(xml: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: DESIGN_DOCUMENT_FORMAT,
    version: DESIGN_DOCUMENT_VERSION,
    engine: DESIGN_DOCUMENT_ENGINE,
    xml,
    forms: [],
    ...overrides,
  });
}

/** 无 Flowable 命名空间的标准 BPMN 草稿（A20 标准草稿部分） */
const STANDARD_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="std_defs" targetNamespace="http://example.com/std">
  <bpmn:process id="std_flow" name="标准草稿" isExecutable="true">
    <bpmn:startEvent id="s" name="开始" />
    <bpmn:userTask id="t1" name="审批" />
    <bpmn:endEvent id="e" name="结束" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1" />
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;

describe("saveDesignDocument", () => {
  it("保存产出首版协议文档：竖排 DI 可恢复、草稿待修复项随结果报告", async () => {
    const { document, json, pendingIssues } = await saveDesignDocument(buildDraftFlow());

    expect(document.format).toBe("flowduet.design");
    expect(document.version).toBe(1);
    expect(document.engine).toBe("flowable");
    expect(document.forms).toEqual([]);
    // 保存生成可恢复 DI（不以部署导出成功为前置）
    expect(document.xml).toContain("bpmndi:BPMNShape");
    // JSON 文本可直接再解析为同构文档
    expect(JSON.parse(json)).toEqual(document);
    // 审批人未配：保存成功 + 报告待修复项
    expect(pendingIssues.length).toBe(1);
    expect(pendingIssues[0]).toContain("approval_1");
    expect(pendingIssues[0]).toContain("审批人");
  });

  it("配置完整的流程保存无待修复项；部署导出拦截草稿、放行完整流程", async () => {
    const draft = await saveDesignDocument(buildDraftFlow());
    expect(draft.pendingIssues.length).toBe(1);
    const configured = await saveDesignDocument(buildConfiguredFlow());
    expect(configured.pendingIssues).toEqual([]);

    // 同一草稿模型交给部署导出（designer 公开合同）应被拦截
    await expect(exportXml(buildDraftFlow())).rejects.toThrow("审批人");
    await expect(exportXml(buildConfiguredFlow())).resolves.toContain("bpmn:process");
  });

  it("非空表单目录明确拒绝保存，不静默丢弃", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    await expect(saveDesignDocument(buildDraftFlow(), [form])).rejects.toThrow(
      "表单定义序列化尚未支持",
    );
  });
});

describe("openDesignDocument", () => {
  it("保存产物可重新打开：模型、几何登记与钉钉式块树齐备", async () => {
    const { json } = await saveDesignDocument(buildDraftFlow());
    const { document, model, forms } = await openDesignDocument(json);

    expect(document.format).toBe("flowduet.design");
    expect(forms).toEqual([]);
    expect(String(model.process.get("id"))).toBe("draft_flow");
    // 打开后的模型可继续编辑（块树可推导）且 BPMN 只读投影可直读 DI 登记表
    expect(deriveBlockTree(model).length).toBeGreaterThan(0);
    expect(model.shapeOf("start")).toEqual(expect.objectContaining({ width: 36 }));
  });

  it("纯标准 BPMN 草稿（无 Flowable 命名空间）可恢复并再次保存", async () => {
    const { model } = await openDesignDocument(wrapDocument(STANDARD_BPMN_XML));
    expect(String(model.process.get("id"))).toBe("std_flow");
    expect(deriveBlockTree(model).length).toBeGreaterThan(0);

    // 恢复后的模型可再次进入保存链路（补齐 DI）
    const again = await saveDesignDocument(model);
    expect(again.document.xml).toContain("bpmndi:BPMNShape");
    await expect(openDesignDocument(again.json)).resolves.toBeTruthy();
  });

  it("坏 JSON、非对象、未知格式/版本/引擎、缺 xml、forms 非数组逐一拒绝", async () => {
    await expect(openDesignDocument("{oops")).rejects.toThrow("不是合法 JSON");
    await expect(openDesignDocument("[1,2]")).rejects.toThrow("必须是 JSON 对象");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { format: "other.tool" })),
    ).rejects.toThrow("未知的设计文档格式");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { version: 2 })),
    ).rejects.toThrow("不支持的设计文档版本");
    // 字符串 "1" 不是整数 1，同样拒绝
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { version: "1" })),
    ).rejects.toThrow("不支持的设计文档版本");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { engine: "camunda" })),
    ).rejects.toThrow("不支持的目标引擎");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { xml: "   " })),
    ).rejects.toThrow("缺少非空的 xml 字段");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: {} })),
    ).rejects.toThrow("forms 字段必须是数组");
  });

  it("非空表单目录明确拒绝打开，不忽略表单后静默打开", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: [form] })),
    ).rejects.toThrow("表单编辑尚未支持");
  });

  it("坏 XML 拒绝并带上下文前缀", async () => {
    await expect(openDesignDocument(wrapDocument("<bpmn:not-closed"))).rejects.toThrow(
      "文档 XML 无法解析",
    );
  });

  it("多流程输入明确拒绝", async () => {
    const multiProcessXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="multi_defs" targetNamespace="http://example.com/multi">
  <bpmn:process id="flow_a" isExecutable="true">
    <bpmn:startEvent id="a_start" />
    <bpmn:endEvent id="a_end" />
    <bpmn:sequenceFlow id="a_f1" sourceRef="a_start" targetRef="a_end" />
  </bpmn:process>
  <bpmn:process id="flow_b" isExecutable="true">
    <bpmn:startEvent id="b_start" />
    <bpmn:endEvent id="b_end" />
    <bpmn:sequenceFlow id="b_f1" sourceRef="b_start" targetRef="b_end" />
  </bpmn:process>
</bpmn:definitions>`;
    await expect(openDesignDocument(wrapDocument(multiProcessXml))).rejects.toThrow("2 个流程");
  });

  it("超出编辑子集的元素拒绝打开并点名元素", async () => {
    const scriptTaskXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="sub_defs" targetNamespace="http://example.com/sub">
  <bpmn:process id="sub_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:scriptTask id="script_1" name="系统脚本" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="script_1" />
    <bpmn:sequenceFlow id="f2" sourceRef="script_1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    await expect(openDesignDocument(wrapDocument(scriptTaskXml))).rejects.toThrow(
      "（script_1）」（bpmn:ScriptTask）",
    );
  });

  it("非抄送形态的服务任务拒绝；抄送节点可正常打开", async () => {
    const plainServiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="svc_defs" targetNamespace="http://example.com/svc">
  <bpmn:process id="svc_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:serviceTask id="svc_1" name="外部服务" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="svc_1" />
    <bpmn:sequenceFlow id="f2" sourceRef="svc_1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    await expect(openDesignDocument(wrapDocument(plainServiceXml))).rejects.toThrow("svc_1");

    // 抄送节点（ServiceTask + ccTo）在子集内
    const ccModel = BpmnModel.create({ processId: "cc_flow", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addTask("cc", { id: "cc_1", name: "抄送备案", recipients: "张三" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "cc_1" })
      .addSequenceFlow({ id: "f2", sourceRef: "cc_1", targetRef: "end" });
    const { xml } = await ccModel.toXML({ format: true });
    await expect(openDesignDocument(wrapDocument(xml))).resolves.toHaveProperty("model");
  });

  it("循环结构拒绝打开（竖排推导守卫）", async () => {
    const cycleXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="cycle_defs" targetNamespace="http://example.com/cycle">
  <bpmn:process id="cycle_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t1" name="第一步" />
    <bpmn:userTask id="t2" name="第二步" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1" />
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="t2" />
    <bpmn:sequenceFlow id="f3" sourceRef="t2" targetRef="t1" />
    <bpmn:sequenceFlow id="f4" sourceRef="t2" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    await expect(openDesignDocument(wrapDocument(cycleXml))).rejects.toThrow("超出可编辑范围");
  });
});
