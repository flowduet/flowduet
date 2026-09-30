import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { collectUnregisteredNamespaceUsage } from "./namespace-usage.js";
import { parse } from "./parser.js";

/**
 * 命名空间使用审计（#75，A20）：
 * bpmn-moddle 对「未注册 URI 的带前缀属性」不产生警告而是静默收进 $attrs
 * （键名还可能被改写成 ns0: 前缀），语义丢失对调用者不可见。审计按原始
 * XML 的实际使用内容（带前缀元素/属性名，经作用域内声明解析为 URI）对照
 * 已注册集合做显式判定：同 URI 不同前缀识别，未使用的声明放行。
 */

const BPMN_MODEL_URI = "http://www.omg.org/spec/BPMN/20100524/MODEL";
const FLOWABLE_URI = "http://flowable.org/bpmn";
const CAMUNDA_URI = "http://camunda.org/schema/1.0/bpmn";

/** 与 flowable 适配器 + flowduet 协议合并后的已注册 URI 集合（parse 内部同源） */
const REGISTERED = new Set([BPMN_MODEL_URI, FLOWABLE_URI, "urn:flowduet:bpmn"]);

/** 单审批人流程骨架：process 元素内插入 extra 片段，前缀声明可定制 */
function flowXml(extra: string, declarations: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" ${declarations} id="probe" targetNamespace="http://example.com/probe">
  <bpmn:process id="probe_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t" ${extra} />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
}

describe("collectUnregisteredNamespaceUsage", () => {
  it("同 URI 不同前缀：解析为已注册 URI，不产生诊断", () => {
    const xml = flowXml('fa:assignee="${manager}"', `xmlns:fa="${FLOWABLE_URI}"`);
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("假用已注册前缀名但 URI 不匹配：按 URI 判定，产生带定位的诊断", () => {
    const xml = flowXml(
      'flowable:assignee="${manager}"',
      `xmlns:flowable="http://wrong.example/ns"`,
    );
    const issues = collectUnregisteredNamespaceUsage(xml, REGISTERED);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      prefix: "flowable",
      uri: "http://wrong.example/ns",
      qualifiedName: "flowable:assignee",
      kind: "attribute",
      line: 5,
    });
  });

  it("仅声明未使用的命名空间不构成冲突", () => {
    const xml = flowXml("", `xmlns:camunda="${CAMUNDA_URI}"`);
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("实际使用冲突引擎扩展（属性与元素）都产生诊断", () => {
    const attributeUse = flowXml('camunda:assignee="${manager}"', `xmlns:camunda="${CAMUNDA_URI}"`);
    expect(collectUnregisteredNamespaceUsage(attributeUse, REGISTERED)).toHaveLength(1);

    const elementUse = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" xmlns:camunda="${CAMUNDA_URI}" id="probe" targetNamespace="http://x">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t">
      <camunda:taskListener event="create" />
    </bpmn:userTask>
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    const issues = collectUnregisteredNamespaceUsage(elementUse, REGISTERED);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ prefix: "camunda", kind: "element" });
  });

  it("XML 基建命名空间（xsi / xml 前缀）放行", () => {
    const xml = flowXml(
      'xsi:type="bpmn:tUserTask" xml:space="preserve"',
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    );
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("注释与 CDATA 里的伪使用不判定为实际使用", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" id="probe" targetNamespace="http://x">
  <!-- <camunda:assignee xmlns:camunda="${CAMUNDA_URI}" /> -->
  <bpmn:process id="p" isExecutable="true"><![CDATA[ <camunda:foo/> ]]>
    <bpmn:startEvent id="s" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("属性值包含尖括号时标签解析仍正确，不产生误判", () => {
    const xml = flowXml(
      'name="金额>1000" flowable:assignee="${manager}"',
      `xmlns:flowable="${FLOWABLE_URI}"`,
    );
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("嵌套作用域内前缀重绑定按实际作用域解析", () => {
    // 外层 camunda 声明为冲突 URI，内层把同名前缀重绑到 flowable URI：
    // 内层实际使用解析为 flowable，放行
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" xmlns:camunda="${CAMUNDA_URI}" id="probe" targetNamespace="http://x">
  <bpmn:process id="p" isExecutable="true" xmlns:camunda="${FLOWABLE_URI}">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t" camunda:assignee="\${manager}" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("未注册默认命名空间上的无前缀元素产生诊断", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://vendor.example/ns" id="probe" targetNamespace="http://x">
  <process id="p" isExecutable="true" />
</definitions>`;
    const issues = collectUnregisteredNamespaceUsage(xml, REGISTERED);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatchObject({ uri: "http://vendor.example/ns", kind: "element" });
  });

  it("前缀未声明就使用：产生「未声明」诊断而不是崩溃", () => {
    const xml = flowXml('ghost:assignee="x"', "");
    const issues = collectUnregisteredNamespaceUsage(xml, REGISTERED);
    expect(issues).toHaveLength(1);
    expect(issues[0].qualifiedName).toBe("ghost:assignee");
    expect(issues[0].uri).toBe("");
  });
});

describe("parse 的 rejectUnregisteredNamespaces 选项（opt-in，不改既有调用者）", () => {
  it("开启审计：假前缀 URI 不匹配的 XML 抛可定位错误", async () => {
    const xml = flowXml(
      'flowable:assignee="${manager}"',
      `xmlns:flowable="http://wrong.example/ns"`,
    );
    await expect(
      parse(xml, { adapter: flowableAdapter, rejectUnregisteredNamespaces: true }),
    ).rejects.toThrow(/flowable:assignee.*http:\/\/wrong\.example\/ns/s);
  });

  it("开启审计：同 URI 不同前缀正常恢复，语义不丢失", async () => {
    const xml = flowXml('fa:assignee="${manager}"', `xmlns:fa="${FLOWABLE_URI}"`);
    const model = await parse(xml, {
      adapter: flowableAdapter,
      rejectUnregisteredNamespaces: true,
    });
    expect(String(model.elementOf("t").get("assignee"))).toBe("${manager}");
  });

  it("开启审计：未使用的 camunda 声明放行（A20）", async () => {
    const xml = flowXml("", `xmlns:camunda="${CAMUNDA_URI}"`);
    await expect(
      parse(xml, { adapter: flowableAdapter, rejectUnregisteredNamespaces: true }),
    ).resolves.toBeTruthy();
  });

  it("不开启审计：既有宽松行为不变（未注册属性静默进 $attrs，不抛错）", async () => {
    const xml = flowXml('camunda:assignee="${manager}"', `xmlns:camunda="${CAMUNDA_URI}"`);
    const model = await parse(xml, { adapter: flowableAdapter });
    expect(model.elementOf("t").get("assignee")).toBeUndefined();
  });
});
