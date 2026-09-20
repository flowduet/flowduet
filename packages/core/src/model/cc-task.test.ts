import { describe, expect, it } from "vitest";
import type { ModdleElement } from "bpmn-moddle";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { parse } from "../parse/parser.js";
import { BpmnModel } from "./bpmn-model.js";
import type { CcTaskSpec } from "./bpmn-model.js";

/**
 * 抄送任务的建模 API 语义与守卫（R3 决策：中立映射 + ccTo 单属性 + 占位 delegate）。
 * 抄送 = 知会不阻塞：方言落 ServiceTask + 扩展属性收件人 + 占位 delegate 引用
 * （宿主绑定 bean 实现知会行为，ADR-0004）。
 */

const SHAPE = { x: 140, y: 160, width: 100, height: 80 };

function createModel(): BpmnModel {
  return BpmnModel.create({ processId: "cc_api", adapter: flowableAdapter });
}

function findFlowElement(model: BpmnModel, id: string): ModdleElement {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  const found = elements.find((el) => el.get("id") === id);
  if (found === undefined) {
    throw new Error(`找不到流程元素 ${id}`);
  }
  return found;
}

describe('addTask("cc") 守卫', () => {
  it("收件人空白或缺失即抛错", () => {
    expect(() => createModel().addTask("cc", { id: "t", recipients: "  ", shape: SHAPE })).toThrow(
      /recipients 不能为空白/,
    );
    // 模拟 JS 调用方漏传 recipients 绕过 TS 类型
    expect(() =>
      createModel().addTask("cc", { id: "t", shape: SHAPE } as unknown as CcTaskSpec),
    ).toThrow(/recipients 不能为空白/);
  });

  it("抄送任务不支持 assignee（ServiceTask 形态）", () => {
    expect(() =>
      createModel().addTask("cc", {
        id: "t",
        recipients: "张三",
        assignee: "${manager}",
        shape: SHAPE,
      }),
    ).toThrow(/不支持 assignee/);
  });
});

describe('addTask("cc") 语义', () => {
  it("字面量收件人：ServiceTask + ccTo + 占位 delegate 引用", async () => {
    const xml = await compile(
      createModel().addTask("cc", {
        id: "cc_notify",
        name: "抄送知会",
        recipients: "张三,李四",
        shape: SHAPE,
      }),
    );
    expect(xml).toContain('<bpmn:serviceTask id="cc_notify"');
    expect(xml).toContain('flowable:ccTo="张三,李四"');
    expect(xml).toContain('flowable:delegateExpression="${flowduetCcTask}"');
  });

  it("表达式收件人：运行时集合注入的写法同样落 ccTo", async () => {
    const xml = await compile(
      createModel().addTask("cc", { id: "cc_dynamic", recipients: "${ccUsers}", shape: SHAPE }),
    );
    expect(xml).toContain('flowable:ccTo="${ccUsers}"');
  });

  it("收件人两端空白 trim 后落盘（内部不改写——表达式内空格是合法格式）", async () => {
    const xml = await compile(
      createModel().addTask("cc", { id: "cc_trim", recipients: "  张三,李四  ", shape: SHAPE }),
    );
    expect(xml).toContain('flowable:ccTo="张三,李四"');
  });

  it("ccTo 与 delegate 引用经 parse 等价恢复", async () => {
    const xml = await compile(
      createModel().addTask("cc", { id: "cc_round", recipients: "张三", shape: SHAPE }),
    );
    const model = await parse(xml, { adapter: flowableAdapter });
    const task = findFlowElement(model, "cc_round");
    expect(task.get("ccTo")).toBe("张三");
    expect(task.get("delegateExpression")).toBe("${flowduetCcTask}");
  });
});
