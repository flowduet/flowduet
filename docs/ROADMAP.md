# 路线图

## Step 0 · 占坑 ✅（2026-09-14）

- [x] GitHub org `flowduet` + 仓库 `flowduet/flowduet`
- [x] LICENSE（Apache-2.0）
- [x] npm org `flowduet`（2026-09-18 确认已建立）
- [x] npm 裸名 `flowduet` 占位包 0.0.0（2026-09-18 已发布，包源在 `npm/flowduet/`）
- [ ] 域名 `flowduet.dev` / Gitee 镜像（不急，v1 像样后再说）

## 迭代一 · Step 0 收尾 + Step 1 全量（2026-09-18 → 09-30）

2026-09-18 grilling 会话收敛的执行口径（9 项决策无遗留分歧）：

- **范围**：Step 0 收尾（裸名占位包）+ Step 1 全量（脚手架 + 三条测试链 + 部署冒烟）；不搭界面，playground 不进本迭代。
- **出口标准**：Step 1 完成标准 + 发布链路打通（`@flowduet/core` 0.0.x 上 npm）。
- **冒烟口径**：完成标准以**本地 Docker 的 Flowable 6.8 真实部署成功**为准；CI 冒烟 job 同迭代搭好但设为 `workflow_dispatch` 手动触发（仅 6.8）；7.2 / 8.0 冒烟按原计划留到 v1。
- **基准文件口径**：手写最小合法 XML 进自动化测试，部署成功兜底其合法性；flowable-ui 6.8 Modeler 导出仅作一次性人工参照，不进测试。
- **发包口径**：本机 npm 人工首发（changesets 管版本号），CI 自动发包（NPM_TOKEN）等正式 release 流程再上。
- **工程口径**：ESLint（flat config，实装 v10）+ Prettier；Node 22 LTS + pnpm 10（`packageManager` 钉死）；本地不加 git hooks；`packages/designer`、`packages/form-create`、`apps/playground` 以 README + 私有 package.json 占位（2026-09-20 review 调整，私有包不进 changesets 发布矩阵）。
- **协作口径**：任务拆 GitHub Issues 挂里程碑 `iteration-1`，feature 分支 → PR → develop。

## Step 1 · 内核地基（目标 1–2 周）

**不搭界面。** 全项目最硬的假设是"我们编译出的 XML 能被 Flowable 真实部署执行"，先用 TDD 把最小闭环立起来。

- 脚手架：pnpm monorepo（`packages/core` 起步，其余目录占位）+ Vite + Vitest + TS 严格模式 + changesets + GitHub Actions（lint + test）
- 三条红→绿测试链：
  1. **编译合同**：`compile(model)` 输入最小流程（开始 → 用户任务 → 排他网关 → 两分支 → 结束），输出与基准文件一致的 flowable 方言 XML（命名空间声明、`flowable:assignee`、`bpmndi` 布局一个不能少）
  2. **往返保真**：`parse(xml) → model → compile()` 语义等价（**全项目最高优先级不变量**）
  3. **适配器合同**：适配器接口（命名空间前缀、扩展属性注入点、任务类型映射），Flowable 6.8 方言首个实例
- 接缝声明：`BpmnModel`（moddle 树包装）/ `Compiler` / `Parser` / `DiLayout`（v0 恒等映射用画布坐标，自动布局在 Step 3）
- **完成标准**：`pnpm test` 全绿 + CI 绿 + 基准 XML 经 Flowable 6.8 REST 部署接口**真实部署成功**（定海神针——商业价值成立的物理事实）

## 迭代二 · 钉钉式视图 MVP ✅（2026-09-20 规划 → 09-23 完成，提前近一个月）

> 实际收敛：九项决策不变；功能票 #19–#26 全部合并（两轮用户评审加固叠加）；出口标准五条全过——
> 五类全谱流程经 UI 编辑导出并在 6.8 真实部署+启动+会签运行时验证（`docs/specs/iteration-2/ACCEPTANCE.md`）、
> 只读投影互切零转换、测试 78+93 全绿、`@flowduet/core` 0.2.0 + `@flowduet/designer` 0.0.2 已发 npm。
> 视觉定稿补充：BPMN 画布词汇经用户真机反馈全 SVG 化（网关符号互换缺陷根治）。

2026-09-20 grilling 会话收敛的执行口径（九项决策无遗留分歧；总纲与 spec 索引见 `docs/specs/iteration-2/README.md`）：

