# #103 节点属性抽屉实例外观：Chromium 验收记录

日期：2026-11-03。范围：仅 `DingtalkDesigner` 的节点属性抽屉及共享外观合同；不代表父规格 #102 的 FormPreview 切片或 #108 的完整安装包浏览器验收已完成。

## 接口与环境

- 用户在实施前通过问题卡片明确选择“批准并开工”，确认 `appearance`、`ComponentAppearance`、`ResolvedComponentAppearance`、三类枚举和包根 `resolveComponentAppearance(value, previous?)`，以及非法配置整份回退合同。
- 浏览器：HeadlessChrome 156.0.0.0（本机 Playwright `chromium-1248`），驱动 `playwright-core 1.64.1` 临时安装在 `/tmp`，未修改仓库依赖或锁文件。
- 实际消费：单份 Element Plus 2.14.6、Vue 3.5.43；Playground 消费本分支构建后的 `@flowduet/designer/dist`，不是源码内部测试导出。
- 公开场景：启动 Playground 后点击“外观验收”。同一 Vue app 中有两个 `DingtalkDesigner`、无关宿主 EP 输入／按钮、八组外观控制、合法启停、非法配置与卸载控制。
- 矩阵视口为 1440×1100、deviceScaleFactor 1；行为验收另以 1024×900 + CSS zoom 200% 检查布局。

## 八组外观矩阵

[完整计算结果](evidence/103-property-drawer/matrix.json)的 `failures` 为空。每组均断言：输入／确定按钮／原生选择器实际高度，控件字号，面板内边距，字段标签字号／颜色与字段间距，选中卡 2px 边框与“已选中”文字，主按钮底色和前景，原生选择器表面，标题字号，抽屉完整位于视口内，未提交输入与焦点保持，模型 `change=0`。跟随宿主实例的内联样式不含任何 `--el-*`；品牌实例只在自己的抽屉内写入局部 EP 变量。

| 配色来源 | 主题 | 舒适                                                             | 紧凑                                                         |
| -------- | ---- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| 跟随宿主 | 浅色 | [截图](evidence/103-property-drawer/host-light-comfortable.png)  | [截图](evidence/103-property-drawer/host-light-compact.png)  |
| 跟随宿主 | 深色 | [截图](evidence/103-property-drawer/host-dark-comfortable.png)   | [截图](evidence/103-property-drawer/host-dark-compact.png)   |
| 品牌预设 | 浅色 | [截图](evidence/103-property-drawer/brand-light-comfortable.png) | [截图](evidence/103-property-drawer/brand-light-compact.png) |
| 品牌预设 | 深色 | [截图](evidence/103-property-drawer/brand-dark-comfortable.png)  | [截图](evidence/103-property-drawer/brand-dark-compact.png)  |

舒适档实测输入和按钮 32px、控件文字 14px、面板内边距 24px；紧凑档为 24px、12px、16px。品牌深色主按钮为 `#A5BBFF` 底与 `#171F3E` 前景，没有改写全局 `--el-color-white`。

跟随宿主深色在宿主明确启用 `html.dark` 的 EP 深色环境中验证；品牌浅色实例在该宿主深色页面仍保持自己的浅色变量。宿主原值例外：EP 默认主按钮白字、次要说明、占位色和输入边界沿用宿主，不计为 FlowDuet 自有角色通过；矩阵另记录浅色输入边框 `rgb(220, 223, 230)`、深色 `rgb(76, 77, 79)`。

## 真实行为

[行为结果](evidence/103-property-drawer/behavior.json)的 `failures` 为空，实际通过：

1. 目录原生 `select` 选择覆盖、确定写模型、取消还原；手写 `formKey` 保存后重开值保持。
2. 单签、会签、或签、依次审批均经真实点击与确定；抄送收件人、条件表达式写模型；发起／结束显示中性标题与空状态，可取消关闭。
3. 运行中切换配色／主题／密度与启停保留同一输入 DOM、未提交中文和焦点；非法密度保持完整上次有效内联呈现并给出字段级告警，不触发模型 `change`。非模态覆盖层未开启穿透，宿主控制经公开事件或键盘操作，节点切换与提交行为保持旧合同。
4. 合成 `CompositionEvent` / `InputEvent` 期间切换不丢字、不自动提交，显式确定仍被“输入法尚未完成”保护，组合结束后可保存。
5. 双实例同时打开，宿主深色不污染品牌浅色实例；卸载一个实例只清理自己的抽屉；Escape 关闭后焦点恢复到节点卡片，条件分支按钮可用 Enter 打开并在 Escape 后恢复焦点。
6. 长非法集合表达式触发既有集合变量错误，多行错误无横向溢出；200% 缩放下抽屉仍完整位于视口内，底部确定／取消可达，[缩放截图](evidence/103-property-drawer/long-error-zoom-200.png)。

