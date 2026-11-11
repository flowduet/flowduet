# #106 FormPreview 下拉单选与所属弹层外观适配：验证记录

日期：2026-11-05。范围：公开 `FormPreview` 的当前下拉单选、真实选项面板及既有字段回归；不新增分组、多选、远程选项或日期面板，不代表 #107／#108 或父规格 #102 已完成。

## 实现与接口边界

- 沿用 #104 的可选 `appearance`、共享 designer 外观合同和 form-create 本地 `ConfigProvider`；本票没有新增或修改公开 API，也没有改动 core／designer 产品代码、依赖或 peer 范围。
- 经 `parseFormRules` 后的临时规则树递归处理顶层及栅格列内 `select`，用模块级递增序号生成跨 Vue app 不重复的实例标识，经稳定响应式类对象仅在启用时追加到 `popperClass`，并与业务字符串／数组类名合并。原 `form.rules`／`options` 字符串不变，缺省 `teleported`／`appendTo` 交给 EP 原路径，显式值不覆盖。
- 规则树身份只随表单定义换代。弹层变量由唯一面板选择器的实例 `<style>` 承载，避免换肤重新生成规则而重建输入；业务 inline `popperStyle` 自然优先。无下拉、未启用、停用及卸载时不保留该新增样式资源，面板本身仍由 EP 关闭／卸载生命周期清理。
- 品牌选择框分别映射 caret、禁用、清除与 2px／3px 焦点；面板分别映射表面、悬停、`primaryInk`／`primarySoft` 选中配对和禁用角色。舒适／紧凑的选择框与普通选项行高为 32／24px，选项字号为 14／12px；长中文使用正常空白、任意断行和自然高度，不机械固定单行。
- 跟随宿主时根、面板 inline 与实例样式均不写 `--el-*`，EP 控件原值只记录，不计作品牌目标通过。显式 `popperStyle` 造成的调色属于配置影响，不与品牌预设断言混算。

## TDD 与公开组件回归

测试接缝为公开 `FormPreview` props、真实 FormCreate DOM、鼠标／键盘事件与可见试填值；happy-dom 不承担真实计算样式、定位或空必填校验结论。

- 首个[红色结果](evidence/106-form-preview-select/tdd-red.json)实际观察到实例标识缺失，以及选中背景透明、选项 34px、caret／禁用／焦点仍消费宿主值等反例；补最小规则派生与局部样式后转绿。
- 实施中另用公开行为捕捉并修正两处生命周期问题：改变 `appendTo` 会关闭打开中的面板；重新生成规则数组会替换输入 DOM。最终规则只随定义换代，实例样式独立更新。
- [公开组件回归](../../../../packages/form-create/src/select-appearance.test.ts)共 9 条：实例类与变量、真实选择／禁用／清除／必填标记／成功反馈、显式 `appendTo` 与数组类名、`teleported=false`、打开／关闭换肤与启停、同 app 与跨 app 双实例、卸载重挂、旧路径、空选项与栅格列内下拉。
- 定向命令 `pnpm --filter @flowduet/form-create exec vitest run src/select-appearance.test.ts src/appearance.test.ts src/control-appearance.test.ts`：3 文件／27 条通过，其中 #104 12 条、#105 6 条保持绿色。
- happy-dom 的既有空必填限制沿用 `components.test.ts` 注释；本票的清空→未通过→补选→通过在 Chromium 实测，不以模拟环境断言代替。

## Chromium 八组外观矩阵

最终矩阵同时在源码构建的 Playground 和下述实际 tarball 场景执行。结果均为 HeadlessChrome 156.0.8078.4、Vue 3.5.43、单份 Element Plus 2.14.6、FormCreate renderer 3.3.4；视口 1440×2200、deviceScaleFactor 1，`errors=[]`、`resourceErrors=[]`、`failures=[]`。

