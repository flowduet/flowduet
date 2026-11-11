import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter, type ApprovalMode, type ModdleElement } from "@flowduet/core";
import { DingtalkDesigner } from "@flowduet/designer";
import { convertMultiToSingle } from "../../designer/src/operations.js";
import { openDesignDocument, saveDesignDocument } from "./document.js";

const forms = [
  {
    id: "form_1",
    name: "申请单",
    provider: "form-create/element-plus",
    rules: "[]",
    options: "{}",
  },
];

async function reopen(mode: ApprovalMode, prefix = "bpmn") {
  const model = BpmnModel.create({ processId: "reopened_approval", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addExclusiveGateway({ id: "fork" })
    .addApprovalTask({ id: "a", name: "审批A", collection: "people", mode, formKey: "form_1" })
    .addUserTask({ id: "b", assignee: "bob" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sf", sourceRef: "s", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      name: "默认审批",
      sourceRef: "fork",
      targetRef: "a",
      default: true,
    })
    .addSequenceFlow({ id: "aj", sourceRef: "a", targetRef: "join" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b", condition: "${amount > 100}" })
    .addSequenceFlow({ id: "bj", sourceRef: "b", targetRef: "join" })
    .addSequenceFlow({ id: "je", sourceRef: "join", targetRef: "e" });
  model.setDefaultFormKey("form_1");
  const { document } = await saveDesignDocument(model, forms);
  document.xml = document.xml
    .replaceAll("bpmn:", `${prefix}:`)
    .replaceAll("xmlns:bpmn=", `xmlns:${prefix}=`);
  return (await openDesignDocument(JSON.stringify(document))).model;
}

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("保存重开后的审批转换", () => {
  for (const mode of ["all", "any", "sequential"] as const) {
    for (const prefix of ["bpmn", "bpmn2"]) {
      it(`${mode} 经文档保存重开（${prefix} 前缀）后原位转单签`, async () => {
        const model = await reopen(mode, prefix);
        const task = model.elementOf("a");
        const elements = [...(model.process.get("flowElements") as ModdleElement[])];
        const shape = model.shapeOf("a");
        const route = model.waypointsOf("fa");
        const diagrams = model.definitions.get("diagrams");
        convertMultiToSingle(model, "a");
        expect(model.elementOf("a")).toBe(task);
        expect(task.get("loopCharacteristics")).toBeUndefined();
        expect(task.get("assignee")).toBeUndefined();
        expect(task.get("formKey")).toBe("form_1");
        expect(model.defaultFormKey).toBe("form_1");
        elements.forEach((el, i) =>
          expect((model.process.get("flowElements") as ModdleElement[])[i]).toBe(el),
        );
        expect(model.elementOf("fork").get("default")).toBe(model.elementOf("fa"));
        expect(
          (model.elementOf("fork").get("outgoing") as ModdleElement[]).map((el) => el.get("id")),
        ).toEqual(["fa", "fb"]);
        expect(
          (model.elementOf("fb").get("conditionExpression") as ModdleElement).get("body"),
        ).toBe("${amount > 100}");
        expect(model.shapeOf("a")).toBe(shape);
        expect(model.waypointsOf("fa")).toBe(route);
        expect(model.definitions.get("diagrams")).toBe(diagrams);
        const again = await openDesignDocument((await saveDesignDocument(model, forms)).json);
        expect(again.model.elementOf("a").get("loopCharacteristics")).toBeUndefined();
        expect(again.forms).toEqual(forms);
      });
    }

    it(`${mode} 重开后通过真实抽屉确认单签`, async () => {
      const model = await reopen(mode);
      wrapper = mount(DingtalkDesigner, {
        props: { model, formOptions: forms },
        attachTo: document.body,
      });
      await flushPromises();
      await wrapper
        .findAll('[data-test="node-card"]')
        .find((card) => card.text().includes("审批A"))!
        .trigger("click");
      await flushPromises();
      await wrapper.find('[data-test="kind-single"]').trigger("click");
      const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!;
      assignee.value = "alice";
      assignee.dispatchEvent(new Event("input", { bubbles: true }));
      await flushPromises();
      (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
      await flushPromises();
      expect(model.elementOf("a").get("loopCharacteristics")).toBeUndefined();
      expect(model.elementOf("a").get("assignee")).toBe("alice");
      expect(wrapper.emitted("change")).toHaveLength(1);
    });
  }

  for (const property of ["language", "custom:flag", "body"] as const) {
    it(`类型元数据不使真正的 ${property} 自定义配置被放行`, async () => {
      const model = await reopen("all");
      const task = model.elementOf("a");
      const loop = task.get("loopCharacteristics") as ModdleElement;
      const condition = loop.get("completionCondition") as ModdleElement;
      condition.set(property, property === "body" ? "${custom}" : "custom");
      const before = await model.toXML();
      expect(() => convertMultiToSingle(model, "a")).toThrow(/不支持|固化/);
      expect(task.get("loopCharacteristics")).toBe(loop);
      expect(await model.toXML()).toEqual(before);
    });
  }
});