- **主线**：钉钉式视图 MVP + 内核最小配套，首次进入 UI 工程；验收宿主用 `apps/playground` 拉起最小页面（钉钉式编辑 | BPMN 只读 | XML 导出预览）。
- **节点边界**：五类——审批、条件分支、会签、抄送、并行分支（ADR-0004 映射，术语见 CONTEXT.md「审批节点」节）。
- **多实例**：会签 / 或签 / 依次审批三档全上（非串行 × 完成条件差异 + 串行形态）。
- **抄送方言**：`bpmn:ServiceTask` + 适配器扩展属性（收件人）——适配器合同「扩展属性注入点」的首个真实消费者；知会行为由宿主 delegate 实现，内核不管运行时。
- **双视图**：钉钉式可编辑 + Vue-Flow **只读投影**，同一棵模型树互切零转换（ADR-0003）；可编辑画布留到 v1 后段。
- **技术栈**：designer 包 Vue 3 + Element Plus（与 ADR-0006 form-create EP 基座同构）。
- **抽屉字段面**：最小集（节点名、审批人、完成方式、条件表达式、默认分支、抄送收件人）+ formKey 占位；监听器、扩展属性面板、表单绑定协议推后。
- **时间盒**：两周（2026-10-08 → 10-22）；超期砍序：只读投影 → 依次审批 → 抄送。
- **发布口径**：`@flowduet/core` 0.2.0 + `@flowduet/designer` 公开 0.0.x alpha；CI 自动发包等正式 release 流程再上。
- **显式不做**：节点拒绝语义（运行时话题）、监听器 / 扩展属性高级面板、表单绑定协议、BPMN 可编辑画布、7.2 / 8.0 冒烟。
- **协作口径**：同迭代一（Issues 挂里程碑 `iteration-2`，feature 分支 → PR → develop），外加 v1 起新纪律——spec 先于票：`docs/specs/` 逐份成稿后拆自包含票，每票新会话 `/implement`。
- **出口标准**：① playground 五类节点编辑 → 导出 XML → Flowable 6.8 真实部署成功（冒烟扩到新元素全谱）；② 只读投影与钉钉式读写同一棵树、互切零转换；③ 三条测试链覆盖五类节点全谱；④ `pnpm test` + CI 全绿；⑤ 双包发布完成。

## 迭代三 · 流程与表单设计闭环（2026-09-24 规划）

状态：设计范围已确认，书面规格待审阅；实施、里程碑和功能票尚未开始。规格见 [迭代三总纲](specs/iteration-3/README.md)，出口证据要求见 [验收清单](specs/iteration-3/ACCEPTANCE.md)。

- **目标**：让 npm 集成开发者完成表单设计、流程绑定、草稿保存、重新打开与试填预览；有效 XML 保持 Flowable 6.8 部署验证。
- **验收宿主**：扩展现有 Playground，维护一套完整演示体验；复用贡献指南中的仓库外临时工程检查 npm 打包产物，不另建长期维护的示例应用。
- **绑定**：流程默认表单 + 审批节点覆盖；文档内复用，绑定关系只存 XML；缺失引用明确报错。
- **文档与存储**：统一流程设计文档封装 XML 与全部文档内表单定义，宿主负责存储；允许保存业务配置未完成的草稿，恢复失败不部分覆盖当前设计。
- **表单范围**：Element Plus，常用字段、默认值、必填与基础布局；试填数据不写回设计定义。
- **包职责**：core 管引用协议，designer 管流程交互，form-create 提供表单与完整集成能力；具体编码提案见 ADR-0009。
- **时间盒**：实施开始起两周；第一周打通纵向链路，第二周完善错误处理、独立安装验证、回归和发布。超量先延后美化与更多示例，核心闭环无法完成则先重新协商范围。
- **发布**：core、designer 相应版本及 form-create 首个公开 alpha；继续 Changesets 人工版本 PR / 发布流程，不提前指定版本号。
- **显式不做**：节点字段权限、跨流程表单库与版本管理、多框架渲染、子表单/上传/远程数据源/脚本、真实发起流程与运行时审批、BPMN 可编辑画布。
- **出口**：Playground 全链路 + 绑定与设计文档往返 + 草稿/损坏文档处理 + 仓库外三包消费验证 + Flowable 6.8 部署冒烟 + 测试/CI/发布留档。

本轮没有明确真实业务试用项目，完成标准是可集成的设计闭环，不代替后续真实用户验证。v1 多框架目标保留在后续迭代。

## v1 · 审批流核心子集

- 元素：开始/结束事件、用户/服务/脚本任务、排他 + 并行 + 包容网关、多实例会签、内嵌子流程、定时边界事件
- 面板：监听器、扩展属性、表单绑定协议
- 视图：钉钉式递归组件视图 + Vue-Flow 画布，互切即换投影（ADR-0003）
- DI：画布坐标直映射；钉钉式导出走自动布局器
- 适配器：Flowable（6.8 / 7.2 / 8.0 部署冒烟）
- 表单：`@flowduet/form-create`（MIT 版设计器 EP 基座 + 8 框架渲染绑定，ADR-0006）
- 交付：npm 双形态 + playground + 文档站

## v1.x（按社区需求排序）

- 官方开源 Antd / Vant 版表单设计器基座接入
- Naive / Arco / TDesign：FcDesigner dragRule 规则包自研（零 fork）
- Camunda 命名空间适配器（ADR-0005 未关闭此门）
- DI 自动布局强化（层次 / 泳道）

## 明确不做（v1）

消息/信号/错误/升级事件、事件子流程、事务子流程、补偿、CMMN/DMN、FcDesigner Pro 集成（License 红线，见 ADR-0006）。

## 风险清单（常看常新）

1. **XML 往返保真是持久战**——moddle 复用已砍掉最大风险，但 Flowable 扩展属性适配与自动布局器仍是月级工作；
2. **v1 纪律是生死线**——双形态 + 表单内置都在推着范围膨胀，4–6 个月的预期经不起任何一次"顺手加个消息事件"；
3. **开源隐形税**——每周 ≥10h 里有 2–3h 属于 issue / 文档 / demo，预算内留出。
