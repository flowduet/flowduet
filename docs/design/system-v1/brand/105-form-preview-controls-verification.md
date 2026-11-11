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

## 2026-11-05 完整补丁复审后的显式配置修复

本次完整补丁复审固定对象为 `e1ec425...99a18d49`，在此前通过结论之外补出两项重要反例。用户明确要求先评论登记再修复；[登记评论](https://github.com/flowduet/flowduet/issues/105#issuecomment-6651539229)保留发现及授权范围。此前暂停、失败与修正记录仍是历史事实，本节不将其改写为历史通过。

- F1／Standards／P2：字段 `rule.style` 落在 FormCreate group 上；原新增选项本体变量覆盖继承的 `--el-color-primary`／`--el-color-white`。本次将标记默认前景放到 `.el-form` 边界，让表单、字段和选项 inline 配置继续覆盖；多选消费继承的 EP 主色／白色，移除单选重复的通用主色、白色及禁用背景／边界变量。[颜色红色结果](evidence/105-form-preview-controls/explicit-color-red.json)记录品牌四组共 20 项失败；修复后关闭。
- F2／Spec／P2：`height:auto` 忽略原有效的 `--el-checkbox-height`。本次多选使用 `var(--el-checkbox-height, auto)`，无显式变量时保持原长标签自然撑开。[高度红色结果](evidence/105-form-preview-controls/explicit-height-red.json)记录八组共 16 项失败；修复后字段 56px、选项 72px 均保持。该回归显式使用 EP default 尺寸，以核对旧路径原本有效的变量合同，不将 EP 原有 large 固定高度行为误报为本次缺陷。

### 回归与真实产物证据

测试接缝仍为公开 `FormPreview`＋真实 FormCreate 交互及浏览器计算结果，不新增内部测试 API。Playground 的显式配置实例新增字段级颜色和选项覆盖示例；[定向脚本](evidence/105-form-preview-controls/explicit-priority.mjs.txt)覆盖旧路径及全部八组，未放宽已有显式 20px 高度或长文本合同。漏检原因为既有证据只覆盖选项级颜色和直接 height，未覆盖字段继承及高度变量；本次补相应公开场景断言。

更新包实际打包到 `/private/tmp/flowduet-105-priority-pack/flowduet-form-create-0.1.0.tgz`，使用 `npm install --offline --ignore-scripts --no-audit --no-fund <tarball>` 更新临时消费工程 `/private/tmp/flowduet-105-height-consumer.pRQBHh` 的真实安装包；其余两包及既有依赖不变，不使用源码 alias。`tsc --noEmit` 与两页 Vite 生产构建通过，生产场景 URL 为 `http://127.0.0.1:4176/scene.html`。工作区及安装包 CSS SHA-256 均为 `3e09f7dd8cd40410d3dab9f1edc3cae95ddf4ff0261c0fb65fd026f394141ec3`。依赖仍为单份 EP 2.14.6、renderer 3.3.4、Vue 3.5.44。

最终实际 tarball 结果均为 `errors=[]`、`failures=[]`：

- [显式配置九组](evidence/105-form-preview-controls/priority-fix/explicit-priority.json)：字段颜色 `rgb(191,0,31)` 与标记 `rgb(10,20,30)`、选项更高优先级的 `rgb(18,52,86)`／`rgb(1,2,3)`、56／72px 高度均通过。
- [四类控件八组矩阵](evidence/105-form-preview-controls/priority-fix/matrix.json)与[完整行为](evidence/105-form-preview-controls/priority-fix/behavior.json)：显式 20px、默认尺寸、标记、禁用、键盘、试填与定义换代、隔离、原长选项和仅 inline 颜色长选项的 360px＋CSS zoom 200% 均保持。[显式配置截图](evidence/105-form-preview-controls/priority-fix/explicit-configuration.png)已目检，显式深色文字在深底上的低对比仍作为用户配置影响，不计为主题目标通过。
- #104 [文本矩阵](evidence/105-form-preview-controls/priority-fix/104-matrix.json)与[行为回归](evidence/105-form-preview-controls/priority-fix/104-behavior.json)保持通过。
- [独立公开消费页](evidence/105-form-preview-controls/priority-fix/consumer-browser.json)的四类控件、默认主题和交互通过。

并行运行原 #105 behavior 脚本时，两处按钮尺寸在固定 140ms 后仍读到中间状态，[原失败结果](evidence/105-form-preview-controls/priority-fix/behavior-before-wait.json)保留。脚本现等待公开按钮几何达到原预期 24／32px，再执行原断言；预期值、焦点及试填检查不变，不能收敛时仍超时失败。补跑完整行为归零。

### 独立复审

修复增量基线为 `99a18d49`，最初完整增量快照 `/private/tmp/flowduet-105-priority-review.patch` SHA-256 为 `3f8b17c75ffa34488cb04ee2654a98575184a7d233d090606404cee1746f7d50`，包含产品、场景和红色回归证据。两名新上下文代理分别审查 Standards／Spec，随后追加审查 behavior 等待增量；生产代码未在该快照后变化。

最终 Standards 重要 0／细节 0／既有 0；Spec 重要 0／细节 0／既有 0。F1、F2 均记为已修复。Spec 独立 Chromium 通过真实 tarball 复测全部九组显式颜色及高度、原显式 20px，以及八组长选项缩放；无新增重要发现。独立结论不替代工程门槛。

本次仍只覆盖 #105 两项修复，无新依赖、公开接口、字段能力或业务数据变化，不恢复冻结实验；未提交本轮修改、未推送、未开 PR、未合并或发布。原有未测浏览器、真实 OS 输入法、Node 22／24 CI 和父规格范围边界保持。

### 本轮工程门槛与交付状态

- `pnpm lint`、`pnpm build` 通过；后续新增的工程记录另经 Prettier 检查。无依赖或锁文件变更。
- 默认 `pnpm test` 未通过：首次 form-create 的 `retained-inputs.test.ts` 有 3 条 5 秒超时；该文件单跑又在另外 2 条用例超时。降低并行负载后重跑默认全量，`retained-manager.test.ts` 的另外 5 条用例超时，form-create 为 325 通过／5 失败，Playground 因前包失败未执行。上述用例与设计器逻辑本轮未改动，但不能仅据此宣称与补丁无关或默认门槛已通过。[最后一次默认失败日志](evidence/105-form-preview-controls/priority-fix/default-test.txt)。
- 诊断运行 `pnpm --filter @flowduet/form-create exec vitest run src/components/retained-inputs.test.ts --testTimeout=15000` 为 40/40 通过；随后 `pnpm -r test --testTimeout=15000` 为 63 文件／986 条全过（148＋202＋330＋306），未观察到断言失败。[诊断全量日志](evidence/105-form-preview-controls/priority-fix/diagnostic-test.txt)与[工程摘要](evidence/105-form-preview-controls/priority-fix/engineering.json)。15 秒只用于命令行诊断，未修改仓库默认 5 秒配置；该结果不替代默认门槛。

F1、F2 的本轮修复及独立复审已完成；#105 整票正式交付仍受默认测试超时阻塞。测试耗时根因尚未定位，不能将诊断通过写成整票验收通过。后续由维护者决定是否另行安排旧设计器用例超时排查，默认 `pnpm test` 通过后再推进正式交付；本轮不继续扩大到设计器业务逻辑或测试工程调整。未提交、未推送，Issue 保持开放。

## 2026-11-05 默认时限测试耗时排查与门槛恢复

用户明确追加授权：“继续排查这 5 条测试超时的原因，修复后按默认时限重跑全量测试。”本轮在同一独立分支继续，只改两处测试文件，保留此前外观修复与所有失败记录；此前“默认门槛阻塞”是当时实际状态，以本节新结果为当前状态。

### 诊断与修复

五条用例单独运行在默认时限下本就能通过，未修改的完整文件也有 69/69 通过的一次结果（75.01s）；原全量记录则明确为 5 条 5000ms 超时。因此不是稳定复现的业务断言错误，而是重组件测试的时限敏感问题，不能靠反复跑到绿色来证明已修复。

CPU 采样中约三分之二时间落在真实设计器的 Vue 挂载／更新，计算样式约占 13%，未见长时间空等主导。一个只编辑金额、随后重开的场景仍携带无关日期控件；仅在控制实验移除日期，采样总时长由 2392.2ms 降为 1970.6ms。同步捕获用例还未使用项目已有的样式隔离，增加非视觉协议测试的计算负担。这些事实支持减少无关渲染工作量；宿主负载、JIT／缓存等因素未完全控制，不能将一次采样当作性能保证或宣称已确认所有系统负载的唯一来源。

本轮修复：

- 测试夹具允许传入规则，未传时仍使用原 `numericDateRules`。只为这 5 个金额／会话协议场景传入仅包含真实金额字段的最小规则；数值日期联合场景和夹具原默认合同继续测试。
- 同步捕获场景复用已有 `isolateMainStyle:true`，仍由原 owner 在卸载后恢复样式。真实 FormManager、FormDesigner、FcDesigner、原故障注入、输入操作、断言及清理顺序保持。
- 未新增超时、跳过用例、替换真实组件或改变产品代码、配置与测试脚本；临时 CPU 采样钩子已移除。

同一五条选择命令的测试体耗时合计由 8035ms 降至 6021ms，修复后单条为 1011–1372ms；这是一组观测值，不承诺任意机器负载下都保持同样耗时。[修复前五条](evidence/105-form-preview-controls/timeout-fix/five-before.txt)、[修复前完整文件](evidence/105-form-preview-controls/timeout-fix/manager-before.txt)、[修复后五条](evidence/105-form-preview-controls/timeout-fix/five-after.txt)与[诊断摘要](evidence/105-form-preview-controls/timeout-fix/summary.json)保留实际结果。

### 默认门槛与独立复审

窄测试夹具类型检查 `pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p tsconfig.test-fixtures.json` 通过。随后原始默认命令 `pnpm test`（无 timeout 覆盖、无名称过滤）实际 **63 文件／986 条全部通过**，包括 form-create 330 条和 Playground 306 条。[默认全量原始日志](evidence/105-form-preview-controls/timeout-fix/default-full.txt)。本轮没有改动这 5 条用例的默认 5000ms 时限，也没有把上轮 15 秒诊断结果代作正式门槛。

两名新上下文代理独立审查本轮两文件补丁，SHA-256 为 `980bc11d9f10a249aacbc05cde1128ee471e0092b295c4bf7aece86b5e0a3a8c`；Standards 与 Spec 均重要 0／细节 0／既有 0。审查确认没有不合理弱化必要覆盖，日期半输入、字段切换与日期导入往返仍有原真实组件回归；默认时限全量结果由主代理实际执行。

收尾 `pnpm lint` 与 `pnpm build` 均通过（[lint 日志](evidence/105-form-preview-controls/timeout-fix/lint.txt)、[构建日志](evidence/105-form-preview-controls/timeout-fix/build.txt)），窄类型检查与 `git diff --check` 通过。至此本地默认工程门槛恢复，F1/F2 与这 5 条测试的本轮处置均完成；未提交、未推送、未开 PR 或发布，Node 22／24 CI 与维护者审阅仍留待后续授权交付流程。本轮只改测试夹具和场景输入，生产代码仍为上一轮已验证版本，不新增依赖。
