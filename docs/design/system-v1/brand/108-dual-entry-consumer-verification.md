# #108 双入口公开消费示例与安装包验证记录

## 结论与边界

2026-11-06，本票在既有 Playground 内完成双实例、双入口整合，并在同一最终代码状态下分别对源码宿主和实际三包 tarball 消费者执行每侧 19 个浏览器分项及 1 个整合脚本。两侧所有已执行脚本的 `failures`、`errors`、`resourceErrors`、`unhandled` 均为空。

本地实施与自动验收完成；真实 OS 中文输入法、其他浏览器、移动端和完整可访问性认证仍未验证。Node 22／24 远端 CI 与维护者审阅属于后续 PR／合并门，本轮未执行，不写成已通过；父工单 #102 不因本票自动关闭。

## 独立审查

- 第 1 轮：Standards 重要 0／细节 1，Spec 重要 2／细节 1。两处主题逻辑重复已提取 `useAppearanceHostMode`；最终验证文档、依赖树、tarball 哈希与当前消费侧 `realControls` 证据已补齐；1.27:1 的显式日期选中项已单列配置影响。
- 第 2 轮：Standards 重要 0／细节 0，Spec 重要 0／细节 1。剩余细节是 T08 把“另一表单”误写成四类行为均覆盖，现已按实际证据收窄为文本覆盖另一表单、各组覆盖同 ID 重开；最终 lint 与链接检查通过。两轮重要发现均已关闭。

## 实际环境

| 项目                | 实际值                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| OS／架构            | macOS darwin x64                                                                                               |
| Node                | v24.18.0                                                                                                       |
| Chromium            | 156.0.8078.4；UA 为 HeadlessChrome/156.0.0.0                                                                   |
| 基础视口            | 1440×1100、deviceScaleFactor=1、缩放 1                                                                         |
| 分项视口            | 文本／节点 1440×1100；控件／下拉矩阵 1440×2200；日期 1440×1800；布局段另用 1024×900 或 900×700 + CSS zoom 200% |
| Vue                 | 3.5.43                                                                                                         |
| Element Plus        | 2.14.6，物理副本 1 份，依赖树均为 deduped                                                                      |
| FormCreate renderer | `@form-create/element-ui` 3.3.4                                                                                |
| FormCreate designer | 3.5.0（既有依赖，外壳不在本批适配范围）                                                                        |
| 消费工具            | TypeScript 5.9.3、Vite 8.3.0；无源码 alias                                                                     |

每份 JSON 记录各自浏览器、视口或缩放；布局数值以对应文件为准。CSS zoom 不冒充浏览器／操作系统完整缩放矩阵。

## 实际 tarball

静态报告：[static-verification.json](evidence/108-dual-entry-consumer/consumer/static-verification.json)；依赖树：[npm-ls.txt](evidence/108-dual-entry-consumer/consumer/npm-ls.txt)。

| 包                      | tarball                          | SHA-256                                                            |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `@flowduet/core`        | `flowduet-core-0.3.0.tgz`        | `581ec0ada669dea64e3653de16ff16f619be95c7083eb37fdbe0363fac454f57` |
| `@flowduet/designer`    | `flowduet-designer-0.1.0.tgz`    | `3b5bc155c68c680f4768e555f03a7f31068f1ced05480cbe0004fbc99dfec1d7` |
| `@flowduet/form-create` | `flowduet-form-create-0.1.0.tgz` | `87e0ecb9d7e5927bdbe15c5ff2c6480dec107e05542bbcfe9c524e225539d652` |

全新临时目录同时安装这三个文件后，`tsc` 严格公开类型入口检查与 Vite 生产构建通过。静态报告中的 `browserRender` 是打包阶段的待办状态；随后已对该同一消费者完成 [Chromium 整合验证](evidence/108-dual-entry-consumer/consumer/final-integration/integration.json) 和下表全部分项，不把构建当作渲染证据。

## T01–T14 证据映射

Playground 与 tarball 消费者使用同名目录；下表链接优先指向 Playground，消费侧对应文件位于 `evidence/108-dual-entry-consumer/consumer/`。两侧均已实际执行，不以先前单票结果代替整合回归。