| 配色来源 | 主题 | 舒适                                                                 | 紧凑                                                             |
| -------- | ---- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 跟随宿主 | 浅色 | [截图](evidence/106-form-preview-select/host-light-comfortable.png)  | [截图](evidence/106-form-preview-select/host-light-compact.png)  |
| 跟随宿主 | 深色 | [截图](evidence/106-form-preview-select/host-dark-comfortable.png)   | [截图](evidence/106-form-preview-select/host-dark-compact.png)   |
| 品牌预设 | 浅色 | [截图](evidence/106-form-preview-select/brand-light-comfortable.png) | [截图](evidence/106-form-preview-select/brand-light-compact.png) |
| 品牌预设 | 深色 | [截图](evidence/106-form-preview-select/brand-dark-comfortable.png)  | [截图](evidence/106-form-preview-select/brand-dark-compact.png)  |

[计算结果](evidence/106-form-preview-select/matrix.json)、[复测脚本](evidence/106-form-preview-select/matrix.mjs.txt)及[安装包矩阵](evidence/106-form-preview-select/consumer-scene/matrix.json)逐组记录选择框、caret、焦点、面板表面对齐与层级、选中／键盘高亮／长选项／禁用、占位、空选项和试填值。行高使用 0.1px 内容局亚像素容差，未放宽颜色或焦点断言。八组源码截图与最终安装包截图均已目检，未见混合主题、文本越界或选项重叠；显式配置区原有低对比仍按 #105 配置影响登记。

## 真实行为、显式配置与隔离

[行为结果](evidence/106-form-preview-select/behavior.json)与[操作脚本](evidence/106-form-preview-select/behavior.mjs.txt)的 `errors=[]`、`resourceErrors=[]`、`unhandled=[]`、`failures=[]`：

- 旧路径不追加实例标识、不创建实例样式，保持 EP 34px 选项和宿主选中色；真实鼠标选择、清除、占位恢复及必填失败到成功均通过。
- 真实键盘 ArrowDown 打开、方向键移动高亮、Enter 选择、Escape 关闭，选择与焦点恢复正确；禁用选项的指针操作被阻止，空选项和禁用选择框保持。
- 打开与关闭状态下切换来源、浅深、密度和启停，均保留同一输入 DOM、当前选择、焦点和有效成功反馈；实例样式随启停增删。同 ID 定义重开仍恢复下拉默认值并清除反馈。
- 同 app 双实例面板内容、层级和归属独立，[双实例截图](evidence/106-form-preview-select/dual-instances.png)已目检。EP 自然鼠标／焦点操作会关闭前一个下拉，因此“同时展开”使用不冒泡的公开 ArrowDown 事件构造，且不移动焦点；这只证明并存时的隔离与层级，不冒充自然鼠标顺序。真实键盘和焦点合同由独立场景验收。
- 显式外部 `appendTo`、数组 `popperClass`、`popperStyle` 和 `large` 尺寸均优先；显式面板选中色 `rgb(18,52,86)`／背景 `rgb(230,232,240)` 是配置覆盖，不计作品牌色板通过。显式目标位于应用外静态宿主节点，避免同次 Vue 挂载期间目标尚未进入 document 的 Teleport 空目标错误。
- `teleported=false` 留在所属选择框；卸载任一侧会清理其外部／原位面板及实例样式，重挂获得新标识，另一侧不变。无关宿主 `ElSelect` 的选中色、背景、归属和选择在实例重建及换肤前后完全一致。
- 八组均在 180px 容器＋CSS zoom 200%＋900×700 视口下验证长中文换行、页面无横向溢出、面板可达；容器滚动后同 placement 保持位移一致，紧凑档发生上→下翻转时仍位于视口并与触发器对齐。[浅色舒适](evidence/106-form-preview-select/brand-light-comfortable-zoom-200.png)与[深色紧凑](evidence/106-form-preview-select/brand-dark-compact-zoom-200.png)已目检。

前序切片也在本票场景实际重跑：#104 [文本行为](evidence/106-form-preview-select/regression-104/behavior.json)、#105 [控件行为](evidence/106-form-preview-select/regression-105/behavior.json)与[八组矩阵](evidence/106-form-preview-select/regression-105/matrix.json)均 `failures=[]`。这些源码场景运行保留既有 favicon 404 日志；独立 tarball 页使用 data favicon，浏览器错误为空。