[矩阵脚本只读副本](evidence/103-property-drawer/matrix.mjs.txt)与[行为脚本只读副本](evidence/103-property-drawer/behavior.mjs.txt)记录实际操作和断言。副本用 `.txt` 保存，不是新增仓库测试框架或内部产品 API；复测时按本机驱动与 Chromium 路径调整参数。

## 原实施时的工程检查（e43f64f）

- `pnpm lint`：通过（ESLint 与 Prettier）。
- 标准 `pnpm test`：最终通过，core 148、designer 199、form-create 312、Playground 306，共 62 个文件／965 条测试。一次并发运行曾使既有 `retained-manager.test.ts` 的 6 条用例触发 5 秒超时；未修改超时或产品代码，单 worker 312 条全过后，标准命令在空闲环境重跑也全过。
- `pnpm build`：core、designer、form-create、Playground 全通过；Playground 保留既有大 chunk 提示，无新增依赖或锁文件变更。
- changeset：`.changeset/property-drawer-appearance.md`，`@flowduet/designer` minor。

## 实际包消费

最终 core＋designer tarball 在临时空消费项目内安装成功，[依赖树](evidence/103-property-drawer/npm-ls.txt)确认单份 `element-plus@2.14.6`（designer 依赖为 deduped）。[公开 JS／声明／CSS 输出](evidence/103-property-drawer/consumer-output.json)通过：

- 从 `@flowduet/designer` 包根导入 `DingtalkDesigner` 与 `resolveComponentAppearance`，创建 core 模型，验证默认值、非法回退、合法停用和字段级告警。
- 严格 TypeScript 校验 `ComponentAppearance` / `ResolvedComponentAppearance`，非法枚举与缺少 `mode` 均由 `@ts-expect-error` 捕获。
- 经公开 `@flowduet/designer/style.css` 子路径读取样式，确认品牌作用域与自有卡片规则存在，无 `:deep` 残留；类型路径取自公开 `package.json#types`，未使用内部导出。
- [JS 复测脚本](evidence/103-property-drawer/consumer.mjs.txt)、[TS 复测脚本](evidence/103-property-drawer/consumer.ts.txt)与[严格 tsconfig](evidence/103-property-drawer/consumer-tsconfig.json)已归档。安装与 `npm ls` 在消费项目自身目录执行，避免 monorepo 工作区上下文影响本地 tarball 解析。

## 限制与未测项

- 两次非法密度告警分别来自非法配置，以及合法停用后在仍处于非法输入时重新启用；随后通过合法密度修改恢复，均符合回退合同。
- 页面有既有 `favicon.ico` 404 资源错误，与本次外观样式和模型行为无关；未据此宣称页面资源零错误。无 `pageerror`。
- 组合输入是合成事件，**未执行真实 macOS 中文输入法**。
- 缩放证据使用 CSS zoom 200%，不冒充操作系统或浏览器原生缩放的全套验证。
- 原生 `select` 的系统选项弹层由浏览器／操作系统绘制，只能有限控制；未替换成 `ElSelect`，未宣称像素级主题一致。
- Firefox、Safari／WebKit、移动端与完整可访问性认证未验证；Chromium 通过不等于其他环境已兼容。
- 本票未执行 #108 的完整三包 tarball 浏览器矩阵；上述 core＋designer 入口消费不替代该后续验收。

## 2026-11-03 补充审查：宿主颜色修复

