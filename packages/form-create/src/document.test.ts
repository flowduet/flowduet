import { describe, expect, it } from "vitest";
import { BpmnModel, deriveBlockTree, flowableAdapter } from "@flowduet/core";
import { exportXml } from "@flowduet/designer";
import { collectReferenceIssues } from "./binding.js";
import {
  DESIGN_DOCUMENT_ENGINE,
  DESIGN_DOCUMENT_FORMAT,
  DESIGN_DOCUMENT_VERSION,
  openDesignDocument,
  saveDesignDocument,
} from "./document.js";
import type { FormDefinition } from "./document.js";
import { formSemantics } from "./form-semantics.js";

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

  it("非空表单目录随文档保存与往返；未绑定表单同样保留", async () => {
    const applyForm: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([
        {
          type: "input",
          field: "reason",
          title: "申请事由",
          value: "默认事由",
          $required: true,
        },
      ]),
      options: JSON.stringify({ labelWidth: "100px" }),
    };
    const unboundForm: FormDefinition = {
      id: "form_backup",
      name: "备用单",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("form_apply");

    const { json, document, referenceIssues } = await saveDesignDocument(model, [
      applyForm,
      unboundForm,
    ]);
    expect(document.forms).toHaveLength(2);
    expect(referenceIssues).toEqual([]);

    const opened = await openDesignDocument(json);
    expect(opened.forms.map((form) => form.id)).toEqual(["form_apply", "form_backup"]);
    // 文本字段、默认值、必填、表单配置往返语义等价（序列化串等价）
    expect(opened.forms[0]).toEqual(applyForm);
    expect(opened.model.defaultFormKey).toBe("form_apply");
  });

  it("结构坏的非空表单明确拒绝保存：重复 id、空名、未知提供者、坏 JSON、超范围字段", async () => {
    const base = {
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    const good: FormDefinition = { id: "form_a", name: "A", ...base };
    await expect(
      saveDesignDocument(buildDraftFlow(), [good, { ...good, name: "重复" }]),
    ).rejects.toThrow("id 重复");
    await expect(saveDesignDocument(buildDraftFlow(), [{ ...good, name: "  " }])).rejects.toThrow(
      "名称不能为空白",
    );
    await expect(
      saveDesignDocument(buildDraftFlow(), [{ ...good, provider: "other-vendor/antd" }]),
    ).rejects.toThrow("只支持 form-create/element-plus");
    await expect(
      saveDesignDocument(buildDraftFlow(), [{ ...good, rules: "{not-json" }]),
    ).rejects.toThrow("rules 不是合法 JSON");
    await expect(
      saveDesignDocument(buildDraftFlow(), [
        {
          ...good,
          rules: JSON.stringify([{ type: "upload", field: "u1", title: "上传" }]),
        },
      ]),
    ).rejects.toThrow("支持的组件");
  });

  it("全字段与布局矩阵重复往返：字段标识、类型、选项、默认值、必填、顺序、布局及表单配置语义等价（A10）", async () => {
    // 八类字段 + 栅格布局（含列内字段），并带上设计器导出会附带的部分运行态键，
    // 证明语义等价不受装载元数据干扰。
    // 注意：矩阵与 form-schema.test.ts / components.test.ts 的矩阵 fixture 刻意同构，
    // 新增字段类型时三处同步更新
    const matrixForm: FormDefinition = {
      id: "form_matrix",
      name: "矩阵表单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([
        {
          type: "input",
          field: "reason",
          title: "申请事由",
          value: "默认事由",
          $required: true,
          _fc_id: "id_a",
          name: "ref_a",
        },
        { type: "input", field: "detail", title: "详细说明", props: { type: "textarea" } },
        { type: "inputNumber", field: "amount", title: "金额", value: 0 },
        {
          type: "radio",
          field: "urgent",
          title: "是否加急",
          options: [
            { label: "是", value: "1" },
            { label: "否", value: "0" },
          ],
          value: "0",
          effect: { fetch: "" },
        },
        {
          type: "checkbox",
          field: "tags",
          title: "标签",
          options: [{ label: "甲", value: "a" }],
          value: [],
        },
        {
          type: "select",
          field: "level",
          title: "级别",
          options: [{ label: "普通", value: "1" }],
          $required: true,
        },
        { type: "datePicker", field: "applyDate", title: "申请日期" },
        {
          type: "switch",
          field: "notify",
          title: "通知",
          value: false,
          props: { activeValue: true, inactiveValue: false },
        },
        {
          type: "fcRow",
          children: [
            {
              type: "col",
              props: { span: 12 },
              children: [{ type: "input", field: "leftCol", title: "列甲" }],
            },
            {
              type: "col",
              props: { span: 12 },
              children: [{ type: "datePicker", field: "rightCol", title: "列乙" }],
            },
          ],
        },
      ]),
      options: JSON.stringify({ form: { labelWidth: "120px" } }),
    };
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("form_matrix");

    // 重复往返：保存 → 打开 → 再保存 → 再打开，每一跳语义等价
    const first = await saveDesignDocument(model, [matrixForm]);
    const opened1 = await openDesignDocument(first.json);
    expect(opened1.model.defaultFormKey).toBe("form_matrix");
    expect(formSemantics(opened1.forms[0])).toEqual(formSemantics(matrixForm));

    const second = await saveDesignDocument(opened1.model, opened1.forms);
    const opened2 = await openDesignDocument(second.json);
    expect(formSemantics(opened2.forms[0])).toEqual(formSemantics(matrixForm));

    // 值语义抽查：数字 0、开关 false、空多选默认值不得被通用真假判断吞掉
    const values = Object.fromEntries(
      (JSON.parse(opened2.forms[0].rules) as Array<{ field?: string; value?: unknown }>).map(
        (rule) => [rule.field ?? rule.type, rule.value],
      ),
    );
    expect(values.amount).toBe(0);
    expect(values.notify).toBe(false);
    expect(values.tags).toEqual([]);
    expect(values.urgent).toBe("0");
  });

  it("默认引用失效仍可保存为草稿并报告 referenceIssues", async () => {
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("missing_form");
    const { referenceIssues } = await saveDesignDocument(model);
    expect(referenceIssues).toHaveLength(1);
    expect(referenceIssues[0]).toContain("missing_form");
    // 引用失效不阻塞打开（草稿），诊断可在打开后重新计算
    const { json } = await saveDesignDocument(model);
    const opened = await openDesignDocument(json);
    expect(collectReferenceIssues(opened.model, opened.forms)).toHaveLength(1);
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

  // ---------- 引擎扩展兼容判定（A20：按实际使用的 URI 与扩展内容） ----------

  /** 前缀更名但 URI 不变的 flowable 方言流程：assignee 与 flowduet 默认绑定都应恢复 */
  const RENAMED_PREFIX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:fa="http://flowable.org/bpmn" xmlns:fd="urn:flowduet:bpmn" id="renamed_defs" targetNamespace="http://example.com/renamed">
  <bpmn:process id="renamed_flow" name="前缀更名" isExecutable="true" fd:defaultFormKey="form_apply">
    <bpmn:startEvent id="s" name="开始" />
    <bpmn:userTask id="t1" name="审批" fa:assignee="\${manager}" />
    <bpmn:endEvent id="e" name="结束" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1" />
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;

  /** 假用 flowable 前缀但绑定其他 URI：moddle 会静默把属性收进 $attrs，必须显式拒绝 */
  const FAKE_PREFIX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://vendor.example/private-ns" id="fake_defs" targetNamespace="http://example.com/fake">
  <bpmn:process id="fake_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t1" flowable:assignee="\${manager}" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1" />
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;

  it("扩展前缀更名但 URI 不变：assignee 与 flowduet 默认绑定照常恢复（A20）", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "input", field: "reason", title: "事由" }]),
      options: "{}",
    };
    const { model } = await openDesignDocument(wrapDocument(RENAMED_PREFIX_XML, { forms: [form] }));
    expect(String(model.elementOf("t1").get("assignee"))).toBe("${manager}");
    expect(model.defaultFormKey).toBe("form_apply");
    // 语义恢复后可继续编辑与保存（前缀由序列化层规范化回注册前缀）
    const again = await saveDesignDocument(model, [form]);
    await expect(openDesignDocument(again.json)).resolves.toHaveProperty("model");
  });

  it("假用 flowable 前缀但 URI 不匹配：拒绝打开并点名前缀与 URI（A20）", async () => {
    await expect(openDesignDocument(wrapDocument(FAKE_PREFIX_XML))).rejects.toThrow(
      /不支持的扩展.*flowable:assignee.*http:\/\/vendor\.example\/private-ns/s,
    );
  });

  it("仅声明未使用的其他引擎命名空间不构成冲突；实际使用才拒绝（A20）", async () => {
    // 只有 xmlns 声明、没有任何元素或属性引用：按标准草稿打开
    const declaredOnly = STANDARD_BPMN_XML.replace(
      "<bpmn:definitions ",
      '<bpmn:definitions xmlns:camunda="http://camunda.org/schema/1.0/bpmn" ',
    );
    await expect(openDesignDocument(wrapDocument(declaredOnly))).resolves.toHaveProperty("model");

    const actuallyUsed = declaredOnly.replace(
      '<bpmn:userTask id="t1" name="审批" />',
      '<bpmn:userTask id="t1" name="审批" camunda:assignee="demo" />',
    );
    await expect(openDesignDocument(wrapDocument(actuallyUsed))).rejects.toThrow(
      "文档 XML 使用了当前引擎适配器不支持的扩展",
    );
  });

  it("省略节点连线标记的条件分支恢复后仍报告缺失条件并拦截部署导出", async () => {
    const original = BpmnModel.create({ processId: "branch_draft", adapter: flowableAdapter })
      .addStartEvent({ id: "s" })
      .addExclusiveGateway({ id: "fork" })
      .addUserTask({ id: "a", assignee: "alice" })
      .addUserTask({ id: "b", assignee: "bob" })
      .addExclusiveGateway({ id: "join" })
      .addEndEvent({ id: "e" })
      .addSequenceFlow({ id: "f1", sourceRef: "s", targetRef: "fork" })
      .addSequenceFlow({ id: "fa", sourceRef: "fork", targetRef: "a" })
      .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b" })
      .addSequenceFlow({ id: "f4", sourceRef: "a", targetRef: "join" })
      .addSequenceFlow({ id: "f5", sourceRef: "b", targetRef: "join" })
      .addSequenceFlow({ id: "f6", sourceRef: "join", targetRef: "e" });
    const before = await saveDesignDocument(original);
    expect(before.pendingIssues).toHaveLength(2);
    // 标准 BPMN 可以只通过顺序流的端点表达连线关系。
    const xml = before.document.xml.replace(/<bpmn:(incoming|outgoing)>[\s\S]*?<\/bpmn:\1>/g, "");
    const { model } = await openDesignDocument(wrapDocument(xml));

    const saved = await saveDesignDocument(model);
    expect(saved.pendingIssues).toEqual(before.pendingIssues);
    await expect(exportXml(model)).rejects.toThrow("条件分支");
    const reopened = await openDesignDocument(saved.json);
    expect((await saveDesignDocument(reopened.model)).pendingIssues).toEqual(before.pendingIssues);
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

  it("结构坏的非空表单目录拒绝打开：非对象项、缺字符串 rules、重复 id、重复字段及超范围字段", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: ["not-an-object"] })),
    ).rejects.toThrow("表单定义对象");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: [{ ...form, rules: 42 }] })),
    ).rejects.toThrow("rules/options 必须是字符串");
    await expect(
      openDesignDocument(
        wrapDocument(STANDARD_BPMN_XML, { forms: [form, { ...form, name: "重" }] }),
      ),
    ).rejects.toThrow("id 重复");
    await expect(
      openDesignDocument(
        wrapDocument(STANDARD_BPMN_XML, {
          forms: [{ ...form, rules: JSON.stringify([{ type: "upload", field: "u1" }]) }],
        }),
      ),
    ).rejects.toThrow("支持的组件");
    await expect(
      openDesignDocument(
        wrapDocument(STANDARD_BPMN_XML, {
          forms: [
            {
              ...form,
              rules: JSON.stringify([
                { type: "input", field: "reason" },
                { type: "input", field: "reason" },
              ]),
            },
          ],
        }),
      ),
    ).rejects.toThrow("字段标识重复");
  });

  it("字段与表单级脚本配置在保存、打开两侧都拒绝", async () => {
    const base: FormDefinition = {
      id: "form_script",
      name: "脚本边界",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "input", field: "reason" }]),
      options: "{}",
    };
    const cases: FormDefinition[] = [
      {
        ...base,
        rules: JSON.stringify([
          { type: "input", field: "reason", on: { change: "function(){return 1;}" } },
        ]),
      },
      { ...base, options: JSON.stringify({ onSubmit: "function(){return true;}" }) },
    ];
    for (const form of cases) {
      await expect(saveDesignDocument(buildDraftFlow(), [form])).rejects.toThrow("脚本配置");
      await expect(
        openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: [form] })),
      ).rejects.toThrow("脚本配置");
    }
  });

  it("创建静态目录外的下拉选项在公开保存和打开接口都被拒绝", async () => {
    const form: FormDefinition = {
      id: "static_select",
      name: "静态下拉",
      provider: "form-create/element-plus",
      options: "{}",
      rules: JSON.stringify([
        { type: "select", field: "level", props: { allowCreate: true, filterable: true } },
      ]),
    };
    await expect(saveDesignDocument(buildDraftFlow(), [form])).rejects.toThrow("allowCreate");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: [form] })),
    ).rejects.toThrow("allowCreate");
  });

  it("联动编辑别名 _control 在公开保存与打开两侧拒绝", async () => {
    const form: FormDefinition = {
      id: "linkage_alias",
      name: "联动别名",
      provider: "form-create/element-plus",
      options: "{}",
      rules: JSON.stringify([
        {
          type: "input",
          field: "reason",
          _control: [{ value: "a", rule: [{ type: "upload", field: "out_of_scope" }] }],
        },
      ]),
    };
    await expect(saveDesignDocument(buildDraftFlow(), [form])).rejects.toThrow("_control");
    await expect(
      openDesignDocument(wrapDocument(STANDARD_BPMN_XML, { forms: [form] })),
    ).rejects.toThrow("_control");
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
