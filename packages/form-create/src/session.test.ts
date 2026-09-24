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

  it("构造时传入非空表单目录：保存拒绝而非静默丢弃", async () => {
    const form: FormDefinition = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    const session = new FlowDesignSession({ model: buildDraftFlow(), forms: [form] });
    await expect(session.save()).rejects.toThrow("表单定义序列化尚未支持");
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
