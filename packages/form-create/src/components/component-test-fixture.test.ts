// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import FormPreview from "./FormPreview.vue";
import {
  createComponentTestFixture,
  type ComponentTestFixture,
  type ComponentTestWrapper,
  type FixtureFailure,
} from "./__tests__/component-test-fixture.js";

/** 新回归自身也按用例登记；故障前先持有恢复句柄，旧finally只持有旧scope。 */
function createRegressionScope() {
  let active = true;
  let closed = false;
  let current: ReturnType<typeof open> | undefined;
  const endings: (() => void)[] = [];
  const cleanups: (() => void)[] = [];
  const observations: Promise<{ ok: true } | { ok: false; error: unknown }>[] = [];
  let draining: Promise<void> | undefined;
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  function assertActive() {
    if (!active) throw new Error("fixture回归已结束");
  }
  function defer(cleanup: () => void) {
    assertActive();
    let pending = true;
    const release = () => {
      if (!pending) return;
      pending = false;
      cleanup();
    };
    cleanups.push(release);
    return release;
  }
  function makeFactory() {
    assertActive();
    let wrapper: ComponentTestWrapper | undefined;
    let originalElementString: PropertyDescriptor | undefined;
    let reads = 0;
    const fixture = createComponentTestFixture({
      getWrapper: () => {
        reads++;
        return wrapper;
      },
      setWrapper: (value) => {
        wrapper = value;
      },
      getOriginalElementString: () => {
        reads++;
        return originalElementString;
      },
      setOriginalElementString: (value) => {
        originalElementString = value;
      },
    });
    return { fixture, readCount: () => reads };
  }
  function open(fixture: ComponentTestFixture) {
    assertActive();
    if (current !== undefined) throw new Error("回归夹具只允许串行接管");
    const key = fixture.beforeEachCase();
    let ended = false;
    const record = {
      fixture,
      key,
      close(primary?: FixtureFailure) {
        if (ended) return;
        ended = true;
        if (current === record) current = undefined;
        fixture.afterEachCase(key, primary);
      },
    };
    current = record;
    endings.push(() => record.close());
    return record;
  }
  async function step<T>(action: () => T | Promise<T>): Promise<T> {
    assertActive();
    const result = await action();
    assertActive();
    return result;
  }
  function gate() {
    assertActive();
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // 释放和拒绝观察都在首个等待前登记，异常收尾也不会留下裸拒绝。
    void promise.catch(() => undefined);
    defer(resolve);
    return { promise, resolve, reject };
  }
  function observe(work: Promise<unknown>): void {
    assertActive();
    if (draining !== undefined) throw new Error("已经开始收口，拒绝登记迟到任务");
    observations.push(
      work.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    );
  }
  function drain(): Promise<void> {
    if (draining !== undefined) return draining;
    const ending = observations.splice(0);
    draining = Promise.all(ending).then((results) => {
      const errors = results.flatMap((result) => (result.ok ? [] : [result.error]));
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, "fixture回归异步收尾失败");
    });
    // 重复观察共享本次Promise；即使调用方已因超时结束也不留下裸拒绝。
    void draining.catch(() => undefined);
    return draining;
  }
  function close() {
    active = false;
    if (closed) return;
    closed = true;
    const errors: unknown[] = [];
    const attempt = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        errors.push(error);
      }
    };
    endings.splice(0).reverse().forEach(attempt);
    cleanups.splice(0).reverse().forEach(attempt);
    attempt(() => {
      if (descriptor) Object.defineProperty(Element.prototype, "toString", descriptor);
      else Reflect.deleteProperty(Element.prototype, "toString");
    });
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "fixture回归收尾失败");
  }
  return { assertActive, defer, makeFactory, open, step, gate, close, observe, drain };
}
type RegressionScope = ReturnType<typeof createRegressionScope>;
type CaseRecord = ReturnType<RegressionScope["open"]>;
async function finishRegression(ending: RegressionScope): Promise<void> {
  const errors: unknown[] = [];
  try {
    ending.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await ending.drain();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "fixture回归同步及异步收尾失败");
}
/** 业务预期拒绝已在work内转换；finally等意外错误必须转回拒绝供scope收口。 */
function observeOutcome(ending: RegressionScope, work: Promise<unknown>) {
  const observed = work.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  ending.observe(
    observed.then((outcome) => {
      if ("error" in outcome) throw outcome.error;
    }),
  );
  return observed;
}
let regression: RegressionScope | undefined;
beforeEach(() => {
  regression = createRegressionScope();
});
afterEach(async () => {
  const ending = regression;
  regression = undefined;
  if (ending !== undefined) await finishRegression(ending);
});
function scope() {
  if (!regression) throw new Error("未登记fixture回归用例");
  regression.assertActive();
  return regression;
}
async function preview(record: CaseRecord) {
  const owner = record.fixture.beginManagerOwner();
  const target = owner.mount(() =>
    mount(FormPreview, {
      props: { form: { ...record.fixture.APPLY_FORM, rules: record.fixture.numericDateRules } },
      attachTo: document.body,
    }),
  );
  await owner.step(flushPromises);
  const input = target.get<HTMLInputElement>("input");
  return { owner, target, input };
}
function leaves(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leaves) : [error];
}
function caught(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("预期故障未被触发");
}