| 编号                     | 本轮实际结果与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T01 旧路径               | [整合基线](evidence/108-dual-entry-consumer/playground/integration/integration.json)：旧抽屉无新类／变量且输入和确定按钮 32px，旧预览无新类／变量且自有按钮 small 24px；[抽屉行为](evidence/108-dual-entry-consumer/playground/node-behavior/behavior.json) 与 [文本行为](evidence/108-dual-entry-consumer/playground/form-text/behavior/behavior.json) 复核确定／取消、启停和旧表单合同                                                                                                   |
| T02 八组外观             | [抽屉八组](evidence/108-dual-entry-consumer/playground/node-matrix/matrix.json)、[文本八组](evidence/108-dual-entry-consumer/playground/form-text/matrix/matrix.json)、[控件八组](evidence/108-dual-entry-consumer/playground/form-controls/matrix/matrix.json)、[下拉八组](evidence/108-dual-entry-consumer/playground/form-select/matrix/matrix.json)、[日期 8×5 共 40 面板](evidence/108-dual-entry-consumer/playground/form-date/matrix/matrix.json)；时间子面板包含在 datetime 矩阵内 |
| T03 抽屉全对象           | [抽屉行为](evidence/108-dual-entry-consumer/playground/node-behavior/behavior.json)：单签／会签／或签／依次、抄送、条件、发起／结束空抽屉、目录与手写 formKey、确定／取消、长错误和焦点                                                                                                                                                                                                                                                                                                    |
| T04 八类字段与状态       | [文本](evidence/108-dual-entry-consumer/playground/form-text/behavior/behavior.json)、[数字与选择控件](evidence/108-dual-entry-consumer/playground/form-controls/behavior/behavior.json)、[下拉](evidence/108-dual-entry-consumer/playground/form-select/behavior/behavior.json)、[日期与时间](evidence/108-dual-entry-consumer/playground/form-date/behavior/behavior.json)：当前值、必填失败到成功、禁用、空选项、清空、边界和键盘选择                                                   |
| T05 显式配置优先         | [显式控件](evidence/108-dual-entry-consumer/playground/form-controls/priority/explicit-priority.json)、[inline 布局](evidence/108-dual-entry-consumer/playground/form-controls/layout/inline-layout.json)、[下拉审查回归](evidence/108-dual-entry-consumer/playground/form-select/review/review-regression.json)、[密度反例](evidence/108-dual-entry-consumer/playground/form-select/density/style-density.json)；范围外包源码未修改                                                       |
| T06 换肤与启停保留       | [整合真实点击](evidence/108-dual-entry-consumer/playground/integration/integration.json) 证明真实聚焦、切换和输入保留；四类预览行为及抽屉行为复核来源／主题／密度／启停、焦点、未提交输入和试填值                                                                                                                                                                                                                                                                                          |
| T07 组合输入             | 抽屉和文本行为中的合成 `CompositionEvent`／`InputEvent` 通过，未提前提交；真实 OS IME 未执行，见下文人工责任                                                                                                                                                                                                                                                                                                                                                                               |
| T08 定义换代             | 文本行为覆盖另一表单及同 ID 重开，控件／下拉／日期行为覆盖同 ID 新对象重开，各组均覆盖外观更新不重置；[日期定义重置](evidence/108-dual-entry-consumer/playground/form-date/behavior/behavior.json) 与整合重挂证据可复核                                                                                                                                                                                                                                                                    |
| T09 双实例与宿主隔离     | [整合双抽屉与卸载重挂](evidence/108-dual-entry-consumer/playground/integration/integration.json)、下拉／日期 `dual`、`hostIsolation`、宿主主题前后快照；另一实例、宿主变量和全局主题不被改写                                                                                                                                                                                                                                                                                               |
| T10 真实弹层             | [下拉行为](evidence/108-dual-entry-consumer/playground/form-select/behavior/behavior.json)、[日期行为](evidence/108-dual-entry-consumer/playground/form-date/behavior/behavior.json)、[日期布局](evidence/108-dual-entry-consumer/playground/form-date/layout/layout.json)：业务类名合并、显式挂载、键盘、焦点、层级、滚动、缩放、边缘和清理                                                                                                                                               |
| T11 长中文／焦点／对比   | 八组计算样式与截图、[宿主颜色 12 例](evidence/108-dual-entry-consumer/playground/node-host-colors/host-colors.json)、[焦点与对比专项](evidence/108-dual-entry-consumer/playground/node-contrast/round2-fixes.json)、长错误与 200% 布局；宿主原值和显式样式例外单列如下，不计作主题目标通过                                                                                                                                                                                                 |
| T12 清理／非法配置／异常 | 整合卸载重挂、弹层清理、非法密度字段级告警、输入保留、校验拒绝与 `pageerror`／`unhandledrejection` 监测通过；未对第三方渲染器另做故障注入，不据此宣称所有异常路径均已覆盖                                                                                                                                                                                                                                                                                                                  |
| T13 实际 tarball         | 上述静态报告、依赖树、tarball 哈希、消费侧整合 JSON 与消费侧 19 个分项；单份 EP 2.14.6、renderer 3.3.4，无源码 alias 或跨副本注入                                                                                                                                                                                                                                                                                                                                                          |
| T14 工程门槛             | [lint](evidence/108-dual-entry-consumer/engineering/pnpm-lint.log)、[全量测试](evidence/108-dual-entry-consumer/engineering/pnpm-test.log)、[build](evidence/108-dual-entry-consumer/engineering/pnpm-build.log) 通过；[changeset status](evidence/108-dual-entry-consumer/engineering/changeset-status.log) 正常，远端 CI 未运行                                                                                                                                                          |

