import { it, expect } from "vitest";
import { withBrowserElementString } from "./browser-element.test-support";
it("正常完成后恢复完整原始描述符", async () => {
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  await withBrowserElementString(async () => {
    expect(document.createElement("div").toString()).toBe("[object HTMLDivElement]");
  });
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
});
it("异步错误仍恢复描述符，不吞异常", async () => {
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  await expect(
    withBrowserElementString(async () => {
      await Promise.resolve();
      throw Error("断言/卸载失败");
    }),
  ).rejects.toThrow("断言/卸载失败");
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
});
it("原先没有自有属性时恢复继承状态", async () => {
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  try {
    Reflect.deleteProperty(Element.prototype, "toString");
    await withBrowserElementString(async () => {});
    expect(Object.hasOwn(Element.prototype, "toString")).toBe(false);
  } finally {
    if (before) Object.defineProperty(Element.prototype, "toString", before);
  }
});
