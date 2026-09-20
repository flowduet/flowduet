# ADR-0006：表单集成 —— FormCreate 深度内置、分包落地，Pro 是红线

- 状态：Accepted
- 日期：2026-09-14

## 背景

选 FormCreate 的核心理由：**一套 schema 适配 8 个主流 UI 框架**。但 FormCreate 是双轨授权（2026-09 核查）：

- **渲染器全家桶（MIT）**：`@form-create/element-plus`、`@form-create/ant-design-vue`、`@form-create/naive-ui`、`@form-create/arco-design`、`@form-create/tdesign`、`@form-create/vant` 等——8 框架价值真实、干净、可继承；
- **可视化表单设计器**：开源版 `@form-create/designer` 为 MIT，但基于 **Element Plus 单一基座**；跨框架设计器版本中 **Antd 版与 Vant 4 版也已开源**；
- **FcDesigner Pro：商业授权（license key 校验）**，含 AI 表单助理、公式计算、角色权限、生成建表 SQL 等增值能力。

## 决策

1. **"深度内置"是产品体验承诺（一站式画流程 + 画表单），不等于 core 依赖表单库**：
   - `@flowduet/core` **零表单依赖**，只定义"节点 ↔ 表单"绑定协议（formKey / 表单 schema 引用）；
   - `@flowduet/form-create` 官方深度集成包承担表单设计与渲染绑定，不用 FormCreate 的用户可整体不装；
2. v1 内置 **MIT 版设计器（EP 基座）+ 8 框架 MIT 渲染器绑定**——设计时一套、运行时多框架，这正是 FormCreate 自身的架构哲学；
3. **红线：FcDesigner Pro 的任何代码不可进入本仓库**——Apache-2.0 项目不能内嵌商业授权组件发布；
4. 多框架设计器路线（v1.x）：
   - 官方开源 Antd / Vant 版设计器直接接入（近零成本多两个基座）；
   - Naive / Arco / TDesign 走 `FcDesigner.component()` / `FcDesigner.dragRule()` / menu 扩展 API 写**组件规则包**（零 fork）——规则包是"框架 × 组件 props 映射矩阵"的数据型工作，按社区需求排优先级，**不为这事 fork 设计器内核**。

## 交叉事实

Flowable 7 已删除引擎自带表单引擎 ⇒ 表单走前端自渲染是顺势选择；6.x 用户不用引擎表单也完全兼容。表单内置与引擎适配无冲突。

## 后果

- README 需写清表单能力边界：设计器基座 EP（v1），渲染支持 8 框架；"多框架设计器"是路线图项而非 v1 承诺；
- `@flowduet/form-create` 的深度集成使核心库不背表单领域包袱，同时 demo/playground 默认装配呈现一站式体验。
