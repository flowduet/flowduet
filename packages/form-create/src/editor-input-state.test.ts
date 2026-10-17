import { describe, expect, it } from "vitest";
import { createEditorInputState } from "./components/editor-input-state.js";

describe("retained 默认值缓冲", () => {
  it.each(["-", "+", ".", "1.", "1e", " 1", "NaN", "Infinity"])(
    "未完成数字 %s 保留并拒绝捕获",
    (raw) => {
      const state = createEditorInputState(() => {});
      const input = state.bind({ type: "inputNumber", field: "amount", value: 0 });
      input.input(raw, () => {
        throw new Error("非法输入不可写业务值");
      });
      expect(input.raw).toBe(raw);
      expect(state.blockers().map((b) => b.code)).toEqual(["pending-input"]);
    },
  );
  it.each([
    ["0", 0],
    ["-2", -2],
    ["1.5", 1.5],
    [".5", 0.5],
    ["1e3", 1000],
  ] as const)("合法数值 %s 必须等公开回显", (raw, value) => {
    const state = createEditorInputState(() => {});
    const source = { type: "inputNumber", field: "amount", value: undefined as unknown };
    const input = state.bind(source);
    let emitted: unknown;
    input.input(raw, (v) => {
      emitted = v;
    });
    expect(emitted).toBe(value);
    expect(state.blockers()[0]?.code).toBe("pending-update");
    source.value = value;
    input.echo(value);
    expect(state.blockers()).toEqual([]);
    expect(input.raw).toBe(raw);
  });
  it("date中间串和无效日期不补齐，有效闰日等待回显", () => {
    const state = createEditorInputState(() => {});
    const source = { type: "datePicker", field: "date", value: "2024-02-29" };
    const input = state.bind(source);
    for (const raw of ["2026-", "2026-02-30"]) {
      input.input(raw, () => {
        throw new Error("不能提交");
      });
      expect(input.raw).toBe(raw);
      expect(state.blockers()[0]?.code).toBe("pending-input");
    }
    input.input("2028-02-29", () => {});
    source.value = "2028-02-29";
    input.echo("2028-02-29");
    expect(state.blockers()).toEqual([]);
  });
  it("deleted_field_lifetime_never_reuses_raw，包括删除父容器", () => {
    const state = createEditorInputState(() => {});
    const source = { type: "inputNumber", field: "same", value: 3 };
    const old = state.bind(source);
    old.input("-", () => {});
    expect(state.bind(source)).toBe(old);
    state.release({ children: [source] });
    const fresh = state.bind({ type: "inputNumber", field: "same", value: 9 });
    old.input("1e", () => {
      throw new Error("旧回调");
    });
    expect(fresh.raw).toBe("9");
    expect(state.blockers()).toEqual([]);
  });
  it("两个实例相同字段互不污染，未知外部替换不抹原文", () => {
    const a = createEditorInputState(() => {}),
      b = createEditorInputState(() => {});
    const source = { type: "inputNumber", field: "same", value: 0 };
    const input = a.bind(source);
    input.input("-", () => {});
    expect(b.bind(source).raw).toBe("0");
    input.echo(8);
    expect(input.raw).toBe("-");
    expect(a.blockers()[0]?.code).toBe("unsupported-input");
  });
  it.each([
    { props: { type: "month", valueFormat: "YYYY/MM" }, value: "2026/03", next: "2027/03" },
    { props: { type: "date", valueFormat: "YYYY/MM/DD" }, value: "2026/03/04", next: "2027/03/04" },
  ])("自定义日期及I01只读原样，尝试编辑才unsupported %j", ({ props, value, next }) => {
    const state = createEditorInputState(() => {});
    const input = state.bind({ type: "datePicker", field: "date", value, props });
    expect(input.raw).toBe(value);
    expect(state.blockers()).toEqual([]);
    input.input(next, () => {
      throw new Error("不能猜格式");
    });
    expect(input.raw).toBe(next);
    expect(state.blockers()[0]?.code).toBe("unsupported-input");
  });
});

it("prop回显不能掩盖原规则旧值；回显与业务值双重确认", () => {
  const state = createEditorInputState(() => {});
  const source = { type: "inputNumber", field: "n", value: 0 };
  const input = state.bind(source);
  input.input("37", () => {});
  input.echo(37);
  expect(state.blockers()[0]?.code).toBe("pending-update");
  source.value = 37;
  expect(state.blockers()).toEqual([]);
});

it("尚未绑定字段的raw不允许捕获或导航", () => {
  const state = createEditorInputState(() => {});
  state.bind({ type: "inputNumber" }).input("-", () => {});
  expect(state.blockers()[0]?.code).toBe("unknown-owner");
});

it.each([
  ["inputNumber", 1000, "1e3"],
  ["datePicker", "2024-02-29", "2024-02-29"],
] as const)("等价%s输入也先建立等待门再通知订阅者", (type, value, raw) => {
  const observations: string[][] = [];
  const state = createEditorInputState(() => {
    observations.push(state.blockers().map((b) => b.code));
  });
  const source = { type, field: "value", value };
  const input = state.bind(source);
  input.input(raw, () => {
    expect(observations.every((codes) => codes.includes("pending-update"))).toBe(true);
  });
  expect(observations[0]).toEqual(["pending-update"]);
  expect(input.raw).toBe(raw);
  input.echo(value);
  expect(state.blockers()).toEqual([]);
});

it("同步订阅者重入输入后不发布旧原文", () => {
  let reenter = true;
  const source = { type: "inputNumber", field: "amount", value: 1000 };
  const state = createEditorInputState(() => {
    if (reenter) {
      reenter = false;
      input.input("-", () => {
        throw new Error("非法重入不可发布");
      });
    }
  });
  const input = state.bind(source);
  input.input("1e3", () => {
    throw new Error("已被新输入替代，不可发布旧值");
  });
  expect(input.raw).toBe("-");
  expect(state.blockers()[0]?.code).toBe("pending-input");
});
