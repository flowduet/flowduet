import { describe, expect, it } from "vitest";
import { deferred } from "../contracts/fixtures";
import { formStateFixture } from "./fixtures";
import { policyFixture } from "./test-host";
describe("C2 保持挂载导航", () => {
  it("two_forms_switch_without_session_write：忙碌和未捕获输入也不触发导出", async () => {
    const f = policyFixture(),
      [a, b] = f.forms;
    try {
      await f.policy.select(a!, "keep-mounted");
      const source = f.current()!,
        lease = f.c.store.editor(a!)!.lease;
      f.entry(source).content.rules = '[{"type":"input","field":"a_subject","value":"未失焦"}]';
      f.entry(source).state.composing = true;
      f.c.drafts.touch(a!);
      const before = JSON.stringify(f.c.session.current!.forms);
      expect(await f.policy.select(b!, "keep-mounted")).toMatchObject({
        ok: true,
        value: { actual: "kept" },
      });
      await f.policy.select(a!, "keep-mounted");
      expect(f.current()).toBe(source);
      expect(f.c.store.editor(a!)!.lease).toBe(lease);
      expect(f.entry(source).content.rules).toContain("未失焦");
      expect(f.captures()).toBe(0);
      expect(JSON.stringify(f.c.session.current!.forms)).toBe(before);
      expect(f.c.dirty).toBe(true);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
  it("外来/错误facet在触碰宿主前拒绝", async () => {
    const f = policyFixture(),
      other = formStateFixture("foreign");
    try {
      expect(await f.policy.select(other.forms[0]!, "keep-mounted")).toMatchObject({
        ok: false,
        code: "stale-target",
      });
      expect(
        await f.policy.select(f.context.target("c_probe", "process"), "keep-mounted"),
      ).toMatchObject({ ok: false, code: "unsupported" });
      expect(f.entries).toHaveLength(0);
    } finally {
      f.policy.dispose();
      f.c.dispose();
      other.controller.dispose();
    }
  });
  it("后一次导航获胜，迟到挂载不能显示或卸载当前实例", async () => {
    const f = policyFixture(),
      gate = deferred<void>(),
      mount = f.host.mountActive;
    try {
      await f.policy.select(f.forms[0]!, "keep-mounted");
      const first = f.current();
      f.host.mountActive = async (target) => {
        if (target.ref === f.forms[1]!.ref) await gate.promise;
        return mount(target);
      };
      const old = f.policy.select(f.forms[1]!, "keep-mounted");
      await f.policy.select(f.forms[0]!, "keep-mounted");
      gate.resolve();
      expect(await old).toMatchObject({ ok: false, code: "cancelled" });
      expect(f.current()).toBe(first);
      expect(f.entry(first!).unmounted).toBe(false);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
  it("目标删除或dispose期间完成的挂载不再导航", async () => {
    const f = policyFixture(),
      gate = deferred<void>(),
      mount = f.host.mountActive;
    try {
      await f.policy.select(f.forms[0]!, "keep-mounted");
      const first = f.current();
      f.host.mountActive = async (target) => {
        await gate.promise;
        return mount(target);
      };
      const pending = f.policy.select(f.forms[1]!, "keep-mounted");
      f.policy.dispose();
      gate.resolve();
      expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
      expect(f.current()).toBe(first);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
});
