# ADR-0007：交付形态、工程约定与命名

- 状态：Accepted
- 日期：2026-09-14

## 决策

1. **双形态交付**：npm 组件库 + 可独立部署的 demo 应用（`apps/playground`，兼作文档站示例）；
2. **monorepo 工程约定**：pnpm workspace——`packages/core`、`packages/designer`、`packages/form-create`、`apps/playground`；Vite + Vitest + TypeScript 严格模式 + changesets + GitHub Actions（lint + test）；
3. **License：Apache-2.0**（专利条款对组件库友好，商用集成无顾虑；明确否决 AGPL——会吓跑商用集成者）；
4. **命名：FlowDuet**——两个声部（钉钉式 / BPMN 双视图），一份乐谱（一棵模型树）；隐喻直指核心差异化。

### 命名核查记录（2026-09-14）

| 候选                                                   | npm 裸名    | GitHub 同名                      | 结论                           |
| ------------------------------------------------------ | ----------- | -------------------------------- | ------------------------------ |
| **flowduet**                                           | ✅ 可用     | ✅ 无任何同名账号                | **选定**                       |
| flowprism                                              | ✅ 可用     | ⚠️ 2020 年休眠空壳 org（0 仓库） | 备选                           |
| flowlens / flowdelta / flowbridge / irisflow / flowtao | ✅ 可用     | 各有零散账号                     | 备选                           |
| duoflow                                                | ✅ 可用     | ❌ 活跃用户 + duoflow.org        | 弃                             |
| flowcraft / uniflow / bpmn-vue / flowsmith / deltaflow | ❌ npm 已占 | —                                | 出局                           |
| flowvue                                                | ✅ 可用     | ✅                               | 主动弃：与依赖库 Vue Flow 混淆 |

## 后果

- npm org `flowduet` 建成后即锁定 `@flowduet/*` 包名族；**org 名是全链路唯一不可逆的坑，优先建立**（占坑清单见 ROADMAP Step 0）；
- 双形态 = 范围 +1，靠 monorepo 分包与 v1 纪律（ADR-0001、ROADMAP 风险清单）控制；
- GitHub 仓库可改名，npm org 基本不可改——所有对外物料（README、demo、文档站）统一用 `@flowduet` 前缀。
