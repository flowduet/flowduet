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
  it.each(["http://flowable.org/bp&#109;n", "http://flowable.org/bp&#x6D;n"])(
    "命名空间字符引用按实际 URI 识别：%s",
    (uri) => {
      const xml = flowXml('fa:assignee="john"', `xmlns:fa="${uri}"`);
      expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
    },
  );

  it("预定义实体解码一次，不对 URI 做百分号解码或大小写归一化", () => {
    const uri = "urn:custom:a&b<\"'";
    const xml = flowXml('fa:assignee="john"', 'xmlns:fa="urn:custom:a&amp;b&lt;&quot;&apos;"');
    expect(collectUnregisteredNamespaceUsage(xml, new Set([...REGISTERED, uri]))).toEqual([]);
    for (const encoded of ["http://flowable.org/bp%6Dn", "HTTP://flowable.org/bpmn"]) {
      expect(
        collectUnregisteredNamespaceUsage(
          flowXml('fa:assignee="john"', `xmlns:fa="${encoded}"`),
          REGISTERED,
        ),
      ).toHaveLength(1);
    }
    const escapedReference = flowXml('fa:assignee="john"', 'xmlns:fa="urn:custom:&amp;#109;"');
    expect(
      collectUnregisteredNamespaceUsage(
        escapedReference,
        new Set([...REGISTERED, "urn:custom:&#109;"]),
      ),
    ).toEqual([]);
  });

  it.each([
    ['xmlns:xml="http://camunda.org/schema/1.0/bpmn"', 'xml:assignee="john"'],
    ['xmlns:xml="http://flowable.org/bpmn"', 'xml:assignee="john"'],
    ['xmlns:xml="http://camunda.org/schema/1.0/bpmn"', ""],
    ['xmlns:other="http://www.w3.org/XML/1998/namespace"', ""],
    ['xmlns="http://www.w3.org/XML/1998/namespace"', ""],
    ['xmlns:xmlns="http://www.w3.org/2000/xmlns/"', ""],
    ['xmlns:other="http://www.w3.org/2000/xmlns/"', ""],
  ])("非法保留命名空间声明拒绝：%s", (declaration, attribute) => {
    expect(() =>
      collectUnregisteredNamespaceUsage(flowXml(attribute, declaration), REGISTERED),
    ).toThrow(/第 2 行.*非法.*命名空间声明/);
  });

  it("xml 固定 URI 的显式声明仍合法", () => {
    expect(
      collectUnregisteredNamespaceUsage(
        flowXml('xml:space="preserve"', 'xmlns:xml="http://www.w3.org/XML/1998/namespace"'),
        REGISTERED,
      ),
    ).toEqual([]);
  });

  it.each(["\n", "\r\n", "\r"])("多行属性定位在名字起始行，换行 %j", (newline) => {
    const xml = [
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bad="urn:bad">',
      "  <bpmn:userTask",
      "    bad:assignee",
      "      =",
      '      "first',
      "second",
      'third" />',
      '  <bad:extra bad:other="x" />',
      "</bpmn:definitions>",
    ].join(newline);
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toMatchObject([
      { qualifiedName: "bad:assignee", line: 3 },
      { qualifiedName: "bad:extra", line: 8 },
      { qualifiedName: "bad:other", line: 8 },
    ]);
  });

  it("同 URI 不同前缀：解析为已注册 URI，不产生诊断", () => {
    const xml = flowXml('fa:assignee="${manager}"', `xmlns:fa="${FLOWABLE_URI}"`);
    expect(collectUnregisteredNamespaceUsage(xml, REGISTERED)).toEqual([]);
  });

  it("属性使用先于同标签 xmlns 声明：属性顺序无关，照常识别", () => {
    // XML 属性顺序无关：使用写在声明之前同样合法，不能误报「前缀未声明」
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" id="probe" targetNamespace="http://example.com/probe">
  <bpmn:process id="probe_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t" fa:assignee="\${manager}" xmlns:fa="${FLOWABLE_URI}" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
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
  it.each(["http://flowable.org/bp&#109;n", "http://flowable.org/bp&#x6D;n"])(
    "开启审计：字符引用 URI 恢复真实审批人：%s",
    async (uri) => {
      const model = await parse(flowXml('fa:assignee="john"', `xmlns:fa="${uri}"`), {
        adapter: flowableAdapter,
        rejectWarnings: true,
        rejectUnregisteredNamespaces: true,
      });
      expect(model.elementOf("t").get("assignee")).toBe("john");
    },
  );

  it("开启审计拒绝 xml 重绑定，关闭审计保留旧 parse 行为", async () => {
    const xml = flowXml('xml:assignee="john"', `xmlns:xml="${CAMUNDA_URI}"`);
    await expect(
      parse(xml, {
        adapter: flowableAdapter,
        rejectWarnings: true,
        rejectUnregisteredNamespaces: true,
      }),
    ).rejects.toThrow(/xmlns:xml.*非法.*命名空间声明/);
    await expect(
      parse(xml, { adapter: flowableAdapter, rejectWarnings: true }),
    ).resolves.toBeTruthy();
  });

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

  it("开启审计：使用先于同标签声明的前缀照常恢复（属性顺序无关）", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_URI}" id="probe" targetNamespace="http://example.com/probe">
  <bpmn:process id="probe_flow" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:userTask id="t" fa:assignee="\${manager}" xmlns:fa="${FLOWABLE_URI}" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
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
