import { describe, expect, it } from "vitest";
import { BpmnModel, deriveBlockTree, flowableAdapter } from "@flowduet/core";
import { FlowDesignSession } from "./session.js";
import type { FormDefinition } from "./document.js";
import { saveDesignDocument } from "./document.js";

/**
 * 组合编辑会话合同（#71）：新建 / 保存 / 打开围绕「模型 + 表单目录」整体状态，
 * 打开原子替换、失败保留原状态，迟到的异步结果不覆盖更新的操作。
 */

function buildDraftFlow(): BpmnModel {
  return BpmnModel.create({ processId: "session_flow", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "approval_1", name: "审批节点", assignee: "${manager}" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "end" });
}

const BAD_DOCUMENT_JSON = "{not-json";

describe("FlowDesignSession", () => {
  it("构造时收编宿主已有模型；未初始化的会话保存明确报错", async () => {
    const model = buildDraftFlow();
    const session = new FlowDesignSession(model);
    expect(session.current?.model).toBe(model);
    expect(session.current?.forms).toEqual([]);
    const { pendingIssues } = await session.save();
    expect(pendingIssues).toEqual([]);

    const empty = new FlowDesignSession();
    expect(empty.current).toBeUndefined();
    await expect(empty.save()).rejects.toThrow("没有可保存的设计");
  });

  it("构造时传入非空表单目录：随会话保存与往返", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "input", field: "reason", title: "事由" }]),
      options: "{}",
    };
    const session = new FlowDesignSession({ model: buildDraftFlow(), forms: [form] });
    const { document } = await session.save();
    expect(document.forms).toEqual([form]);
    expect(session.formOptions()).toEqual([{ id: "form_apply", name: "申请单" }]);
  });

  it("表单目录管理：新建/改名/内容编辑，id 稳定且守卫生效", () => {
    const session = new FlowDesignSession(buildDraftFlow());
    const created = session.createForm("  申请单  ");
    expect(created.id).toBe("form_1");
    expect(created.name).toBe("申请单");
    expect(session.current?.forms).toHaveLength(1);

    // 改名不换 ID
    session.renameForm("form_1", "报销单");
    expect(session.current?.forms[0]).toMatchObject({ id: "form_1", name: "报销单" });

    // 内容写入：合法文本字段通过，超范围/坏 JSON 拒绝且目录不动
    const rules = JSON.stringify([{ type: "input", field: "amount", title: "金额" }]);
    session.updateFormContent("form_1", rules, "{}");
    expect(session.current?.forms[0]?.rules).toBe(rules);
    expect(() =>
      session.updateFormContent("form_1", JSON.stringify([{ type: "select", field: "s" }]), "{}"),
    ).toThrow("只支持文本");
    expect(session.current?.forms[0]?.rules).toBe(rules);
    expect(() => session.updateFormContent("form_1", "{bad", "{}")).toThrow("不是合法 JSON");

    // 新建第二张：id 自增不冲突
    expect(session.createForm("复核单").id).toBe("form_2");
    expect(() => session.createForm("   ")).toThrow("不能为空白");
    expect(() => session.renameForm("form_404", "x")).toThrow("不存在");
  });

  it.each([
    [
      "重复",
      [
        { type: "input", field: "reason" },
        { type: "input", field: "reason" },
      ],
    ],
    ["缺少", [{ type: "input", title: "申请事由" }]],
  ])("拒绝字段标识%s的表单内容并保留原定义", (_case, rules) => {
    const session = new FlowDesignSession(buildDraftFlow());
    const form = session.createForm("申请单");

    expect(() => session.updateFormContent(form.id, JSON.stringify(rules), "{}")).toThrow(
      "字段标识",
    );
    expect(session.current?.forms[0]?.rules).toBe("[]");
  });

  it("引用诊断：默认 key 指向目录外定义时报出且保留（A18）", () => {
    const session = new FlowDesignSession(buildDraftFlow());
    session.createForm("申请单");
    session.current?.model.setDefaultFormKey("missing_form");
    expect(session.referenceIssues).toHaveLength(1);
    expect(session.referenceIssues[0]).toContain("missing_form");

    session.current?.model.setDefaultFormKey("form_1");
    expect(session.referenceIssues).toEqual([]);
  });

  it("newDesign 产出最小可编辑流程，天然是业务草稿", async () => {
    const session = new FlowDesignSession();
    const model = session.newDesign();

    expect(session.current?.model).toBe(model);
    expect(deriveBlockTree(model).length).toBe(3);
    const { document, pendingIssues } = await session.save();
    expect(document.forms).toEqual([]);
    expect(pendingIssues.length).toBe(1);
    expect(pendingIssues[0]).toContain("审批人");
  });

  it("打开成功整体替换状态；坏文档失败保留原状态（原子恢复）", async () => {
    const initial = buildDraftFlow();
    const session = new FlowDesignSession(initial);
    const reopened = BpmnModel.create({ processId: "reopened_flow", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "approval_1", name: "审批节点", assignee: "${boss}" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
      .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "end" });
    const goodJson = (await saveDesignDocument(reopened)).json;

    const state = await session.open(goodJson);
    expect(String(state.model.process.get("id"))).toBe("reopened_flow");
    expect(session.current?.model).toBe(state.model);
    expect(session.current?.model).not.toBe(initial);

    await expect(session.open(BAD_DOCUMENT_JSON)).rejects.toThrow("不是合法 JSON");
    // 失败后状态保持为上一次成功打开的结果，不被部分覆盖
    expect(String(session.current?.model.process.get("id"))).toBe("reopened_flow");
  });

  it("校验期间发生新建时，迟到的打开结果拒绝落地（竞态守卫）", async () => {
    const session = new FlowDesignSession(buildDraftFlow());
    const goodJson = (await saveDesignDocument(buildDraftFlow())).json;

    // open 进入异步校验后、落地前，同步的 newDesign 抢先换代状态
    const late = session.open(goodJson);
    const fresh = session.newDesign({ processId: "newer_flow" });
    await expect(late).rejects.toThrow("已被更新");
    expect(session.current?.model).toBe(fresh);
    expect(String(session.current?.model.process.get("id"))).toBe("newer_flow");
  });

  it.each([
    ["重复 ID", '<bpmn:userTask id="approval_1" name="不能丢失的节点" />'],
    ["无法识别的元素", '<bpmn:scriptTesk id="unknown_task" name="不能丢失的节点" />'],
  ])("打开含%s的文档时拒绝解析警告，保留当前设计", async (_label, invalidElement) => {
    const session = new FlowDesignSession(buildDraftFlow());
    const previous = session.current;
    const { document } = await session.save();
    const damaged = JSON.stringify({
      ...document,
      xml: document.xml.replace("</bpmn:process>", `${invalidElement}</bpmn:process>`),
    });

    await expect(session.open(damaged)).rejects.toThrow("XML 解析产生警告");
    expect(session.current).toBe(previous);
    expect((await session.save()).document.xml).toBe(document.xml);
  });
});

