# PR #89 三项 P2 修复与主场景复验（2026-10-12）

修复范围为声明修复 changeset、core 接入示例及集成验收留档。未修改运行时逻辑，未新增依赖。代码修复提交：`211b9e13e63e9dc37b85bde067e9048b788ab076`，基于 PR 原 HEAD `f716d72383613329ac604eda8724f157d73523ef`；本文件及原始证据另作独立提交。

## 修复对应

| 评审项                    | 修复与验证                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1：声明修复缺 changeset  | 新增 `.changeset/quiet-types-release.md`，core / form-create 均为 patch，记录 TS7016 / TS2882 修复。`pnpm changeset status` 实际执行，累计候选仍为 core 0.3.0、designer 0.1.0、form-create 0.1.0。                             |
| F2：README 漏导入布局函数 | 公开入口导入补 `verticalDiLayout`。复制完整示例到仓库外 tarball 消费者，`tsc` 与 Node 执行均退出码 0。                                                                                                                         |
| F1：主场景与组合证据不足  | 在现有 Playground 经真实设计器建立两表单，通过页面保存、下载、打开，留存同一快照的设计文档、部署 XML、重复往返、草稿、拒绝矩阵、试填及真实部署记录。旧 `77-acceptance.md` 明确勘误并修正 A14–A17 编号；旧 XML 保留为历史记录。 |

## 环境与操作方式

macOS，Node v24.16.0，pnpm 10.26.1，TypeScript 5.9.3；现有 Playground 为 `http://127.0.0.1:5173/`，启动命令 `pnpm --filter @flowduet/playground dev --host 127.0.0.1 --port 5173`。浏览器 UA 为 Chrome/154.0.0.0，使用独立 Playwright CLI `pr89` 会话，使用 `playwright_cli.sh --session pr89 run-code --filename <临时脚本>` 分段操作并断言。完整体验只在 Playground 验证，外部临时工程只检查安装包消费。

字段创建、属性配置、绑定、完成方式切换、校验、保存、下载和视图切换使用真实点击、填入及选择。文件打开使用 Playwright `setInputFiles`，触发应用真实文件读取与打开处理。读取本地存储仅核对已保存产物，未注入 Vue 私有状态、替换组件或绕过守卫。原生操作系统文件选择器取消未在本轮重验。实际结果见 [browser-results.json](77-recheck/browser-results.json)。

## 同一份申请与复核主场景

[main.flowduet.json](77-recheck/main.flowduet.json) 来自页面“下载设计文档”，含两表单及全部规则与配置：

- `form_1` 申请单含文本、多行、数字、单选、多选、下拉单选、日期单值、开关，加顶层两列栅格及列内“布局备注”。文本/多行有默认值，数字为 `0`、多选为显式 `[]`、开关为 `false`；申请人必填。单选/下拉保留三项静态选项，未配默认值的字段保留未设置语义。
- `form_2` 复核单有独立的“复核意见”字段，必填。表单及字段 ID 与申请单独立。
- 表单级配置通过设计器改为 `formName=申请单验收`、`labelPosition=top`，随往返保持。所有字段及配置均作完整对象比较。
- 流程默认为 `form_1`，经理审批继承默认；合同会签及财务复核覆盖 `form_2`。合同会签经历或签、依次、单签、会签切换，节点 `approval_mi` 与覆盖保留。
- 条件、并行及抄送继续显示并落盘，网关及抄送无有效表单摘要。恢复后的只读 BPMN 视图也正常渲染。

[恢复后的绑定摘要](77-recheck/main-restored.png)、[BPMN 视图](77-recheck/bpmn-restored.png)、[真实字段设计器](77-recheck/full-fields-editor.png)、[表单级配置](77-recheck/restored-editor-options.png)。

## 保存恢复、试填与草稿组合

完整两表单执行保存草稿→刷新恢复→文件打开→重复保存/下载，共两轮文件往返。每轮比较表单完整对象，字段 ID、类型、选项、默认值、必填、布局及表单配置不变，默认与覆盖保持。下载产物：[roundtrip-1](77-recheck/roundtrip-1.flowduet.json)、[roundtrip-2](77-recheck/roundtrip-2.flowduet.json)。

真实 FormCreate 渲染器中，申请人清空后必填失败，补填试填姓名、说明和数字 42 后通过；复核意见为空时失败，补填后通过。切换目标不携带另一表单试填值，切回申请单恢复设计默认值。试填后保存，规则没有试填姓名/意见，两表单设计定义保持。[必填错误](77-recheck/required-error.png)、[申请单通过](77-recheck/apply-preview-valid.png)、[复核单通过](77-recheck/review-preview-valid.png)。

完整文档变体去掉经理审批人及大额分支条件，加入第三张未绑定表单，经打开→保存草稿→刷新恢复→继续预览。三表单内容保持，未绑定表单仍在；保存定位两项待修复，部署受阻且不显示旧有效 XML。[实际恢复草稿](77-recheck/draft-restored.flowduet.json)、[草稿恢复截图](77-recheck/multi-form-draft-restored.png)。

## 完整字段 × 严格打开与引用

20 个拒绝用例均基于完整两表单文档变体，输入及 SHA-256 可复核：[rejection-inputs.json](77-recheck/rejection-inputs.json)、[browser-results.json](77-recheck/browser-results.json)。覆盖坏 JSON，未知版本/引擎/提供者，重复表单 ID，坏规则/配置，坏 XML，重复 XML 节点 ID，未知 URI 属性，flowable 前缀绑定冲突 URI，多流程，scriptTask，upload，重复字段 ID，下拉多选，allowCreate，日期范围，隐藏 `_control`，嵌套栅格。

