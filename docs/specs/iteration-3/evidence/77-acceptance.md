# #77 验收证据（2026-10-10）

三包外部接入验收与迭代三版本 PR 准备。基线：develop@34b6a6b（#73–#76 全部合入后），本票分支自该点实施。

## 一、三包 tarball 仓库外安装验证（普通 npm 消费者）

产物：`pnpm pack` 三包 tarball（core 0.2.1 / designer 0.0.5 / form-create 0.0.0）。tarball 内容核对：`dist/` + `LICENSE` + `README.md` + `package.json` 齐全，无源码/测试混入；**`workspace:*` 依赖已被 pack 转换为真实版本号**（form-create 的内部依赖在 tarball 内为 `@flowduet/core@0.2.1` / `@flowduet/designer@0.0.5`；正式发版时 changesets 的 `updateInternalDependents: always` 会升到当次新版本，形态一致）。

临时工程 `/tmp/flowduet-77-consumer`（不依赖 workspace 源码路径，npm 11.13 / Node 24 / registry npmmirror）：

| 验证面                   | 结论             | 说明                                                                                                                                                                                                                                                                                         |
| ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 安装                     | ✅               | `npm install <三 tarball> vue element-plus`，143 包，依赖树 dedupe 干净（vue/element-plus/core 单例）                                                                                                                                                                                        |
| JS 导出（Node）          | ✅               | core 全链路往返：建模（单签+会签）→ `compile`(verticalDiLayout) → `parse`(adapter) → `resolveEffectiveForm`（覆盖优先/默认继承）→ `rejectUnregisteredNamespaces` 严格审计；designer 模块加载与 5 个公开导出在场                                                                              |
| form-create 的 Node 边界 | ✅（按预期拒绝） | `@form-create/designer` 模块顶层访问 `document`，Node 加载抛 `document is not defined`——浏览器库边界，SSR 宿主需 client-only；已写入本票 form-create README 接入说明。JS 导出的浏览器侧验证见下                                                                                              |
| TS 类型                  | ✅               | 临时工程 `tsc --noEmit`（strict + `skipLibCheck: false`）全过：三包 d.ts 解析、公开类型（`ApprovalMode`/`ParseOptions`/`EffectiveFormRef`）可命名、组件类型可标注                                                                                                                            |
| CSS                      | ✅               | exports `./style.css` 解析到 dist CSS；页面样式表注入核对（element-plus 1024 规则、form-create 2641 规则等，dev 经 vite `<style>` 注入，消费的是与 tarball 同源的 dist 产物）                                                                                                                |
| 浏览器真实表单渲染       | ✅               | vite 页面（消费者自建）：`DingtalkDesigner` 渲染（含流程默认表单选择条）、`FormManager` 目录管理、真实 FormCreate 设计器打开（菜单收口：仅八类字段+栅格）、`FormPreview` 真实渲染器试填（字符串/数字值类型正确、触发校验通过、试填值与设计隔离）、`BpmnCanvas` 渲染（4 节点 3 边与模型一致） |
| 一次保存恢复             | ✅               | 消费者页面「保存 → 恢复往返」：`session.save()` → `session.open(saved.json)` 原子恢复，结果 `forms=[form_1:报销申请] t1有效表单=default:form_1 待修复=0`                                                                                                                                     |

### 验收中发现并修复的发布缺陷（两项）

1. **core 声明链断裂（TS7016）**：bpmn-moddle 10.x 未随 npm 包发布类型，仓库的 `src/types/bpmn-moddle.d.ts` ambient 声明不进 dist、tsc 也不在产物 d.ts 保留三斜线引用——消费者 `import type { ModdleElement } from "@flowduet/core"` 报 TS7016。修复：`packages/core/scripts/pack-declarations.mjs` 构建后处理（复制 ambient 声明到 `dist/types/` 并在 `dist/index.d.ts` 头部注入 reference，幂等）。
2. **form-create d.ts 残留 CSS 副作用 import（TS2882）**：`vue-tsc` 生成的 d.ts 保留 `import "@form-create/designer/src/style/index.css"`（运行时已被 vite 抽到 `dist/form-create.css`，仅声明层残留）。修复：`packages/form-create/scripts/strip-css-imports.mjs` 构建后剥离。

两项修复后重 pack、重装、`tsc` 闭环验证通过。esbuild/vite 对 CSS 的处理不影响宿主显式 `import "@flowduet/form-create/style.css"` 合同。

