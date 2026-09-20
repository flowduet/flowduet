import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "./index.js";

describe("@flowduet/core 冒烟", () => {
  it("入口模块可加载", () => {
    expect(CORE_VERSION).toBeTruthy();
  });

  it("CORE_VERSION 与 package.json 版本一致（防漂移）", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(CORE_VERSION).toBe(pkg.version);
  });
});
