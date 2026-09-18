import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "./index";

describe("@flowduet/core 脚手架冒烟", () => {
  it("入口模块可加载且版本号一致", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });
});