it("T2-F01 导入与构造不注册钩子或修改DOM兼容状态，两个factory数据独立", async () => {
  const h = scope();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const body = document.body.innerHTML;
  const a = h.makeFactory();
  const b = h.makeFactory();
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  expect(document.body.innerHTML).toBe(body);
  expect(a.readCount()).toBe(0);
  expect(b.readCount()).toBe(0);
  expect(a.fixture.managerOwners).not.toBe(b.fixture.managerOwners);
  expect(a.fixture.APPLY_FORM).not.toBe(b.fixture.APPLY_FORM);
  expect(a.fixture.MATRIX_FORM).not.toBe(b.fixture.MATRIX_FORM);
  const first = h.open(a.fixture);
  const live = await h.step(() => preview(first));
  await live.owner.step(() => live.input.setValue("11"));
  const activeDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  expect(() => a.fixture.beforeEachCase()).toThrow();
  expect(live.target.element.isConnected).toBe(true);
  expect(live.input.element.value).toBe("11");
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(activeDescriptor);
  first.close();
  expect(b.fixture.managerOwners).toHaveLength(0);
  const second = h.open(b.fixture);
  const next = await h.step(() => preview(second));
  await next.owner.step(() => next.input.setValue("12"));
  expect(next.target.element.isConnected).toBe(true);
  expect(next.input.element.value).toBe("12");
  expect(a.fixture.managerOwners).toHaveLength(0);
});

it.each(["resolve", "reject"] as const)(
  "T2-F02 %s交错：A结束后旧续体与finally不影响B",
  async (mode) => {
    const h = scope();
    const old = createRegressionScope();
    h.defer(old.close);
    const a = old.makeFactory();
    const ar = old.open(a.fixture);
    const beforeStyle = a.fixture.managerStyleSnapshot();
    const managerA = await old.step(() => a.fixture.retainedProtocolManager());
    await managerA.owner.step(() => a.fixture.managerRaw(managerA));
    const oldConfirm = managerA.owner.spy(() =>
      vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"),
    );
    const gate = h.gate();
    let settled = false;
    let phase = "A";
    const finallyPhases: string[] = [];
    const rejection = new Error("A受控拒绝");
    const late = old
      .step(() => managerA.owner.step(() => gate.promise))
      .then(
        () => undefined,
        (error: unknown) => error,
      )
      .finally(() => {
        finallyPhases.push(phase);
        managerA.owner.close();
        oldConfirm.restore();
        a.fixture.afterEachCase(ar.key);
        old.close();
      });
    // finally也有拒绝观察；不得等到释放gate后才安装处理器。
    const observed = observeOutcome(h, late).then((outcome) => {
      settled = true;
      return outcome;
    });
    old.close();
    await h.step(flushPromises);
    expect(settled, "A关闭后observed必须保持pending").toBe(false);
    expect(finallyPhases).toEqual([]);
    a.fixture.expectManagerStyleRestored(beforeStyle);
    const b = h.makeFactory();
    h.open(b.fixture);
    const managerB = await h.step(() => b.fixture.retainedProtocolManager());
    const input = await managerB.owner.step(() => b.fixture.managerRaw(managerB, "23"));
    const confirmB = managerB.owner.spy(() =>
      vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"),
    );
    const descriptorB = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
    const headB = Array.from(document.head.childNodes);
    expect(settled).toBe(false);
    phase = "B-ready";
    if (mode === "resolve") gate.resolve();
    else gate.reject(rejection);
    const outcome = await h.step(() => observed);
    expect(settled).toBe(true);
    expect(finallyPhases).toEqual(["B-ready"]);
    expect("error" in outcome).toBe(false);
    if ("value" in outcome) {
      if (mode === "reject") expect(outcome.value).toBe(rejection);
      else expect(outcome.value).toBeInstanceOf(Error);
    }
    expect(managerB.target.element.isConnected).toBe(true);
    expect(input.element.value).toBe("23");
    expect(ElMessageBox.confirm).toBe(confirmB.value);
    expect(confirmB.value).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptorB);
    expect(Array.from(document.head.childNodes)).toEqual(headB);
    await managerB.owner.step(flushPromises);
    await managerB.owner.waitFor(() =>
      expect(managerB.vm.readEditingState()?.canCapture).toBe(true),
    );
    expect(managerB.vm.commitPendingEdit()).toBe(true);
    const updates = managerB.target.emitted("updateContent");
    expect(updates).toHaveLength(1);
    const rules = updates?.[0]?.[1];
    if (typeof rules !== "string") throw new Error("真实Manager没有输出规则");
    expect(JSON.parse(rules)[0].value).toBe(23);
  },
);

