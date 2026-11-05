# #105 FormPreview 数字、单选、多选与开关外观适配：验证记录

日期：2026-11-05。范围：公开 `FormPreview` 的数字、单选、多选、开关，以及这些字段与既有文本／多行文本的交互回归；不代表下拉、日期、弹层或 #108 双入口完整安装包矩阵已完成。

**当前状态：局部高度方案、全部验证与最终增量双轴复审均已通过，未关闭的重要／细节发现为 0，本切片具备本地提交条件。不代表 #106／#107／#108 或父规格 #102 已完成。**

## 实现与接口边界

- 沿用 #104 的可选 `appearance`、共享 designer 外观合同和 form-create 本地 `ConfigProvider`；本票没有新增或修改公开 API，也没有改动 designer/core。
- `FormPreview.vue` 只在预览实例作用域补控件样式：品牌路径局部重建 EP `--el-border` 简写，适配数字增减按钮边界；单选、多选、开关分别映射选中背景、`onPrimary` 标记／滑块、禁用角色和 2px／3px 键盘焦点。
- 两档密度继续对应 EP default／small。外层控件为 32／24px；单选圆点与勾选框为 14／12px，开关轨道为 40×20／30×16px、滑块为 16／12px，不把内部几何机械拉成外层高度。
- 新适配中的单选／多选组允许 flex 换行，长中文标签使用正常空白与任意断行。控件以 `height:auto`、border-box 和当前 1.6 标签行高对应的上下 padding 形成默认 32、small 24、large 40px 外层高度，长标签可自然撑开；显式 `height:20px` 不被 min-height 抬升，显式 CSS 变量、字段尺寸、表单布局与开关宽度不被写回或清空。
- 试填值、选项、半选配置、数值边界、校验和定义换代仍由原有 FormCreate／FormPreview 路径负责；没有 mock EP 控件、内部测试 API、新依赖或第三方包修改。

## TDD 与公开组件回归

测试接缝为公开 `FormPreview` props、真实 FormCreate DOM、用户输入／点击／键盘与可见试填值；真实计算样式和焦点由 Chromium 验证。

[红色结果摘录](evidence/105-form-preview-controls/tdd-red.json)记录实际观察到的六类反例：数字边界简写残留宿主色、单选白色圆点、多选白色勾选／半选条与禁用已选浅底、开关白色滑块、长选项 852px 溢出 360px 容器，以及禁用已选单选被普通选中规则覆盖。逐项补最小局部样式后转绿；未把过渡中帧或错误的 group class 假设当作产品缺陷。

[公开组件回归](../../../../packages/form-create/src/control-appearance.test.ts)共 6 条，覆盖：

1. 数字输入、键盘增减、min/max、清空 `null` 与外观切换；
2. 单选选中值、禁用选项、DOM 与焦点保持；
3. 多选数组值、真实初始半选、禁用未选／已选与外观切换；
4. 开关 `true`／`false`、禁用、启停与焦点保持；
5. 四类字段显式 large、表单样式和原定义保真；
6. 四类组合试填在换肤／启停中保留，同 ID 定义换代恢复默认值。

最终定向命令 `pnpm --filter @flowduet/form-create exec vitest run src/control-appearance.test.ts src/appearance.test.ts`：2 文件／18 条通过，其中 #104 公开外观回归 12 条保持绿色。

## Chromium 八组外观矩阵

最终结果来自下述实际 tarball 消费页：HeadlessChrome 156.0.0.0，Vue 3.5.44，单份 Element Plus 2.14.6，FormCreate renderer 3.3.4；视口 1440×2200、deviceScaleFactor 1，无源码 alias。

[完整计算结果](evidence/105-form-preview-controls/matrix.json)与[复测脚本](evidence/105-form-preview-controls/matrix.mjs.txt)记录每组实际值，`errors=[]`、`resourceErrors=[]`、`failures=[]`。每组都真实切换开关的关／开状态，保留数字 2、单选 yes、多选数组、文本／多行文本与成功反馈；数字、单选、多选、开关逐组接受键盘焦点检查，品牌路径均验证 2px／3px 焦点几何和当前主色，跟随宿主记录 EP 原值。