全量测试共 66 个文件、1025 条用例：core 14／148、designer 15／202、form-create 19／368、Playground 18／307，全部通过。Playground 新增真实 App 双入口用例在并发负载下的超时上限按既有重组件先例设为 15 秒，最终根目录全量测试通过。

另行补充的全 Playground `vue-tsc` 检查未通过，未写成成功：报错位于既有 `App.integration.test.ts`／`App.test.ts` 的 Blob、`this`、VueNode 类型，以及既有宿主 `ElOption` 声明；新增 `useAppearanceHostMode` 没有新增报错。该命令不是仓库现有门槛，本票未借此扩大修改既有测试类型；正式 lint、全量测试和 build 均以上述日志为准。

## 宿主原值与显式配置例外

| 例外                | 实际值与处置                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 宿主 EP 日期选中项  | `rgb(255,255,255)` 对 `rgb(64,158,255)` 为 2.78:1，是宿主 EP 2.14.6 原值，不记为 FlowDuet 自有角色对比目标通过；见日期行为 `dual.first`                 |
| 显式品牌日期选中项  | `rgb(23,31,62)` 对显式 `rgb(18,52,86)` 为 1.27:1；显式 `popperStyle` 背景优先，不记为品牌主题目标通过，也不为主题改写业务配置；见日期行为 `dual.second` |
| 显式选项颜色／尺寸  | `popperStyle`、字段／选项 inline 颜色、字号、高度、开关宽度、`appendTo`、`teleported` 均按原配置保留；由此产生的对比、布局或归属偏差只记为配置影响      |
| 原生 select         | 系统选项弹层由浏览器／OS 绘制，只有有限 CSS 可控，不记为像素级主题一致                                                                                  |
| Playground 穿透样式 | 仅为让演示外观控件在抽屉打开时可真实点击，宿主编排样式，不属于公开 `appearance` 合同                                                                    |

这些例外没有被 `failures=[]` 隐去：它们属于规格允许的宿主原值或显式配置影响，不是本批自有角色／默认主题的通过证据，也未被发现的内容损坏或宿主安全缺陷替代正常交付门槛。

## 未执行项与责任

- 真实 OS 中文输入法：由人工验收者按 `apps/playground/README.md` 的五步流程，在 macOS 中文输入法下实测并记录 OS、输入法、Chromium 和结果；本代理只执行了合成组合事件，未执行 OS IME，不宣称该项通过。
- Firefox、Safari／WebKit、移动端、其他 EP 组合与完整可访问性认证：本票未验证；未验证不等于已确认不兼容。
- 第三方渲染器故障注入：本轮只证明所跑路径无未处理异常及既有校验错误通道，未建立额外异常矩阵。
- Node 22／24 远端 CI、维护者审阅、推送、PR、合并与发包：均未执行，分别保留给后续授权流程。

本票没有修改公开包源码、依赖或 peer 范围，因此不新增 changeset；现有 changeset 属于先前切片。Playground 是唯一长期演示宿主，`scripts/appearance-consumer/template` 只由验证脚本复制到临时空目录，不是第二套长期应用。