it("T2-F03 同factory新用例开始后旧CaseKey结束无操作", async () => {
  const h = scope();
  const { fixture } = h.makeFactory();
  const first = h.open(fixture);
  first.close();
  h.open(fixture);
  const editor = await h.step(() => fixture.retainedEditor());
  const input = await editor.owner.step(() => fixture.selectRetained(editor, "amount"));
  await editor.owner.step(() => input.setValue("-"));
  const spy = editor.owner.spy(() => vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  fixture.afterEachCase(first.key);
  // RED固定于旧结束清空第二代真实根；重复begin断言在其后，避免错误RED来源。
  expect(editor.target.element.isConnected).toBe(true);
  expect(input.element.value).toBe("-");
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  expect(ElMessageBox.confirm).toBe(spy.value);
  expect(spy.value).not.toHaveBeenCalled();
  expect(() => fixture.beforeEachCase()).toThrow();
  expect(editor.target.element.isConnected).toBe(true);
  expect(input.element.value).toBe("-");
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  expect(ElMessageBox.confirm).toBe(spy.value);
});

it.each(["foreign", "forged"] as const)("T2-F04 %s CaseKey在清理前拒绝且不触碰B", async (mode) => {
  const h = scope();
  const a = h.makeFactory();
  const b = h.makeFactory();
  const br = h.open(b.fixture);
  const live = await h.step(() => preview(br));
  await live.owner.step(() => live.input.setValue("14"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const aReads = a.readCount();
  const bReads = b.readCount();
  if (mode === "foreign") expect(() => a.fixture.afterEachCase(br.key)).toThrow();
  else expect(() => b.fixture.afterEachCase({ ...br.key })).toThrow();
  expect(a.readCount()).toBe(aReads);
  expect(b.readCount()).toBe(bReads);
  expect(live.target.element.isConnected).toBe(true);
  expect(live.input.element.value).toBe("14");
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  await live.owner.step(() => live.input.setValue("15"));
  expect(live.input.element.value).toBe("15");
});

it.each(["body", "unmount"] as const)("T2-F05 %s异常后恢复并可交接下一factory", async (mode) => {
  const h = scope();
  const ending = createRegressionScope();
  h.defer(ending.close);
  const fallback = ending.gate();
  let finallyCount = 0;
  const late = ending
    .step(() => fallback.promise)
    .then(
      () => undefined,
      (error: unknown) => error,
    )
    .finally(() => {
      finallyCount++;
      ending.close();
    });
  ending.observe(late);
  h.observe(late);
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const a = h.makeFactory();
  const ar = h.open(a.fixture);
  const live = await h.step(() => preview(ar));
  const fault = new Error(mode);
  if (mode === "unmount") {
    const original = live.target.unmount.bind(live.target);
    const spy = vi.spyOn(live.target, "unmount");
    h.defer(() => spy.mockRestore());
    spy.mockImplementation(() => {
      original();
      throw fault;
    });
  }
  const error = caught(() => ar.close(mode === "body" ? { error: fault } : undefined));
  expect(error).toBe(fault);
  expect(live.target.element.isConnected).toBe(false);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
  ending.close();
  await h.step(() => ending.drain());
  expect(finallyCount).toBe(1);
  expect(await h.step(() => late)).toBeInstanceOf(Error);
  const b = h.makeFactory();
  const next = await h.step(() => preview(h.open(b.fixture)));
  await next.owner.step(() => next.input.setValue("16"));
  a.fixture.afterEachCase(ar.key);
  ending.close();
  expect(finallyCount).toBe(1);
  expect(next.target.element.isConnected).toBe(true);
  expect(next.input.element.value).toBe("16");
});

it("T2-F06 测试体与清理双故障保留首异常并完成其余清理", async () => {
  const h = scope();
  const ending = createRegressionScope();
  h.defer(ending.close);
  const closeFault = new Error("scope同步关闭故障");
  const finallyFault = new Error("scope意外finally故障");
  const cleanupOrder: string[] = [];
  ending.defer(() => {
    cleanupOrder.push("restored");
  });
  ending.defer(() => {
    cleanupOrder.push("close-fault");
    throw closeFault;
  });
  const work = Promise.resolve().finally(() => {
    throw finallyFault;
  });
  const observed = observeOutcome(ending, work);
  // 本行故障是预登记的，外层只拒绝其他错误；子scope仍须报告原finally故障。
  h.observe(
    observed.then((outcome) => {
      if ("error" in outcome && outcome.error !== finallyFault) throw outcome.error;
    }),
  );
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const a = h.makeFactory();
  const ar = h.open(a.fixture);
  const live = await h.step(() => preview(ar));
  const primary = new Error("首异常");
  const one = new Error("清理一");
  const two = new Error("清理二");
  const order: string[] = [];
  live.owner.defer(() => {
    order.push("one");
    throw one;
  });
  live.owner.defer(() => {
    order.push("two");
    throw two;
  });
  const error = caught(() => ar.close({ error: primary }));
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error("没有保留复合异常");
  expect(error.errors[0]).toBe(primary);
  expect(leaves(error)).toEqual([primary, two, one]);
  expect(order).toEqual(["two", "one"]);
  expect(live.target.element.isConnected).toBe(false);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
  const finishError = await h.step(() =>
    finishRegression(ending).then(
      () => undefined,
      (error: unknown) => error,
    ),
  );
  expect(leaves(finishError)).toEqual([closeFault, finallyFault]);
  expect(cleanupOrder).toEqual(["close-fault", "restored"]);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
  const b = h.makeFactory();
  const next = await h.step(() => preview(h.open(b.fixture)));
  await next.owner.step(() => next.input.setValue("17"));
  a.fixture.afterEachCase(ar.key, { error: primary });
  ending.close();
  expect(cleanupOrder).toEqual(["close-fault", "restored"]);
  expect(next.target.element.isConnected).toBe(true);
  expect(next.input.element.value).toBe("17");
});

it("T2-F07 全部owner先失效且真实多root逆序关闭，单个失败不跳过其余", async () => {
  const h = scope();
  const a = h.makeFactory();
  const ar = h.open(a.fixture);
  const first = await h.step(() => preview(ar));
  const second = await h.step(() => preview(ar));
  const order: string[] = [];
  const failure = new Error("第二根卸载后故障");
  const watch = (entry: typeof first, label: string, fail: boolean) => {
    const original = entry.target.unmount.bind(entry.target);
    const spy = vi.spyOn(entry.target, "unmount");
    h.defer(() => spy.mockRestore());
    spy.mockImplementation(() => {
      // 同步卸载期间也不能重入begin，否则余下旧清理会触及新用例。
      expect(() => a.fixture.beforeEachCase()).toThrow();
      expect(() => first.owner.assertActive()).toThrow();
      expect(() => second.owner.assertActive()).toThrow();
      order.push(label);
      original();
      if (fail) throw failure;
    });
    return spy;
  };
  const firstUnmount = watch(first, "first", false);
  const secondUnmount = watch(second, "second", true);
  expect(caught(() => ar.close())).toBe(failure);
  expect(order).toEqual(["second", "first"]);
  expect(first.target.element.isConnected).toBe(false);
  expect(second.target.element.isConnected).toBe(false);
  a.fixture.afterEachCase(ar.key);
  expect(firstUnmount).toHaveBeenCalledTimes(1);
  expect(secondUnmount).toHaveBeenCalledTimes(1);
});

it.each(["own", "inherited"] as const)(
  "T2-F08 %s描述符安装后故障回滚且无遗留活动用例",
  async (mode) => {
    const h = scope();
    const previous = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
    h.defer(() => {
      if (previous) Object.defineProperty(Element.prototype, "toString", previous);
      else Reflect.deleteProperty(Element.prototype, "toString");
    });
    if (mode === "own")
      Object.defineProperty(Element.prototype, "toString", {
        configurable: true,
        enumerable: true,
        writable: false,
        value: () => "[own]",
      });
    else Reflect.deleteProperty(Element.prototype, "toString");
    const expected = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
    const inheritedValue = Element.prototype.toString;
    const a = h.makeFactory();
    const fault = new Error("安装完成后故障");
    const define = Object.defineProperty;
    let injected = false;
    const spy = vi.spyOn(Object, "defineProperty");
    const restore = h.defer(() => spy.mockRestore());
    spy.mockImplementation((target, property, descriptor) => {
      const result = define(target, property, descriptor);
      if (
        !injected &&
        target === Element.prototype &&
        property === "toString" &&
        descriptor.value === Object.prototype.toString
      ) {
        injected = true;
        throw fault;
      }
      return result;
    });
    expect(caught(() => h.open(a.fixture))).toBe(fault);
    expect(injected).toBe(true);
    restore();
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(expected);
    expect(Element.prototype.toString).toBe(inheritedValue);
    const next = await h.step(() => preview(h.open(a.fixture)));
    await next.owner.step(() => next.input.setValue("18"));
    expect(next.target.element.isConnected).toBe(true);
    expect(next.input.element.value).toBe("18");
  },
);