| 配色来源 | 主题 | 舒适                                                                   | 紧凑                                                               |
| -------- | ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 跟随宿主 | 浅色 | [截图](evidence/105-form-preview-controls/host-light-comfortable.png)  | [截图](evidence/105-form-preview-controls/host-light-compact.png)  |
| 跟随宿主 | 深色 | [截图](evidence/105-form-preview-controls/host-dark-comfortable.png)   | [截图](evidence/105-form-preview-controls/host-dark-compact.png)   |
| 品牌预设 | 浅色 | [截图](evidence/105-form-preview-controls/brand-light-comfortable.png) | [截图](evidence/105-form-preview-controls/brand-light-compact.png) |
| 品牌预设 | 深色 | [截图](evidence/105-form-preview-controls/brand-dark-comfortable.png)  | [截图](evidence/105-form-preview-controls/brand-dark-compact.png)  |

品牌路径逐项断言数字输入与增减按钮、单选选中／禁用未选／禁用已选、多选选中／半选／禁用未选／禁用已选、开关关／开／禁用开启的背景与前景。跟随宿主不写任何 `--el-*`，EP 控件原值只记录，不冒充 FlowDuet 自有角色对比度通过。八张截图已逐张目检，未见异常混合主题、重叠或内部几何拉伸。

## 真实行为、显式配置与隔离

[行为结果](evidence/105-form-preview-controls/behavior.json)与[操作脚本](evidence/105-form-preview-controls/behavior.mjs.txt)的 `errors=[]`、`resourceErrors=[]`、`unhandledRejections=[]`、`failures=[]`：

- 旧路径标签、自有 small 按钮、四类试填及启停保持；数字按钮／键盘增减、max=3、min=0、清空 `null`、禁用数字均通过。
- 单选、多选、初始真实半选、开关 true/false 与各项禁用操作保持。半选按 EP 既有语义验证初始状态和点击后的数组值，不新增持久半选行为。
- 来源、浅深、密度、启停与非法配置回退保留四类值、同一 DOM、焦点和有效反馈；同 ID 定义换代恢复四类默认值并清除反馈。
- 数字 ArrowUp、单选 Space、多选 Space、开关 Enter 均可操作，四类键盘焦点环均为 2px／3px 偏移。
- 显式配置实例保持表单 right/large、7px padding、数字右侧按钮与 large、单选／多选显式 20px 高度和 inline 标记／文字颜色、开关 56px 宽度、large 内部几何及 inline 轨道／滑块颜色，自有 compact 按钮仍为 24px。[显式配置截图](evidence/105-form-preview-controls/explicit-configuration.png)中的深蓝文字／深色底低对比是用户显式颜色优先的配置影响，不计作品牌对比通过。
- 同 app 双实例异色／异密度、卸载／重挂、无关宿主 EP 控件、html 主题和既有宿主处理器保持。
- 真实必填失败显示长中文字段错误与项目自有失败反馈，无未处理 Promise 拒绝。[失败截图](evidence/105-form-preview-controls/required-failure.png)。
- 八组外观均在 360px 容器＋CSS zoom 200% 下检查长中文单选／多选、错误换行、按钮可达与页面横向溢出。[浅色舒适截图](evidence/105-form-preview-controls/long-options-brand-light-comfortable-zoom-200.png)与[深色紧凑截图](evidence/105-form-preview-controls/long-options-brand-dark-compact-zoom-200.png)已目检。

前序切片回归也在本票场景上实际重跑：#104 [行为结果](evidence/105-form-preview-controls/104-behavior.json)与[八组矩阵](evidence/105-form-preview-controls/104-matrix.json)均为 `failures=[]`，覆盖文本、多行文本、组合输入、校验、焦点、生命周期和双实例。原“同 ID 重开”演示按钮语义保持，四类控件使用独立重开按钮。

## 初轮独立审查与集中修正

