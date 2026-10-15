import { describe, it, expect } from "vitest";
import { policyFixture } from "./test-host";
import { deferred } from "../contracts/fixtures";
import type { DraftValue, EditTarget } from "../contracts/types";

async function started() {
  const f = policyFixture();
  await f.policy.select(f.forms[0]!, "keep-mounted");
  return f;
}
const finish = (f: Awaited<ReturnType<typeof started>>) => {
  f.policy.dispose();
  f.c.dispose();
};
describe("C4 验证重建协议（宿主替身，不冒充FormCreate）", () => {
  it("rebuild_preserves_source_identity_and_targets_destination", async () => {
    const f = await started();
    try {
      const [a, b] = f.forms as [EditTarget, EditTarget],
        old = f.current()!,
        oldLease = f.c.store.editor(a)!.lease;
      f.entry(old).content.rules = '[{"type":"input","field":"a_subject","value":"A未应用"}]';
      f.c.drafts.touch(a);
      const before = f.c.session.current,
        xml = (await f.c.model.toXML()).xml;
      expect(await f.policy.select(b, "rebuild-verified")).toMatchObject({
        ok: true,
        value: { actual: "rebuilt", active: b },
      });
      expect(f.current()!.target.ref).toBe(b.ref);
      expect(f.entry(f.current()!).content.rules).toContain("b_subject");
      expect(f.c.store.editor(a)).toBeUndefined();
      expect(f.entry(old).unmounted).toBe(true);
      expect(f.c.drafts.input(a)).toMatchObject({ rules: expect.stringContaining("A未应用") });
      expect(await f.policy.select(a, "rebuild-verified")).toMatchObject({
        ok: true,
        value: { actual: "rebuilt" },
      });
      const newLease = f.c.store.editor(a)!.lease;
      expect(newLease).not.toBe(oldLease);
      f.c.store.releaseEditor(oldLease);
      expect(f.c.store.editor(a)!.lease).toBe(newLease);
      expect(f.entry(f.current()!).content.rules).toContain("A未应用");
      expect(f.c.session.current).toBe(before);
      expect((await f.c.model.toXML()).xml).toBe(xml);
      expect(f.c.hasPersisted).toBe(false);
      expect(f.entries.filter((e) => !e.unmounted)).toHaveLength(1);
    } finally {
      finish(f);
    }
  });
  it.each(["context", "restore", "mount", "export", "semantic", "busy", "owner", "drag"])(
    "%s失败保持源输入且只记K回退",
    async (kind) => {
      const f = await started();
      try {
        const old = f.current()!,
          lease = f.c.store.editor(old.target)!.lease;
        if (kind === "context") f.host.restoreContext = async () => true;
        if (kind === "context") f.entry(old).state.selectedField = "missing";
        if (kind === "restore") f.host.restoreContext = async () => false;
        if (kind === "mount")
          f.host.mountProvisional = async () => {
            throw Error("装载失败");
          };
        if (kind === "export" || kind === "semantic") {
          const mount = f.host.mountProvisional;
          f.host.mountProvisional = async (...args) => {
            const e = await mount(...args);
            e.adapter.capture = () =>
              kind === "export" ? null : { kind: "form-content", rules: "[]", options: "{}" };
            return e;
          };
        }
        if (kind === "busy") f.entry(old).state.composing = true;
        if (kind === "owner") f.entry(old).state.ownerKnown = false;
        if (kind === "drag") f.entry(old).state.dragging = true;
        expect(await f.policy.select(f.forms[1]!, "rebuild-verified")).toMatchObject({
          ok: true,
          value: { actual: "kept-fallback" },
        });
        expect(f.entry(old).unmounted).toBe(false);
        expect(f.c.store.editor(old.target)!.lease).toBe(lease);
        expect(f.c.session.current!.forms[0]!.rules).toContain("事项甲");
      } finally {
        finish(f);
      }
    },
  );
  it.each(
    [0, 1].flatMap((index) =>
      ["throw", "null", "json", "kind", "duplicate", "range", "options"].map((fault) => ({
        index,
        fault,
      })),
    ),
  )("capture_throw_null_invalid_keeps_both_forms $index/$fault", async ({ index, fault }) => {
    const f = await started();
    try {
      const a = f.current()!,
        third = f.c.createForm("其他活编辑器");
      if (!third.ok) throw Error("夹具");
      const target = index === 0 ? a.target : third.value;
      f.c.store.registerEditor(target, {
        flush() {},
        capture() {
          if (fault === "throw") throw Error("注入适配器失败");
          if (fault === "null") return null;
          const values: Record<string, unknown> = {
            json: { kind: "form-content", rules: "{", options: "{}" },
            kind: { kind: "process", name: "错误入口" },
            duplicate: {
              kind: "form-content",
              rules: '[{"type":"input","field":"x"},{"type":"input","field":"x"}]',
              options: "{}",
            },
            range: {
              kind: "form-content",
              rules: '[{"type":"upload","field":"x"}]',
              options: "{}",
            },
            options: { kind: "form-content", rules: "[]", options: "[]" },
          };
          return values[fault] as DraftValue;
        },
      });
      const state = f.c.session.current,
        signature = JSON.stringify(state!.forms),
        xml = (await f.c.model.toXML()).xml;
      const result = await f.policy.select(f.forms[1]!, "rebuild-verified");
      expect(result).toMatchObject({ ok: true, value: { actual: "kept-fallback" } });
      expect(f.entry(a).unmounted).toBe(false);
      expect(f.c.session.current).toBe(state);
      expect(JSON.stringify(state!.forms)).toBe(signature);
      expect((await f.c.model.toXML()).xml).toBe(xml);
      expect(f.c.hasPersisted).toBe(false);
    } finally {
      finish(f);
    }
  });
  it("input_during_restore_rejects_stale_candidate，目的基线早于prepare", async () => {
    const f = await started();
    try {
      const old = f.current()!,
        restore = f.host.restoreContext;
      let sawBasis = false;
      f.host.restoreContext = async (e, before) => {
        sawBasis = f.c.drafts.buffers().some((r) => r.target.ref === f.forms[1]!.ref);
        f.c.drafts.touch(old.target);
        return restore(e, before);
      };
      expect(await f.policy.select(f.forms[1]!, "rebuild-verified")).toMatchObject({
        ok: true,
        value: { actual: "kept-fallback" },
      });
      expect(sawBasis).toBe(true);
      expect(f.entry(old).unmounted).toBe(false);
    } finally {
      finish(f);
    }
  });
  it.each(["adopt", "show", "unmount"] as const)(
    "post_handoff_cleanup_failure_keeps_new_lease %s",
    async (fault) => {
      const f = await started();
      try {
        const old = f.current()!,
          a = old.target,
          b = f.forms[1]!,
          original = f.host[fault];
        let fail = true;
        if (fault === "unmount") {
          const unmount = f.host.unmount;
          f.host.unmount = (e) => {
            if (e === old && fail) throw Error("清理失败");
            unmount(e);
          };
        } else if (fault === "show") {
          const show = f.host.show;
          f.host.show = (e) => {
            if (e.target.ref === b.ref && fail) throw Error("显示失败");
            show(e);
          };
        } else {
          const adopt = f.host.adopt;
          f.host.adopt = (e, l) => {
            if (fail) throw Error("接管失败");
            adopt(e, l);
          };
        }
        expect(await f.policy.select(b, "rebuild-verified")).toMatchObject({
          ok: false,
          code: "commit-failed",
        });
        const lease = f.c.store.editor(b)!.lease;
        expect(f.c.store.editor(a)).toBeUndefined();
        const entry = f.entries.find((e) => e.editor.adapter === f.c.store.editor(b)!.adapter)!;
        entry.content.rules = '[{"type":"input","field":"b_subject","value":"移交后新输入"}]';
        f.c.drafts.touch(b);
        fail = false;
        expect(f.policy.retryRecovery()).toMatchObject({ ok: true });
        expect(f.current()).toBe(entry.editor);
        expect(f.c.store.editor(b)!.lease).toBe(lease);
        const prepared = await f.c.prepare("draft-save");
        expect(prepared.ok).toBe(true);
        if (prepared.ok) expect(prepared.value.json).toContain("移交后新输入");
        expect(f.entry(old).unmounted).toBe(true);
        void original;
      } finally {
        finish(f);
      }
    },
  );
  it("取消/释放期间临时挂载清理，旧失败不能卸载新成功", async () => {
    const f = await started();
    const wait = deferred<void>(),
      entered = deferred<void>();
    try {
      const mount = f.host.mountProvisional;
      f.host.mountProvisional = async (...args) => {
        const e = await mount(...args);
        entered.resolve();
        await wait.promise;
        return e;
      };
      const pending = f.policy.select(f.forms[1]!, "rebuild-verified");
      await entered.promise;
      await f.policy.select(f.forms[0]!, "keep-mounted");
      wait.resolve();
      expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
      expect(f.current()!.target.ref).toBe(f.forms[0]!.ref);
      expect(f.entries.filter((e) => !e.unmounted)).toHaveLength(1);
    } finally {
      wait.resolve();
      finish(f);
    }
  });
});