/**
 * 表单删除守卫（#73，A06）：被流程默认或任意审批节点引用的表单拒绝删除
 * 并列出位置；解除全部引用后才可删除。未绑定表单随时可删。
 */
describe("FlowDesignSession 表单删除守卫（#73）", () => {
  function buildMultiNodeFlow(): BpmnModel {
    return BpmnModel.create({ processId: "delete_guard_flow", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "solo", name: "经理审批", assignee: "${manager}" })
      .addApprovalTask({ id: "counter", name: "部门会签", collection: "approvers", mode: "all" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "solo" })
      .addSequenceFlow({ id: "f2", sourceRef: "solo", targetRef: "counter" })
      .addSequenceFlow({ id: "f3", sourceRef: "counter", targetRef: "end" });
  }

  it("未被引用的表单直接删除；不存在的表单明确报错", () => {
    const session = new FlowDesignSession(buildMultiNodeFlow());
    const apply = session.createForm("申请单");
    const review = session.createForm("复核单");
    session.deleteForm(review.id);
    expect(session.current?.forms).toHaveLength(1);
    expect(session.current?.forms[0]?.id).toBe(apply.id);
    expect(() => session.deleteForm(review.id)).toThrow("不存在");
  });

  it("被流程默认引用时拒绝删除并列出位置；解除默认引用后可删", () => {
    const session = new FlowDesignSession(buildMultiNodeFlow());
    const apply = session.createForm("申请单");
    session.current?.model.setDefaultFormKey(apply.id);

    expect(() => session.deleteForm(apply.id)).toThrow("流程默认表单");
    expect(session.current?.forms).toHaveLength(1);

    session.current?.model.setDefaultFormKey(undefined);
    session.deleteForm(apply.id);
    expect(session.current?.forms).toHaveLength(0);
  });

  it("被任意审批节点引用时拒绝删除并列出节点位置；清空覆盖后可删", () => {
    const session = new FlowDesignSession(buildMultiNodeFlow());
    const review = session.createForm("复核单");
    const model = session.current?.model;
    model?.elementOf("solo").set("formKey", review.id);
    model?.elementOf("counter").set("formKey", review.id);

    // 两个引用位置都在错误信息中（多节点复用同一表单的删除面）
    const error = (() => {
      try {
        session.deleteForm(review.id);
        return undefined;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    })();
    expect(error).toContain("经理审批");
    expect(error).toContain("部门会签");
    expect(session.current?.forms).toHaveLength(1);

    model?.elementOf("solo").set("formKey", undefined);
    expect(() => session.deleteForm(review.id)).toThrow("部门会签");
    model?.elementOf("counter").set("formKey", undefined);
    session.deleteForm(review.id);
    expect(session.current?.forms).toHaveLength(0);
  });

  it("带首尾空格的 key 不算引用（与引用诊断口径一致），可删除", () => {
    const session = new FlowDesignSession(buildMultiNodeFlow());
    const apply = session.createForm("申请单");
    const spacedKey = ` ${apply.id} `;
    const model = session.current!.model;
    // 公共 setter 会 trim；模拟从 XML 打开的失效原值，验证删除守卫不误认引用。
    model.process.set("defaultFormKey", spacedKey);
    model.elementOf("solo").set("formKey", spacedKey);

    expect(session.referenceIssues.join("；")).toContain("含首尾空格");
    session.deleteForm(apply.id);
    expect(session.current?.forms).toHaveLength(0);
    expect(model.defaultFormKey).toBe(spacedKey);
    expect(model.elementOf("solo").get("formKey")).toBe(spacedKey);
  });
});

/**
 * 双表单默认/覆盖关系往返（#73，AC8）：反复保存打开后表单 ID、内容与
 * 默认/覆盖关系保持一致；目录不跨文档共享、打开产物与原文档语义等价。
 */
describe("FlowDesignSession 双表单默认与覆盖往返（#73）", () => {
  const APPLY_RULES = JSON.stringify([{ type: "input", field: "reason", title: "申请事由" }]);
  const REVIEW_RULES = JSON.stringify([{ type: "input", field: "comment", title: "复核意见" }]);

  function buildSession(): FlowDesignSession {
    const model = BpmnModel.create({ processId: "dual_form_flow", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "solo", name: "经理审批", assignee: "${manager}" })
      .addApprovalTask({ id: "counter", name: "部门会签", collection: "approvers", mode: "all" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "solo" })
      .addSequenceFlow({ id: "f2", sourceRef: "solo", targetRef: "counter" })
      .addSequenceFlow({ id: "f3", sourceRef: "counter", targetRef: "end" });
    const session = new FlowDesignSession(model);
    session.createForm("申请单");
    session.createForm("复核单");
    session.updateFormContent("form_1", APPLY_RULES, "{}");
    session.updateFormContent("form_2", REVIEW_RULES, "{}");
    // 默认 = 申请单（solo 继承）；counter 显式覆盖 = 复核单
    model.setDefaultFormKey("form_1");
    model.elementOf("counter").set("formKey", "form_2");
    return session;
  }

  it("反复保存打开：ID、规则与默认/覆盖关系逐项恢复且稳定", async () => {
    const session = buildSession();
    const first = await session.save();

    // 打开后目录与绑定关系逐项核对
    const state = await session.open(first.json);
    expect(state.forms.map((form) => form.id)).toEqual(["form_1", "form_2"]);
    expect(state.forms[0]).toMatchObject({ name: "申请单", rules: APPLY_RULES });
    expect(state.forms[1]).toMatchObject({ name: "复核单", rules: REVIEW_RULES });
    expect(state.model.defaultFormKey).toBe("form_1");
    expect(String(state.model.elementOf("counter").get("formKey"))).toBe("form_2");
    expect(state.model.elementOf("solo").get("formKey")).toBeUndefined();
    expect(session.referenceIssues).toEqual([]);

    // 第二轮往返与第一轮逐字等价（不漂移）
    const second = await session.save();
    expect(second.json).toBe(first.json);
  });

  it("改名不改 ID：改名后往返，引用关系继续指向原 ID", async () => {
    const session = buildSession();
    session.renameForm("form_2", "复核单（改）");
    const { json } = await session.save();
    const state = await session.open(json);
    expect(state.forms[1]).toMatchObject({ id: "form_2", name: "复核单（改）" });
    expect(String(state.model.elementOf("counter").get("formKey"))).toBe("form_2");
  });

  it("同一文档打开到两个会话后互不影响（无跨文档共享或自动更新）", async () => {
    const { json } = await buildSession().save();
    const left = new FlowDesignSession();
    const right = new FlowDesignSession();
    await left.open(json);
    await right.open(json);

    left.renameForm("form_1", "申请单（左改）");
    left.createForm("左新增");
    expect(left.current?.forms.map((form) => form.name)).toEqual([
      "申请单（左改）",
      "复核单",
      "左新增",
    ]);
    // 右会话目录不随左会话操作变化（表单仅在同一文档内共享）
    expect(right.current?.forms.map((form) => form.name)).toEqual(["申请单", "复核单"]);
  });
});
