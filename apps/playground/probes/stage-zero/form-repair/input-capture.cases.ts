import { describe, it, expect } from "vitest";
import { formStateFixture } from "../form-state/fixtures";
import { stateSignature } from "../contracts/candidate";
import type { DraftValue, EditorAdapter } from "../contracts/types";

describe("P1 同步候选隔离（协议；真实retained实例另验）", () => {
  for (const failedIndex of [0, 1])
    for (const fault of ["throw", "null", "json", "kind", "schema"]) {
      it(`活对象${failedIndex} capture ${fault}实际执行、零写入且原租约可重试`, async () => {
        const { controller: c, forms } = formStateFixture(`P1-${failedIndex}-${fault}`);
        try {
          const inputs = forms.map((target) => {
            const opened = c.openEditor(target);
            if (!opened.ok || opened.value.kind !== "form-content") throw new Error("打开失败");
            return { ...opened.value };
          });
          const signature = stateSignature(c.session),
            live = c.session.current;
          const calls: string[] = [];
          let failing = true;
          const adapters: EditorAdapter[] = inputs.map((input, index) => ({
            flush() {
              calls.push(`${index}:flush`);
            },
            capture(): DraftValue | null {
              calls.push(`${index}:capture`);
              if (index !== failedIndex || !failing) return input;
              if (fault === "throw") throw new Error("capture故障");
              if (fault === "null") return null;
              if (fault === "json") return { ...input, rules: "[" };
              if (fault === "kind") return { kind: "default-form", formKey: undefined };
              return { ...input, rules: '[{"type":"upload","field":"bad"}]' };
            },
          }));
          const leases = forms.map((target, i) => c.store.registerEditor(target, adapters[i]!));
          const result = await c.prepare("draft-save");
          expect(result.ok).toBe(false);
          expect(calls).toContain(`${failedIndex}:capture`);
          expect(calls.slice(0, 3)).toEqual(["0:flush", "1:flush", "0:capture"]);
          expect(calls.filter((v) => v === `${failedIndex}:capture`)).toHaveLength(1);
          if (failedIndex === 1)
            expect(calls).toEqual(["0:flush", "1:flush", "0:capture", "1:capture"]);
          expect(c.session.current).toBe(live);
          expect(stateSignature(c.session)).toBe(signature);
          for (let i = 0; i < 2; i++) {
            expect(c.store.editor(forms[i]!)?.adapter).toBe(adapters[i]);
            expect(c.store.editor(forms[i]!)?.lease).toBe(leases[i]);
          }
          inputs[0]!.rules = '[{"type":"inputNumber","field":"a","value":71}]';
          inputs[1]!.rules = '[{"type":"inputNumber","field":"b","value":82}]';
          forms.forEach((target) => c.drafts.touch(target));
          failing = false;
          const retry = await c.prepare("draft-save");
          expect(retry.ok).toBe(true);
          if (!retry.ok) return;
          expect(retry.value.json).toContain("71");
          expect(retry.value.json).toContain("82");
          expect(stateSignature(c.session)).toBe(signature);
        } finally {
          c.dispose();
        }
      });
    }
});