初轮完整补丁基线为 `e1ec425`，未提交快照 SHA-256 为 `bab6cded088960fc38a42d9868f83b33418d97d31b717e5ccc445e254bd92170`。独立结论：Standards 重要 0／细节 2／既有 0；Spec 重要 1／细节 1／既有 0，未见 scope creep。

因父规格采用整批累计投入上限，实施在初轮审查后暂停。用户于 2026-11-05 明确回复 **A**，授权仅追加一轮集中修正：修复显式颜色／高度优先级、补齐八组焦点证据、消除两处重复并做增量复审；出现新的重要问题或必须改依赖／架构则立即停止且不提交。

本轮实际处置：

- 单选改为在控件本体映射 EP 主色、圆点白色及禁用变量；开关按关／开状态局部映射 `--el-color-white`，不再用 FlowDuet 直接属性覆盖用户 inline 变量。焦点只统一几何，颜色继续消费各 EP 变量。
- 有 inline style 的单选／多选不再套用新增 height／min-height 规则；公开场景以显式 20px 和自定义颜色复现原缺陷，[红色结果](evidence/105-form-preview-controls/review-red.json)记录三项失败，修复后完整行为归零。
- 八组矩阵新增数字、单选、多选、开关逐组焦点断言，最终 `failures=[]`。
- 提取共享品牌深色紧凑测试夹具；合并三类焦点几何选择器。合并时发现 Vue SFC 的单个 `:global(a,b)` 只编译首个选择器，改为分别 `:global(...)` 的并列选择器后实测通过。
- 集中修正后重新构建、重新打包，并在下述全新最终消费目录重跑全部浏览器与前序文本回归；未新增依赖、公开 API 或字段范围。

第 2 轮增量复审结果：**Standards 重要 0／细节 0／既有 0**，原两项细节全部关闭；**Spec 重要 1／细节 0／既有 0**，原重要与焦点细节均关闭，但出现新的重要交互反例：

- `FormPreview.vue` 为避免 min-height 覆盖显式 height，以 `:not([style])` 整体停用新增 `height:auto`。当选项只设置 inline 颜色，在 360px 容器＋CSS zoom 200% 下会回落到 EP 固定高度。独立 Spec 复审在最终 tarball 只读复测：单选／多选标签高 179.19／134.39px，控件均仅 64px，文字与下一项重叠。
- 现有 matrix／behavior 没覆盖“仅 inline 颜色＋长选项缩放”的组合，此前的零失败不能证明该交互通过。

根据用户选择 A 的停止条件，本轮立即停止，不再追加修复，也不提交。当前分支保留未提交产品、测试和证据；#105 保持开放，后续路线由维护者重新决定。

## 新授权与局部高度方案

用户随后再次回复 **A**，授权仅再试一轮局部 CSS 方案：以内容高度＋密度 padding 取代 min-height 与 style 属性启发式，保留显式 height，并补组合反例与复审；若不能关闭反例或再出现重要问题则停止且不提交。

公开场景新增两个仅设置 inline 颜色、没有显式高度的长中文单选／多选。[修复前结果](evidence/105-form-preview-controls/inline-layout-red.json)中两类控件均仅 48px、标签高 153.56px 且越界；改为 `height:auto`、border-box 和密度 padding 后，[修复结果](evidence/105-form-preview-controls/inline-layout.json)中控件高 163.16px、完整容纳标签，`failures=[]`。[最终截图](evidence/105-form-preview-controls/inline-color-long-options.png)与[复测脚本](evidence/105-form-preview-controls/inline-layout.mjs.txt)已归档。

默认／small／large 的 padding 分别为 4.8／2.4／8.8px，对应 EP 当前 14／12／14px 标签字号与 1.6 行高。matrix 对 0.1px 内字体亚像素差设容差；八组 behavior 同时检查原长选项和仅 inline 颜色长选项，均验证标签不越出控件、无横向溢出。显式 20px 高度、inline 颜色及全部原验收项保持通过。