## 二、Playground 主场景回归（含既有基准回归）

Playground dev（工作树 @ 本票分支，三包 dist 已重建）完成：

- **两表单**：申请单（八类字段：输入框/多行输入框/计数器/单选框/多选框/选择器/日期/开关 + 栅格布局，真实 FormCreate 设计器逐项添加）与复核单；同名不同 ID 场景在 #73 真机证据中覆盖。
- **默认 + 覆盖**：流程默认=申请单（XML 落 `flowduet:defaultFormKey="form_1"`，5 个审批节点摘要「继承默认」）；财务复核节点覆盖=复核单（XML 落 `flowable:formKey="form_2"`，摘要「节点指定」，其余节点不受影响）。
- **单签及三种多人审批**：默认模型含单签（经理审批）+会签（合同会签）；真机完成「重开抽屉 → 切会签 → 覆盖仍选中复核单」的形态切换保留绑定验证（#73 designer 四形态互切用例为自动化补充）；或签/依次由基准冒烟（mi-any/mi-sequential）与 #73 真机覆盖。
- **条件、并行和抄送回归**：页面渲染与 XML 落盘核对（`conditionExpression ${amount > 1000}`、`parallelGateway` 分裂/汇合、`flowable:ccTo="张三,李四"` 全在场）；部署侧由既有基准（default-branch/parallel-flow/cc-flow）冒烟覆盖。
- **设计保存恢复预览**：临时工程消费者页面完成 `save → open` 原子恢复往返（含绑定继承恢复）；本地草稿/文件打开/预览对话框链路由 #75/#76 真机与 playground 集成测试（55 例）覆盖。
- dirty 标记、XML 预览自动联动正常。

**验证环境事件（如实记录）**：验证中途 vite 因 lockfile 变化触发依赖重优化整页 reload，丢失一轮内存态（未保存的表单目录），重走后完成；随后 IAB 的 locator/CUA 点击层对本 dev 页面系统性失效（evaluate 读写正常），部分步骤改为页面侧脚本驱动（建单/设默认/抓取 XML 等此前真实交互已验证过的等价路径）。**真实用户交互路径的完整证据以本轮前段真实点击链路 + #73–#76 各票真机记录为准**；本轮页面侧脚本驱动的步骤不冒充真实点击。导出的部署产物来自页面「导出 XML」按钮链路（组合部署导出）。

## 三、Flowable 6.8 真实部署

- **既有全套基准 + 运行时断言**：`scripts/smoke-deploy.sh` 全绿（`77-smoke-flowable68.txt`）——minimal-flow（assignee 运行时断言）、MI 三档（会签 3 任务逐人/或签完成即终止/依次串行队首）、分支两基准、抄送基准、竖排布局场景、**默认表单基准（#72）与多表单覆盖基准（#73，含 formKey 经任务查询可读、继承节点不固化、多节点复用同 key 三段运行时断言）**。
- **Playground 当前有效导出物**：`77-playground-export.xml`（9157 字节，页面「导出 XML」产物，含 `flowduet:defaultFormKey="form_1"`、单签+会签、抄送、条件、并行、竖排 DI）。部署 HTTP 201、流程定义 `playground_demo:1` 注册；启动实例成功，首任务「经理审批」assignee=王经理、formKey=null（继承不固化，引擎语义一致）。容器用后即停。
- **口径**：部署成功证明「设计器产物可被引擎解析、注册并真实执行」；不表示运行时表单接通（表单加载/渲染由宿主经 `resolveEffectiveForm` 自行接入，ADR-0009）。

## 四、form-create 公开 alpha 元数据补齐

- `packages/core/README.md` 新增（安装、建模/编译/解析往返、适配器、绑定协议、CORE_VERSION；API 用法经临时工程实测校正：`compile`/`parse` 异步、单签走 `addUserTask`、零坐标导出须传 `verticalDiLayout`、`resolveEffectiveForm(model, nodeId)` 签名）。
- 三包 `LICENSE`（Apache-2.0 全文，与根 LICENSE 一致）入包目录；npm 打包包含。
- 三包 `package.json`：`exports` 补 `"./package.json"` 子路径、补 `keywords`；form-create `description` 去除「迭代三构建中」措辞。
- form-create README：去除「尚未发布到 npm」过时说明、License 小节移至文末并补文件链接；补「Node/SSR 边界」（`document is not defined`，需浏览器环境或 client-only）。
- **core、designer 不依赖 FormCreate**：依赖树核对（core deps 仅 `bpmn-moddle`；designer deps 为 core/@vue-flow/core/element-plus）✅。

