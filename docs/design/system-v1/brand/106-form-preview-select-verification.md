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
