---
"@flowduet/core": minor
---

部署冒烟链路：`pnpm smoke` 一键完成「启动 Flowable 6.8 容器 → REST 部署基准
XML → 断言流程定义注册」，CI 侧以 workflow_dispatch 手动触发的同名 job 承载。