## 实际 tarball 消费

三包构建并打包至 `/private/tmp/flowduet-106-pack.IC3WpB`，在全新目录 `/private/tmp/flowduet-106-consumer.e0m7Qw` 从零安装；消费工程与执行脚本分离，无源码 alias 或内部测试 API。

- [依赖树](evidence/106-form-preview-select/npm-ls.txt)：core 0.3.0、designer 0.1.0、form-create 0.1.0；EP 2.14.6 单份 deduped，renderer 3.3.4，Vue 3.5.43，TypeScript 5.9.3，Vite 8.3.0。
- [严格 TS 配置](evidence/106-form-preview-select/consumer-tsconfig.json)启用 `strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck=false`；[公开消费源码](evidence/106-form-preview-select/consumer-main.ts.txt)含非法外观类型反例。`tsc --noEmit` 退出码 0（[日志](evidence/106-form-preview-select/consumer-tsc.txt)）。
- [Vite 配置](evidence/106-form-preview-select/consumer-vite.config.ts.txt)与[生产构建日志](evidence/106-form-preview-select/consumer-vite-build.txt)覆盖最小公开页和双实例场景页。[静态结果](evidence/106-form-preview-select/consumer-static.json)确认公开 JS、声明、CSS 子路径、peer 不变、无残留 `:deep` 及单份 EP。
- [最小页浏览器结果](evidence/106-form-preview-select/consumer-browser.json)、[截图](evidence/106-form-preview-select/consumer.png)与[复测脚本](evidence/106-form-preview-select/consumer.mjs.txt)通过公开下拉选择、清除、校验、焦点与试填。
- 最终 tarball 场景的[八组矩阵](evidence/106-form-preview-select/consumer-scene/matrix.json)与[完整行为](evidence/106-form-preview-select/consumer-scene/behavior.json)均为零失败；该结果不替代 #108 的双入口完整发布验收。

## 工程检查

- `pnpm lint`：ESLint 首轮通过；Prettier 首轮发现 11 份新 JSON 证据需格式化，仅重排空白后复测。
- `pnpm test`：默认全量 **64 文件／995 条全部通过**（core 148、designer 202、form-create 339、Playground 306）；未提高超时或跳过用例。
- `pnpm build`：core、designer、form-create、Playground 全过；保留 Playground 既有大 chunk 提示。
- changeset：`.changeset/form-preview-select-appearance.md`，仅 `@flowduet/form-create` minor；无依赖、peer 或锁文件变化。
- 独立 Standards／Spec 初轮审查：Standards 重要 2／细节 0／既有 0（旧路径仍追加标识、跨 app 标识冲突）；Spec 重要 0／细节 1／既有 0（误改 #105 显式多选回归口径）。三项均集中修正并建立红色回归。第二轮完整补丁复审 SHA-256 为 `69c838fd65f3102b9c5b8896ab4b108400388fc785191ef27c8a8e0eada0f1cf`，Standards 与 Spec 均重要 0／细节 0／既有 0，初轮发现全部关闭，无新增发现。

## 限制与未测项

- 本票未执行真实 macOS 中文输入法；#104 的合成组合输入回归通过不能冒充 OS IME 验收。
- 缩放证据为 CSS zoom 200%，不是浏览器／操作系统完整缩放矩阵。
- Firefox、Safari／WebKit、移动端与完整可访问性认证未验证；Chromium 通过不推断其他环境兼容。
- 未执行本地 Node 22 矩阵或远端 CI；Node 22／24 双矩阵与维护者审阅留待后续 PR。
- 未推送、未开 PR、未合并、未发布 npm；Issue 保持开放。

## 2026-11-06：补充审查后的集中修正

