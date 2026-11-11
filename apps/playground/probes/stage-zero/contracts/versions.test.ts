import { describe, it, expect } from "vitest";
import { createVersions } from "./versions";
import type { PreparedCandidate } from "./candidate";
const candidate: PreparedCandidate = Object.freeze({
  id: 1,
  controllerId: "A",
  documentEpoch: 1,
  revision: 0,
  json: '{"snapshot":"old"}',
  pendingIssues: [],
  referenceIssues: [],
});
describe("候选交付后的最终版本检查", () => {
  function setup() {
    let version = "before";
    const versions = createVersions({
      key: () => version,
      identity: () => "A:1",
      epoch: () => 1,
      prepare: async () => {
        version = "after";
        return { ok: true, value: candidate };
      },
      isCurrent: () => version === "before",
      notify() {},
    });
    return versions;
  }
  it("不能把旧候选绑定到新输入的校验章", async () => {
    const v = setup();
    expect(await v.validate()).toMatchObject({ ok: false, code: "version-changed" });
    expect(v.validationCurrent).toBe(false);
  });
  it("不能向宿主发送交付时已过期的候选", async () => {
    const v = setup(),
      persisted: string[] = [];
    expect(
      await v.save(async (snapshot) => {
        persisted.push(snapshot.json);
      }),
    ).toMatchObject({ status: "stale" });
    expect(persisted).toEqual([]);
    expect(v.hasPersisted).toBe(false);
  });
});
