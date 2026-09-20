import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModdleElement } from "bpmn-moddle";
import { flowableAdapter } from "../../packages/core/src/adapter/flowable-adapter.js";
import { parse } from "../../packages/core/src/parse/parser.js";

/**
 * [PROTOTYPE] 往返保真探针:纯标准多实例形态 parse → toXML 会怎样?
 * loopDataInputRef 是 isReference 属性——parse 时文本 "approvers" 无 id 可解析,
 * compile 输出是否丢失?(内核最高优先级不变量,成稿前必须知道答案)
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "out");

describe("[PROTOTYPE] 多实例往返保真探针", () => {
  it("manual-e 形态 parse → toXML,看 loopDataInputRef/inputDataItem 是否保留", async () => {
    const xml = readFileSync(join(OUT_DIR, "manual-e.bpmn20.xml"), "utf8");
    const model = await parse(xml, { adapter: flowableAdapter });
    const flowElements = model.process.get("flowElements") as ModdleElement[];
    const task = flowElements.find((el) => el.get("id") === "t1") as ModdleElement;
    const loop = task.get("loopCharacteristics") as ModdleElement | undefined;
    console.log("parse 后 loopCharacteristics:", loop?.$type);
    if (loop) {
      console.log("  loopDataInputRef:", JSON.stringify(loop.get("loopDataInputRef")));
      console.log("  inputDataItem:", JSON.stringify(loop.get("inputDataItem")));
      console.log("  completionCondition:", JSON.stringify(loop.get("completionCondition")));
      console.log("  isSequential:", loop.get("isSequential"));
    }
    const { xml: outXml } = await model.toXML({ format: true });
    console.log("再序列化 userTask 段:");
    console.log(
      outXml
        .split("\n")
        .filter(
          (l) =>
            l.includes("multiInstance") ||
            l.includes("DataInput") ||
            l.includes("loopData") ||
            l.includes("completionCondition") ||
            l.includes("userTask"),
        )
        .join("\n"),
    );
  });
});