本轮以 `develop@db00ef3b` 对 `4c27baf7` 独立双轴审查，另发现 Standards 重要 1／Spec 重要 1，已在 [Issue 评论](https://github.com/flowduet/flowduet/issues/106#issuecomment-6674178915) 登记。此前零发现记录属于当时审查结果，不覆盖这两个新反例。

- 全局类名：新增公开 `FormPreview` 回归实际观察 `options.global` 的 `*`／`default`／`select` 三条路径先失败，随后转绿；渲染派生遵守全局默认→组件默认→字段配置，保留字段级 `null`、空数组及显式数组的覆盖含义，启停适配不重建输入、不回写原始定义。新增 6 条组件回归。
- 局部宿主主题：新增 Chromium [复测脚本](evidence/106-form-preview-select/review-regression.mjs.txt) 先捕捉默认 body 面板丢失局部主色、中性色及箭头背景的[红色结果](evidence/106-form-preview-select/review-2026-11-06/scoped-host-red.json)，修复后两档密度均使用宿主主色 `rgb(0,104,94)`、表面 `rgb(248,250,249)`，且禁用、边框、箭头与焦点正确。happy-dom 不能可靠继承宿主 CSS 自定义属性，本项不以其计算样式代替 Chromium。
- 宿主适配集中在内部 `select-popper-style.ts`，限定 EP 2.14.6 当前下拉面板实际使用的可见 CSS 属性，不复制 EP 变量，不调整 Teleport 或新增监听。显式 inline EP 变量仍由浏览器解析并优先，选中与普通文字分别实测为 `rgb(18,52,86)`／`rgb(52,66,80)`，业务 `popperStyle` 不变。
- 原矩阵以字符串包含 `--el-` 判断“写入”，将新选择器与变量引用误判为声明；改为逐条检查所属实例样式的 CSSOM 声明属性名。红色记录保留当时的误判项；颜色、几何、焦点与定位断言没有放宽。最终[八组矩阵](evidence/106-form-preview-select/review-2026-11-06/matrix.json)、[原行为场景](evidence/106-form-preview-select/review-2026-11-06/behavior.json)与[局部宿主／显式配置回归](evidence/106-form-preview-select/review-2026-11-06/scoped-host.json)均零失败。
- 实际重新打包 form-create，并在原临时 tarball 消费工程安装替换，未改第三方包或依赖范围；严格 `tsc --noEmit`、Vite 生产构建及[局部宿主／配置回归](evidence/106-form-preview-select/review-2026-11-06/consumer-scoped-host.json)通过。core／designer tarball 不变；仍为单份 EP 2.14.6、renderer 3.3.4、Vue 3.5.43。本项是本轮改动的消费回归，不冒充重新完成父规格或 #108 的全入口发布验收。
- 工程检查：`pnpm lint`、`pnpm build`，以及最后的 form-create／Playground 构建通过；默认全量 `pnpm test` 为 64 文件／1001 条通过（148＋202＋345＋306），未提高超时或跳过用例。[工程与 tarball 记录](evidence/106-form-preview-select/review-2026-11-06/engineering.json)。

未新增依赖，沿用本票 changeset。修复尚未提交、推送或开 PR；独立复审结论另附，其他浏览器、真实 OS 输入法和 Node 22／24 CI 等未测范围沿用上节。

### 品牌显式 EP 变量补修与第三轮复审对象

上述首批修复后独立复审：Standards 重要 0／细节 0／既有 0，原全局类名问题关闭；Spec 确认局部宿主问题关闭，但新增一项品牌状态覆盖历史 EP 变量的 P2，详见[补充评论](https://github.com/flowduet/flowduet/issues/106#issuecomment-6674645973)。

- 在现有显式原位下拉样例中只配置 EP 选中／悬停／禁用变量，不配置 FD token，新增 Chromium [红色记录](evidence/106-form-preview-select/review-2026-11-06/brand-ep-red.json) 在浅深品牌主题均实际失败；此前同时配置 EP／FD 的外部挂载样例保留，避免丢掉其回归。
- 将有限属性映射中的显式覆盖规则统一为 `explicitSelectPopperCss`，品牌和宿主两条路径共同消费，不再用品牌状态 CSS 盖过原 inline EP 变量；不新增公开 API、不改依赖与挂载。修复后[品牌回归](evidence/106-form-preview-select/review-2026-11-06/brand-ep.json)浅深主题均为选中 `rgb(18,52,86)`、悬停 `rgb(224,232,240)`、禁用 `rgb(113,130,147)`，没有 FD 配置且零失败。
- 另补 1 条公开组件回归，当前下拉文件 16 条通过；本轮共新增 7 条组件回归。`pnpm build` 已重新通过，最终全量检查与第三轮独立审查结果另附。第三轮若仍有重要发现，按项目约定暂停循环，不将待修复问题标记通过。

### 第三轮最终结论与当前停止点

审查快照 SHA-256：`a419e69379aff00658f98faca00ea7777baaa4b6b3da633406bd1e46d8f54079`。Standards 重要 0／细节 0／既有 0；Spec 重要 1／细节 0／既有 0。前三项具体发现（全局类名、局部宿主主题、品牌 EP 颜色）均已关闭，但显式样式优先这一类别尚有字号遗漏。

- 未关闭 P2：显式 `popperStyle: {"--el-font-size-base":"28px"}` 的旧路径选项显示 28px，host／brand 紧凑路径均变为 12px；inline 仍保留 28px，效果却被密度 CSS 覆盖。父规格 §6 不允许静默忽略显式样式。独立 Spec 审查与主代理均在 Chromium 156 复现。[可复测反例](evidence/106-form-preview-select/font-size-counterexample.mjs.txt)只拦截公开样例 JS 响应增加这一业务配置，不改产品代码或 DOM；[实际结果](evidence/106-form-preview-select/review-2026-11-06/font-size-open.json)包含两条失败，退出码 1，不计作通过。
- 最终适用检查：lint、build、默认全量 64 文件／1002 条测试通过（148＋202＋346＋306），没有调高超时或跳过用例；[最终八组矩阵](evidence/106-form-preview-select/review-2026-11-06/matrix-final.json)、[原行为场景](evidence/106-form-preview-select/review-2026-11-06/behavior-final.json)、最新 tarball 的严格 TS／构建及[局部宿主与品牌 EP 颜色回归](evidence/106-form-preview-select/review-2026-11-06/consumer-final.json)均通过。绿色检查没有覆盖并否定字号反例。
- [最终审查与工程摘要](evidence/106-form-preview-select/review-2026-11-06/final-review.json)、[冻结对象清单](evidence/106-form-preview-select/review-2026-11-06/final-review-manifest.json)。产品代码与复审快照哈希一致；此后仅补充结果、反例及归档文档。未新增依赖，修复仍未提交／推送，未开 PR、未合并或发布。

已达到本轮第三轮且仍有重要发现，按 `docs/agents/code-review.md` 暂停产品修正。下一步由用户选择：A，追加一次限定于当前下拉显式样式与密度交互的集中修正、验证和一轮独立复审，仍有重要发现就停止；B，保留当前三项修复和证据，字号 P2 继续开放，暂不合入。收到 A 的明确批准后由本聊天继续；没有建立后续自动检查任务。

## 用户选择 A 后的限定追加修正（2026-11-06）

用户在本聊天明确回复“A”，授权一次集中修正、验证及一轮独立双轴复审；范围仅当前下拉显式样式与密度交互，复审仍有重要发现即停止。历史投入与前述停止事实保留，不据此授权依赖、架构、字段能力、公共 API、推送或 PR。

已沿用公开 FormPreview／Chromium 接缝。新增四条宿主／品牌×两密度组件回归，实际捕捉选项 `--el-font-size-base:28px`、空面板 `--el-select-font-size:26px` 被 12／14px 覆盖的失败。修复将这两项作为仅显式配置时生效的覆盖规则，不从宿主基准字号覆盖密度缺省值。同类选项高度与换行交互正在用真实浏览器核对，最终结论另附。

### A 批集中修正与复审前证据

- 字号：`EXPLICIT_SELECT_DENSITY_PROPERTIES` 仅在业务 inline 变量存在时恢复选项基准字号及空面板字号，不修改宿主默认映射；未配置字号的八组矩阵仍按 14／12px 验证。
- 同类几何：Chromium 实际观察显式 20px 选项被密度抬为 24／32px，以及 `nowrap` 被子 span 改成 normal；[红色结果](evidence/106-form-preview-select/review-2026-11-06-a/style-density-red.json)保留这两项失败。修复仅在选项明确设置 height／max-height 时解除新增最小高度，子文本继承选项换行／断行规则，原生 inline min-height 仍优先。
- 新增真实样例同时覆盖对象 style（20px 高度、18px 字号、nowrap）、字符串 style（16px 最大高度／字号）、面板 28px 选项字号和 26px 空面板字号。旧路径加两来源×两主题×两密度共 9 组[回归结果](evidence/106-form-preview-select/review-2026-11-06-a/style-density.json)零失败，字号、几何、换行与焦点均符合公开配置；属于配置影响，不算作默认密度目标通过。
- 原有[八组矩阵](evidence/106-form-preview-select/review-2026-11-06-a/matrix.json)与[行为场景](evidence/106-form-preview-select/review-2026-11-06-a/behavior.json)复测零失败。`pnpm build` 通过。最终全量检查、实际 tarball 消费和本批唯一一轮独立复审结论另附。

### A 批最终验证、断电恢复与独立复审

A 批修正已完成，原显式字号 P2 已关闭，同类高度与换行限制一并修复。本批新增 4 条组件回归，当前下拉文件共 20 条；此前三项修复没有回退。

- 最终工程检查：`pnpm lint`、`pnpm build`、默认全量 `pnpm test` 64 文件／1006 条均通过（148＋202＋350＋306），没有提高超时或跳过用例。
- 实际新 tarball 消费的严格 TypeScript、生产构建与[9 组样式／密度回归](evidence/106-form-preview-select/review-2026-11-06-a/consumer-style-density.json)通过；EP 2.14.6 单份、renderer 3.3.4、Vue 3.5.43 不变。原八组默认外观、原行为场景和[原字号反例](evidence/106-form-preview-select/review-2026-11-06-a/font-size-closed.json)均零失败。[工程记录](evidence/106-form-preview-select/review-2026-11-06-a/engineering.json)保留实际结果与 tarball 哈希。
- 用户报告断电后，临时目录及未返回结论的两个复审代理丢失。主代理从持久化文件重建完整补丁，SHA-256 仍精确等于 `f9be1955e3723618bdf09da9afe72237eec12500a3f8343a09bb862ef2c67351`；[96 文件清单](evidence/106-form-preview-select/review-2026-11-06-a/review-manifest.json)全部匹配，因此断电前完成的检查结果继续保留，不冒充断电后全量重跑。[恢复记录](evidence/106-form-preview-select/review-2026-11-06-a/power-recovery.json)另含主代理断电后实际重跑字号反例的通过结果。
- 在同一冻结对象、同一 A 批审查轮内，以两个全新上下文重试中断的复审。Standards 重要 0／细节 0／既有 0，独立重跑下拉组件 20／20 通过；Spec 重要 0／细节 0／既有 0，独立重跑[字号反例](evidence/106-form-preview-select/review-2026-11-06-a/independent-font.json)与[9 组样式／密度场景](evidence/106-form-preview-select/review-2026-11-06-a/independent-style-density.json)均通过。两轴未发现新增需修复问题。[最终结论](evidence/106-form-preview-select/review-2026-11-06-a/review-result.json)。

本批本地修复、验证及复审完成；仍未提交／推送、未开 PR、未合并或发布，不关票。其他浏览器、真实 OS 输入法、Node 22／24 CI、父规格及 #108 全部交付未验范围保持；局部审查通过不代替维护者审批。用户现在无需操作；后续推送、PR 与合并仍遵循各自授权。