对 `cd39258` → `e43f64f` 的补充审查确认一项 P2：跟随宿主只解析六位 hex 和部分 rgb，导致等价的 `#f00`、HSL、OKLCH 被误读为默认蓝。发现及用户授权的修复安排已[回复 #103](https://github.com/flowduet/flowduet/issues/103#issuecomment-6600452845)。此前 965 条通过属于原实施时的结果，不能覆盖本节之后的测试状态。

修复保留已有六位 hex／rgb 路径，补短 hex，并用离屏 Canvas 将其他浏览器合法颜色规范化为 sRGB。透明角色在对应表面合成，`currentColor` 读取宿主实际文字色；非法色或无法使用浏览器解析时保留原有默认回退。Canvas 不挂载到文档，没有新增监听、依赖、公开 API 或宿主变量写入。

- 公开 `DingtalkDesigner` 的短 hex 回归先失败：期望 `#FF0000`，实际 `#409EFF`；修复后通过。见[失败日志](evidence/103-property-drawer/color-unit-red.txt)、[通过日志](evidence/103-property-drawer/color-unit-green.txt)。完整 `appearance.test.ts` 的 16 条随后全部通过。
- [Chromium 12 组结果](evidence/103-property-drawer/host-colors.json)均通过：六位／短 hex、八位 opaque hex、命名色、百分比 RGB、HSL、OKLCH、P3、两类透明色、`currentColor` 与非法值。每组同时读取 HSL 中性色，并确认同一输入节点、草稿、焦点、模型 change=0、无 EP 回写或遗留解析节点。
- [浏览器回归脚本](evidence/103-property-drawer/host-colors.mjs.txt)沿用原验收驱动与公开场景。复测先将 `.mjs.txt` 复制为临时 `.mjs`，依次传入 playwright-core 入口、Playground URL、输出目录；必要时通过 `FLOWDUET_CHROMIUM_PATH` 指定浏览器。未以 happy-dom 的颜色支持替代真实浏览器证据。
- 双轴独立复审审查完整 `cd39258` 基线补丁及含新增文件的快照，SHA-256 为 `fe3e30da90a83f93167e02b3b5745882d666ac6c09470af63ae82a4900a73b8f`：Standards 重要 0／细节 0／既有 0；Spec 重要 0／细节 0／既有 0，原 P2 已关闭。角色映射重复的 smell 保持“不值得改”，没有为此扩大补丁。快照后仅追加结果说明、接入文案及 changeset，产品和回归代码保持相同。

## form-create 测试失败诊断

本轮标准 `pnpm test` 的[完整错误摘要](evidence/103-property-drawer/form-create-default-timeouts.txt)已完成：core 148、designer 200 条通过；form-create 为 309 条通过、3 条失败，均为 `Test timed out in 5000ms`，没有业务断言失败或未处理异常。递归任务据此退出，未继续执行 Playground，不能宣称默认全量门槛通过。

三条超时分别为 `retained-inputs.test.ts` 的未完成日期原文、删除后同名字段复用，以及 `retained-manager.test.ts` 的旧页头关闭按钮迟到点击；耗时为 6150、5459、8325ms。与上一轮被中止的 7 条失败用例不完全相同，不能把上一轮未取得的错误堆栈补写为已验证事实。

[诊断汇总](evidence/103-property-drawer/test-diagnosis.json)与对照结果：

| 对照                                               | 结果                                                                                                   | 能支持的结论                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 颜色修复前，分支单独运行 `retained-inputs.test.ts` | 40 条通过，55.38 秒                                                                                    | 原先 7 项失败不是在该分支上持续复现的业务断言失败                                         |
| 固定基线 `cd39258` 单独运行同文件                  | 40 条通过，55.16 秒                                                                                    | 未观察到 #103 使该文件整体明显变慢                                                        |
| 基线运行相同两组重组件文件                         | [109 条通过，198.45 秒](evidence/103-property-drawer/form-create-baseline-pair.txt)                    | 基线本身也有秒级重组件用例；同一日期用例约 3.3 秒、旧页头关闭约 3.8 秒，距离 5 秒上限较近 |
| 修复分支隔离复测本次 3 个超时用例                  | [3 条断言通过](evidence/103-property-drawer/form-create-isolated-diagnostic.txt)，命令临时设 15 秒时限 | 用于观察完整断言，不作为标准门槛通过；仓库 5 秒时限未改                                   |

已确认失败机制是重组件测试的执行耗时波动越过默认 5 秒上限；没有颜色解析进入这些失败路径或新业务断言回归的证据。form-create 的产品和测试代码相对基线没有改动，既有 `fileParallelism: false` 已使有效 worker 数为 1，因此不能将再次指定单 worker 记为修复。并发、系统调度和 GC 可能放大耗时，但本轮未定位到具体一次停顿；Node worker 采样尝试未产出 profile，不作热点归因依据。不能断言历史失败都来自同一种机器负载。

本轮没有抬高仓库测试时限、删减测试、改业务代码或关闭该失败信号。默认全量门槛仍未通过；后续应单独优化并验证这些重组件测试的稳定性，不能仅凭隔离复测通过就推送或宣称 CI 已绿。

## 本轮最终工程结果与交付边界

- `pnpm lint`：通过；`pnpm build`：四包通过，保留原有 Playground 大 chunk 提示。
- `pnpm test`：core 148、designer 200 条通过，form-create 309 条通过／3 条默认 5 秒超时，命令失败；随后单独运行 `pnpm --filter @flowduet/playground test`，306 条全部通过。没有把不同命令的结果拼成一次标准全量通过。
- 颜色修复及回归代码与独立复审快照的哈希逐文件一致；之后只补充文档、changeset 和诊断证据。已有 designer minor changeset 覆盖本次修复，无新增依赖或公开入口。
- 未重跑本次修复后的完整三包 tarball 浏览器矩阵、Node 22、Firefox、WebKit 或真实操作系统输入法；原有限制继续有效。不推送、不关票、不开 PR、不合并、不发布。
- 修复不涉及数据迁移，可通过撤回本次修复提交恢复到 `e43f64f`；未执行回退实测。form-create 默认门槛未过的事实另行保留，不以回退颜色补丁冒充测试稳定性修复。

## 2026-11-04 第二轮复审与集中收口

对 `cd39258` → `79bbea9` 的复审确认两项重要缺陷与两项细节问题（已[回复 #103](https://github.com/flowduet/flowduet/issues/103#issuecomment-6620383681) 并获批按选项 A 集中收口）：

1. **声明式宿主同周期换肤采样时机（Spec 重要）**：`DingtalkDesigner` 将 `appearance` 监听调整为 `{ immediate: true, flush: "post" }` 并加上卸载守卫，确保父模板同一响应式周期切换主题类／样式后才采样宿主计算样式，保留首次非法告警与“非法回退不重新采样”行为。
2. **`--fd-focus` 跨明度回退（Standards 重要）**：`hostVariables` 对齐 R2 `derive-palette.mjs:189-191` 补回 `?? primaryInk`，消除非空断言 `!`，避免深底画布＋浅色抽屉等跨明度宿主下省略 `--fd-focus` 导致 `:focus-visible` 焦点轮廓失效。
3. **抽屉样式选择器权重与接入顺序（Spec 细节）**：`NodeDrawer.vue` 与 `NodePropertyFields.vue` 覆盖 EP 抽屉、表单项、输入框与按钮的选择器复合 `.flowduet-node-drawer`，使权重提升至 `(0, 3, 0)`，既高于宿主 `html.dark .el-button` `(0, 2, 1)`，也不依赖宿主引入 `@flowduet/designer/style.css` 与 `element-plus/dist/index.css` 的先后顺序；同时将 `packages/designer/README.md` 示例统一为先引 EP 样式。
4. **颜色快路径分隔符与文档口径（Spec 细节）**：`cssColorToRgb` 拆分为严格的逗号语法与现代空格 `/` 语法，拒绝 `rgb(255, 0 0)` 等混用分隔符输入；`README.md` 明确收窄不支持依赖宿主 `color-scheme` 的 `light-dark()` 与系统色关键字（离屏画布拒绝前者回退默认值，后者按固定浅色方案求值），非法颜色回退默认值。

验证证据：

- 公开组件单测 TDD 先红后绿（`packages/designer/src/appearance.test.ts` 共 18 条通过，designer 包共 202 条通过）：覆盖声明式宿主同一响应式周期切换深浅色、跨明度宿主 `--fd-focus` 回退、空格 `rgb()` 与非法混用分隔符回退。
- Headless Chromium 端到端新增验证（[结果](evidence/103-property-drawer/round2-fixes.json)、[脚本副本](evidence/103-property-drawer/round2-fixes.mjs.txt)）全部 `failures: []`：声明式局部深色宿主往返切换（选中卡文字对比度 `10.47:1`，保留草稿与焦点，`change 0`）、跨明度宿主真实键盘 `Tab` 触发 `:focus-visible` `2px solid` 轮廓（对比度 `12.58:1`）、`html.dark` 宿主下品牌浅色抽屉禁用按钮文字保持 `#8B92A4`（`rgb(139, 146, 164)`）、将完整 `element-plus/dist/index.css` 追加到 `<head>` 末尾仍保持标签行高 `20.8px` 与错误上内边距 `4px`。
- 既有浏览器套件与包消费回归重跑全绿：[host-colors.json](evidence/103-property-drawer/host-colors.json)（12 组）、[matrix.json](evidence/103-property-drawer/matrix.json)（8 组）、[behavior.json](evidence/103-property-drawer/behavior.json)、临时隔离目录 core＋designer tarball 安装与严格 TS 校验（[consumer-output.json](evidence/103-property-drawer/consumer-output.json)、[npm-ls.txt](evidence/103-property-drawer/npm-ls.txt)）。
- 标准工程门禁全绿：`pnpm lint` 通过，`pnpm build` 四包通过；空闲环境下标准 `pnpm test` 一次全过（61 个测试文件／968 条测试：core 148、designer 202、form-create 312、Playground 306，未修改 5 秒超时配置；此前并发负载下 `form-create` 重组件测试靠近 5 秒上限的波动事实仍保留备查）。
- 双轴独立复审（代码与新增证据快照 SHA-256 `9ad5f196e998da21f0ae3854ecc1149fd2dcb2265ce0b7e1d5d4969b555840a1`）：Standards 重要 0／细节 1／既有 1（细节为提醒提交时显式纳入两份新增证据文件，已纳入）；Spec 重要 0／细节 1／既有 1（细节为区分 `light-dark()` 与系统色关键字在离屏画布中的求值行为文案，已修正；既有为 `form-create` 高负载耗时波动）。快照后产品与测试源码零改动，两轴均无未关闭缺陷。
