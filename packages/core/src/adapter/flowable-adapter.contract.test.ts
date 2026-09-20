import { describe, expect, it } from "vitest";
import { assertAdapterContract } from "./adapter-contract";
import { flowableAdapter } from "./flowable-adapter";
import { BpmnModel } from "../model/bpmn-model";
import { compile } from "../compile/compiler";
import { parse } from "../parse/parser";

const SHAPE = { x: 160, y: 160, width: 100, height: 80 };

describe("适配器合同（ADR-0005 三收敛点）", () => {
  it("flowable 6.8 基准的首个适配器满足全部合同点", async () => {
    await assertAdapterContract(flowableAdapter);
  });

  it("合同拒绝缺少任务类型映射的适配器", async () => {
    const broken = {
      ...flowableAdapter,
      taskTypeMapping: { ...flowableAdapter.taskTypeMapping, mail: undefined },
    } as typeof flowableAdapter;
    await expect(assertAdapterContract(broken)).rejects.toThrow("[合同点三]");
  });

  it('addUserTask 与 addTask("user") 等价（快捷方法走同一映射）', async () => {
    // 同一组 id/名称/坐标，仅建模入口不同
    const viaShortcut = BpmnModel.create({
      processId: "contract_equiv",
      adapter: flowableAdapter,
    }).addUserTask({ id: "t1", name: "审批", assignee: "zhang", shape: SHAPE });
    const viaMapping = BpmnModel.create({
      processId: "contract_equiv",
      adapter: flowableAdapter,
    }).addTask("user", { id: "t1", name: "审批", assignee: "zhang", shape: SHAPE });
    expect(await compile(viaMapping)).toBe(await compile(viaShortcut));
  });

  it('邮件任务按 Flowable 习惯落成 ServiceTask + flowable:type="mail"', async () => {
    const xml = await compile(
      BpmnModel.create({ processId: "contract_mail", adapter: flowableAdapter }).addTask("mail", {
        id: "notify",
        name: "抄送通知",
        shape: SHAPE,
      }),
    );
    expect(xml).toContain('<bpmn:serviceTask id="notify" name="抄送通知" flowable:type="mail" />');
  });

  it("解析恢复的树同样能经映射建模（parse 绑定适配器）", async () => {
    const xml = await compile(
      BpmnModel.create({ processId: "contract_parse", adapter: flowableAdapter }).addStartEvent({
        id: "start",
        shape: SHAPE,
      }),
    );
    const model = await parse(xml, { adapter: flowableAdapter });
    expect(() => model.addTask("service", { id: "svc", name: "服务", shape: SHAPE })).not.toThrow();
  });
});