最终新方案复审快照 SHA-256 为 `faab8c31c0b9641d0220a1f7de8d8929b93ab3fbc81df9187c416a5c495af5bc`。增量结论：**Standards 重要 0／细节 0／既有 0；Spec 重要 0／细节 0／既有 0**。Spec 独立只读 Chromium 复测最终 tarball，确认仅 inline 颜色及原长选项在八组、360px＋CSS zoom 200% 下均容纳标签且不覆盖下一项，显式 20px 与内部几何保持；没有新增重要问题，未触发停止条件。

## 实际 tarball 消费

三包按最新高度方案构建并打包至 `/private/tmp/flowduet-105-height-pack.gChKby`，在全新目录 `/private/tmp/flowduet-105-height-consumer.pRQBHh` 从零安装。消费工程与脚本分离，没有源码 alias 或内部导出。

- [依赖树](evidence/105-form-preview-controls/npm-ls.txt)：`@flowduet/core@0.3.0`、`@flowduet/designer@0.1.0`、`@flowduet/form-create@0.1.0`；EP 2.14.6 单份 deduped，FormCreate renderer 3.3.4，Vue 3.5.44；消费工具 TypeScript 5.9.3、Vite 8.3.5。
- [严格 TS 配置](evidence/105-form-preview-controls/consumer-tsconfig.json)启用 `strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck=false`；[公开消费源码](evidence/105-form-preview-controls/consumer-main.ts.txt)实际使用四类控件及非法类型反例。`tsc --noEmit` 退出码 0（[日志](evidence/105-form-preview-controls/consumer-tsc.txt)）。
- [Vite 配置](evidence/105-form-preview-controls/consumer-vite.config.ts.txt)与[生产构建日志](evidence/105-form-preview-controls/consumer-vite-build.txt)覆盖公开控件页和双实例场景页。[静态消费结果](evidence/105-form-preview-controls/consumer-static.json)确认公开 JS、声明相关入口、CSS 子路径和本票控件规则存在，CSS 无残留 `:deep`。
- [浏览器消费结果](evidence/105-form-preview-controls/consumer-browser.json)、[截图](evidence/105-form-preview-controls/consumer.png)与[复测脚本](evidence/105-form-preview-controls/consumer.mjs.txt)：公开 JS／CSS 渲染、数字增减、单选、多选／半选、开关、文本校验与试填值通过，`errors=[]`、`failures=[]`。
- 最终 tarball 场景页上重跑的[八组矩阵](evidence/105-form-preview-controls/matrix.json)与[完整行为](evidence/105-form-preview-controls/behavior.json)即本文上述零失败结果。

本票只验证自身字段切片，不替代 #108 双入口完整三包矩阵，也不宣称其他 EP peer 解析组合已验证。

## 工程检查

- `pnpm lint`：ESLint 与 Prettier 通过。
- `pnpm test`：63 个文件／986 条测试全过（core 148、designer 202、form-create 330、Playground 306）。
- `pnpm build`：core、designer、form-create、Playground 全过；保留 Playground 既有大 chunk 提示。
- changeset：`.changeset/form-preview-control-appearance.md`，仅 `@flowduet/form-create` minor；无依赖、peer 范围或锁文件变化。
- 补充尝试的包内全源码 `vue-tsc --noEmit -p tsconfig.json` 会报既有测试文件类型错误，清单不含本票新增文件；该命令不是仓库既定门槛，未记为通过。公开声明和源码由上述正式 `build` 的 `tsconfig.build.json` 检查通过。

## 限制与未测项

- 本票未执行真实 macOS 中文输入法；#104 的合成组合输入回归通过不能冒充 OS IME 验收。
- 缩放证据为 CSS zoom 200%，不是浏览器／操作系统完整缩放矩阵。
- Firefox、Safari／WebKit、移动端与完整可访问性认证未验证；Chromium 通过不推断其他环境兼容。
- Playground 仍有既有 favicon 404 控制台日志；独立 tarball 消费页使用 data favicon，浏览器错误为空。
- 未执行本地 Node 22 矩阵或远端 CI；Node 22／24 双矩阵与维护者审阅留待后续 PR。
