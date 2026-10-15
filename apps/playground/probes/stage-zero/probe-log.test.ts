import { expect, it } from "vitest";
import { entries, record } from "./probe-log";
import { EntityRegistry } from "./identity-policy";
it("替换文档后的迟到事件同时记录当前epoch与旧目标epoch", () => {
  entries.value = [];
  const registry = new EntityRegistry();
  registry.sync([{ kind: "node", id: "a", object: {} }]);
  const old = registry.ref("node", "a");
  registry.replaceDocument();
  record("location", "stale", {}, old, registry.documentEpoch);
  expect(entries.value[0]?.documentEpoch).toBe(2);
  expect(entries.value[0]?.entity?.documentEpoch).toBe(1);
});
it("无文档归属的事件明确未知，不使用固定世代", () => {
  entries.value = [];
  record("theme", "open", {});
  expect(entries.value[0]?.documentEpoch).toBeNull();
});