每次先将当前默认改为 `form_2` 形成未保存编辑，再打开变体并确认替换。全部明确拒绝，当前默认、覆盖及 dirty 保持；随后真实保存，核对完整两表单定义不变，未保存的默认修改也仍在。测试结束恢复主场景默认 `form_1`。

两条完整字段正例通过：项目及引擎前缀更名、URI 不变；仅声明未使用的其他命名空间。有效表单摘要和字段保持。允许输出继续使用前缀别名，按 URI 与绑定语义判定，不要求改回 canonical 前缀。

引用组合通过：失效节点覆盖作为草稿打开并保留 key，相关预览错误、其他有效预览正常，部署受阻且无旧 XML；所有节点均覆盖时，失效默认仍阻断部署。[失效节点覆盖](77-recheck/reference-case-1.png)、[无人继承的失效默认](77-recheck/reference-case-2.png)。

## Flowable 6.8 真实部署

本轮 `pnpm smoke` 退出码 0，既有全套基准及默认/覆盖基准均部署并通过运行时断言：[完整基准日志](77-recheck/baseline-smoke-flowable68.txt)。

页面“导出 XML”结果 [main-export.xml](77-recheck/main-export.xml) 与 `main.flowduet.json.xml` 逐字一致。它含默认 `form_1`、合同会签与财务复核的 `form_2` 覆盖，修正了旧留档无节点覆盖的问题。

该 XML 在独立本地 `flowable/flowable-ui:6.8.0` 容器部署。引擎版本 6.8.0，部署 HTTP 201，定义 `playground_demo:1:e597eff2-c5dd-11f1-b30a-eee469626533` 注册；引擎资源读回与页面导出字节相同。实例启动 HTTP 201，首任务经理审批 assignee=王经理、formKey=null；完成它后展开三个合同会签任务，三者 formKey 均为 `form_2`。部署标识、任务及校验和见 [main-flowable68.json](77-recheck/main-flowable68.json)。

- 设计文档 SHA-256：`0e363cf383240d2895a45421688c11c0a950706a183cbeeb7b0a75bf3c0c61e4`。
- XML SHA-256：`d690e7f47cd7c0e17ec6de035b6a9ee9a54aedfc63f47e4a9627269c530f08c7`。
- 产物校验和：[sha256.json](77-recheck/sha256.json)。原始字节保留在 `77-recheck/`，沿用仓库原始浏览器证据的 formatter 排除规则。

验证停止在会签任务，未执行抄送代理 bean。部署和 formKey 查询证明引用编码可被解析、注册并执行；运行时表单加载/渲染及完整业务审批仍由宿主负责，不作为本轮完成结论。本轮创建的两次冒烟容器使用后停止。

## 终态工程与外部包复验

终态实际执行 `pnpm lint`、`pnpm test`、`pnpm build`，三者退出码均为 0。426 项测试通过（core 125、designer 127、form-create 119、Playground 55）。日志：[lint](77-recheck/lint.txt)、[test](77-recheck/test.txt)、[build](77-recheck/build.txt)。构建含既有 Playground 体积告警，不影响退出码；本轮不声称消除了该告警。

构建后重新实际 pack 三包，在仓库外空工程用 npm / npmmirror 安装（路径经 realpath 规范化）。`npm ls --depth=0` 无 invalid，三包内部 workspace 依赖已转真实版本；README、LICENSE、公开 JS/声明与 CSS 均在包内，core ambient 声明已入包。消费侧 `tsc --noEmit`（strict、skipLibCheck=false）包含三包公开类型及 `ModdleElement`，退出码 0；修复后的 README 完整示例类型检查、Node 执行均为 0。Node core 往返/绑定/严格审计、designer 加载通过，form-create 按已说明的浏览器边界拒绝 Node 顶层导入。消费者类型解析没有 workspace 源码路径。

本次包清单、tarball 校验和与命令结果：[package-consumer.json](77-recheck/package-consumer.json)、[安装日志](77-recheck/consumer-install.txt)、[依赖树](77-recheck/consumer-dependencies.txt)、[Node smoke](77-recheck/consumer-smoke.txt)、[Changesets 候选](77-recheck/changeset-status.json)。本轮未在临时工程新建第二套长期演示。

修复提交的远端 Node 22/24 CI 尚待推送后执行，原 HEAD 的绿灯不能当作新提交 CI 结果。

## 失败修正与剩余边界

- 旧产物不一致及组合留档不足已明确勘误；旧记录保留，新增证据来自本轮重新执行。
- 自动化初期双击菜单添加重复字段，清空后按单击重建；隐藏 input / placeholder 的定位失败改用可点击外层，随后通过。未修改第三方或产品逻辑。
- 前缀更名初版测试误改 URI，已修正输入；初版断言错误要求 canonical 输出前缀，已改查有效绑定语义。最终正例与拒绝分别验证，不把测试工具错误认定为产品缺陷。
- 本轮不宣称重新执行 A01–A20 所有历史分支。打开竞态、存储异常及纯 designer 接入继续对应既有责任票与自动化用例；本轮补主场景、完整字段组合、草稿/引用和部署证据。
- 版本 PR、版本化产物门槛及 npm 发布为后续步骤；本轮候选验收不能替代实际版本 PR 的最终验证。