## 五、A01–A20 责任与证据核对（父规格 #70 验收映射）

| 项      | 内容                                                                                    | 责任票      | 证据（本票补充前已有）                                                                                      | 本票补充                                                     |
| ------- | --------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A01–A04 | 无表单流程；默认/覆盖来源；改默认只影响继承；清除覆盖恢复继承；四形态切换保留 ID 与绑定 | #71/#72/#73 | `72-acceptance.md`；designer 四形态互切用例；`73-acceptance.md` 真机 3/4 步                                 | 真机「切会签覆盖仍选中」快照；外部安装 smoke 的覆盖/继承断言 |
| A05–A06 | 改名不破坏引用；同名不同 ID 可区分；删除守卫定位                                        | #72/#73     | `73-acceptance.md` 真机 1/2/5 步 + session 用例                                                             | —                                                            |
| A07–A08 | 草稿保存+刷新恢复、部署导出受阻；未绑定表单不丢弃                                       | #76         | `76-final-fix-verification.md` + playground 集成测试                                                        | 临时工程 save→open 往返真机                                  |
| A09–A10 | 试填校验不污染设计；往返字段语义等价                                                    | #74         | `74-final-fix-verification.md`（F01/F04 修复闭环）、`74-chrome-browser-acceptance.md`                       | 临时工程 FormPreview 真实试填+校验真机                       |
| A11     | 失效引用草稿打开、保留 key、预览/导出受阻                                               | #73/#75     | `73-acceptance.md` 补充回归（空格 key 保留）、`75-codex-browser-acceptance.md`                              | 外部安装 smoke 含失效路径（quiet-form-review 修复）          |
| A12–A13 | 坏格式/未知版本/引擎/提供者/重复 ID/冲突扩展/多流程/超子集拒绝；原子不部分替换          | #75         | `75-acceptance`（五例 + 真机两轮）、form-create 用例                                                        | `rejectUnregisteredNamespaces` 在外部安装 smoke 启用通过     |
| A14–A15 | 配置失效后旧 XML 不冒充；文件读取失败不误报；连续打开顺序正确                           | #72/#75/#76 | quiet-form-review 修复（预览/引用随编辑更新）；`75-race-fix-verification.md`、`76-*`（打开序号/canReplace） | —                                                            |
| A16–A17 | 不装表单包时原接入与手写 formKey 有效                                                   | #72         | designer `formOptions` 可选合同（不传形态不变）用例 + README                                                | 依赖树核对：core/designer 零 FormCreate 依赖                 |
| A18     | 默认 key 失效即使全有覆盖也阻断导出                                                     | #72         | form-create session A18 用例                                                                                | —                                                            |
| A19     | 网关与抄送不参与解析/展示                                                               | #72/#73     | 冒烟断言（网关/抄送无表单入口）+ designer 用例                                                              | 真机快照：抄送/条件/并行节点无「表单：」摘要，仅审批节点有   |
| A20     | 未配审批人标准流程保存恢复；前缀更名 URI 不变识别；仅声明未用不冲突；业务未完成阻断导出 | #75         | `75-acceptance`（A20 用例 + 真机）                                                                          | —                                                            |

结论：A01–A20 全部有明确责任票与可复核证据；本票补充外部安装与部署维度的增量证据，未发现未覆盖的验收缺口。

## 六、自动化基线

- 本票实施前基线：lint / test（426 例：core 125 + designer 127 + form-create 119 + playground 55）/ build 全绿。
- 本票改动后：lint / build 绿；test 复跑见提交前记录（改动面为元数据/构建脚本/文档，无源码行为变化；`CORE_VERSION` 防漂移测试钉住 package.json）。

## 七、遗留与边界

- 版本 PR（release 分支 + changesets version）待本票分支合入 develop 后执行；`CORE_VERSION` 常量须随 `changeset version` 同步 bump（防漂移测试会拦截遗漏）——已写入 CONTRIBUTING 发版流程。
- tarball 内部依赖版本在发版时由 changesets 提升（本票验证的 0.2.1/0.0.5 为当前 workspace 版本，形态一致性已验证）。
- IAB 点击层失效为验证工具环境问题（如实记录于第二节），不影响产品结论；后续 UI 票若复现，优先换会话/重启 IAB 后重走真实点击。
