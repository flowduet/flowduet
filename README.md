<p align="center">
  <img src="docs/assets/logo/icon-192.png" width="120" alt="FlowDuet LOGO：一树两冠">
</p>

# FlowDuet

> 双视图流程设计器 —— 钉钉式审批视图与 BPMN 自由画布，共享同一棵流程模型树。
> Dual-view workflow designer (DingTalk-style approval view + BPMN canvas) sharing one BPMN model tree. For Vue 3 & TypeScript.

🚧 **设计阶段，v0 未发布。** 当前进展与计划见 [ROADMAP](docs/ROADMAP.md)。

## 核心理念

- **一棵模型树，两种视图**：BPMN XML（moddle 模型树）是唯一事实源。钉钉式纵向审批视图与 Vue-Flow 画布只是它的两种投影，任何一种视图导出的都是合法可执行的 BPMN 2.0 XML。
- **引擎无关内核 + 适配器**：内核只面向标准 BPMN；引擎差异（命名空间、扩展属性）做成可插拔适配器。首发 Flowable，验证矩阵覆盖 6.8 / 7.2 / 8.0。
- **TypeScript-first，Vue 3 原生**：画布与交互层完全自研（Vue-Flow），不封装 bpmn-js；XML 模型层站在 bpmn.io 的 MIT 库（bpmn-moddle）上——与 bpmn-js 同构的分层方式。

## 包结构规划（monorepo）

| 包 | 说明 |
|---|---|
| `@flowduet/core` | 模型树 + Parser/Compiler + 引擎适配器 + DI 布局 |
| `@flowduet/designer` | Vue 3 设计器（双视图、属性面板） |
| `@flowduet/form-create` | FormCreate 深度集成（表单设计 + 多框架渲染绑定） |
| `apps/playground` | 可独立部署的演示应用（兼文档示例） |

## 文档

- [决策记录（ADR）](docs/adr/README.md) —— 每条架构决定一份，含背景、被否决的备选与后果
- [路线图](docs/ROADMAP.md)
- [调研备忘：引擎与设计器生态（2026-09）](docs/research/landscape-2026-09.md)

## License

[Apache-2.0](LICENSE)