it("ERR06显式restore仅放弃当前表单；未知替换不能套同ID快照", async () => {
  const f = await started();
  try {
    const [a, b] = f.forms as [EditTarget, EditTarget],
      first = f.current()!;
    f.entry(first).content.rules = '[{"type":"input","field":"a_subject","value":"待放弃甲"}]';
    f.c.drafts.touch(a);
    await f.policy.select(b, "keep-mounted");
    const second = f.current()!;
    f.entry(second).content.rules = '[{"type":"input","field":"b_subject","value":"必须保留乙"}]';
    f.c.drafts.touch(b);
    expect((await f.c.prepare("draft-save")).ok).toBe(true);
    expect(f.c.restore(a).ok).toBe(true);
    expect(f.c.drafts.input(b)).toMatchObject({ rules: expect.stringContaining("必须保留乙") });
    f.c.session.updateFormContent(b.ref.id, "[]", "{}");
    f.c.sync();
    expect(f.c.store.resolve(b.ref)).toBeUndefined();
    expect(f.c.drafts.conflicts().some((r) => r.target.ref === b.ref)).toBe(true);
    expect(await f.policy.select(b, "rebuild-verified")).toMatchObject({
      ok: false,
      code: "stale-target",
    });
    expect(f.entry(second).unmounted).toBe(false);
  } finally {
    finish(f);
  }
});
it("旧候选晚到不清除较新显式校验；重建不确认宿主持久化", async () => {
  const f = await started();
  try {
    const old = await f.c.prepare("draft-save");
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    f.c.drafts.touch(f.forms[0]!);
    expect((await f.c.validate()).ok).toBe(true);
    expect(f.c.validationCurrent).toBe(true);
    expect(f.c.checkPreparedCandidate(old.value)).toMatchObject({
      ok: false,
      code: "version-changed",
    });
    expect(f.c.validationCurrent).toBe(true);
    expect(await f.policy.select(f.forms[1]!, "rebuild-verified")).toMatchObject({
      ok: true,
      value: { actual: "rebuilt" },
    });
    expect(f.c.validationCurrent).toBe(false);
    expect(f.c.hasPersisted).toBe(false);
  } finally {
    finish(f);
  }
});
it("dispose晚于临时装载开始仍清理自己，不触碰源实例", async () => {
  const f = await started(),
    entered = deferred<void>(),
    gate = deferred<void>(),
    mount = f.host.mountProvisional;
  try {
    f.host.mountProvisional = async (...args) => {
      const e = await mount(...args);
      entered.resolve();
      await gate.promise;
      return e;
    };
    const pending = f.policy.select(f.forms[1]!, "rebuild-verified");
    await entered.promise;
    f.policy.dispose();
    gate.resolve();
    expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
    expect(f.entries.filter((e) => !e.unmounted)).toHaveLength(1);
    expect(f.current()!.target.ref).toBe(f.forms[0]!.ref);
  } finally {
    gate.resolve();
    finish(f);
  }
});
it("临时清理抛错如实保留并可重试，不伪装K成功", async () => {
  const f = await started(),
    unmount = f.host.unmount;
  let fail = true;
  try {
    f.host.restoreContext = async () => false;
    f.host.unmount = (e) => {
      if (e !== f.current() && fail) throw Error("人工清理失败");
      unmount(e);
    };
    expect((await f.policy.select(f.forms[1]!, "rebuild-verified")).ok).toBe(false);
    expect(f.policy.recoveryState().temporary).toBe(1);
    fail = false;
    expect(f.policy.retryRecovery().ok).toBe(true);
    expect(f.policy.recoveryState().temporary).toBe(0);
    expect(f.entry(f.current()!).unmounted).toBe(false);
  } finally {
    finish(f);
  }
});
