# #107 FormPreview 日期各形态与时间面板外观适配：验证记录

日期：2026-11-06。范围：公开 `FormPreview` 的当前 `date`、`datetime`、`week`、`month`、`year` 单值形态及 `datetime` 真实可达时间子面板；不新增范围、多值、字段能力或公开 API，不代表 #108 或父规格 #102 的完整双入口发布验收已完成。

## 实现与接口边界

- 沿用 #104 的可选 `appearance`、共享 designer 外观合同和 form-create 本地 `ConfigProvider`；未修改 core／designer 产品代码、依赖、peer 或第三方包。
- 经 `parseFormRules` 后的临时规则树递归处理 `datePicker`，按 FormCreate 的全局 `*`／`default`→`datePicker`→字段顺序合并业务 `popperClass`，再追加跨 Vue app 不重复的实例标识。原 `rules`／`options` 字符串不变，显式 `popperStyle`／`teleported`／`appendTo` 不覆盖。
- 规则树身份只随定义换代。日期与时间子面板同属一个 `.el-picker__popper`，外层实例类覆盖二者，不增加 MutationObserver 或第二套归属机制。样式由每实例 `<style>` 承载，未启用、无日期、停用及卸载时清理新增资源。
- 输入由 EP size 提供 32／24px；日期单元、月／年单元和时间列表分别保留 EP 的 24px 内容、36px 内容及 32px 行高等内部几何，不机械套成统一控件高度。
- 品牌预设成套映射选中前景／背景、周选中行、非当前值、时间列表、焦点与操作；EP 2.14.6 编译固定白色的选中文字在品牌下使用 `onPrimary`，不全局改写白色。跟随宿主保留该白色原值并单列例外。

## TDD 与公开组件回归

测试接缝为公开 `FormPreview` props、真实 FormCreate DOM、鼠标／键盘事件与可见试填值；happy-dom 不承担真实定位、过渡或完整视觉结论。

- 首轮红色结果实际观察到五种形态都缺少日期实例标识；最小规则派生后转绿。随后分别用红色回归驱动品牌选中配对、周与时间列表、显式 EP 通用变量和宿主“今天且已选中”状态修复。
- 周夹具曾误用需要额外 Dayjs 插件的格式，改用 EP 当前支持的 `YYYY-wo`；键盘周选择又经旧路径同操作对照，两条路径均得到 `2026-48th`，未把夹具或预期错误记作产品缺陷。
- EP 原位面板位于所属预览而非输入元素内部；禁用输入可预创建隐藏面板节点。组件断言分别核对其真实所属与不可见状态，不将 DOM 预创建误判为禁用失效。
- [公开组件回归](../../../../packages/form-create/src/date-appearance.test.ts)共 17 条：五形态值／格式／面板、三种全局类名来源、周与时间状态、品牌显式 EP 变量、宿主编译白色、外部挂载、原位面板、清空禁用、旧路径、活动中换肤、定义重开和同 app 双实例清理。
- 定向命令 `pnpm --filter @flowduet/form-create exec vitest run src/date-appearance.test.ts src/select-appearance.test.ts src/appearance.test.ts src/control-appearance.test.ts`：4 文件／55 条通过；#104 12 条、#105 6 条、#106 20 条保持绿色。

## Chromium 八组外观矩阵

源码构建与下述实际 tarball 生产页均执行同一[复测脚本](evidence/107-form-preview-date/matrix.mjs.txt)。环境为 HeadlessChrome 156.0.8078.4、Vue 3.5.43、单份 Element Plus 2.14.6、FormCreate renderer 3.3.4，视口 1440×1800、deviceScaleFactor 1。每组均逐一打开五种形态，datetime 另进入实际时间列表，共 40 个面板；源码与消费端的 `errors=[]`、`resourceErrors=[]`、`failures=[]`。

| 配色来源 | 主题 | 舒适                                                               | 紧凑                                                           |
| -------- | ---- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| 跟随宿主 | 浅色 | [截图](evidence/107-form-preview-date/host-light-comfortable.png)  | [截图](evidence/107-form-preview-date/host-light-compact.png)  |
| 跟随宿主 | 深色 | [截图](evidence/107-form-preview-date/host-dark-comfortable.png)   | [截图](evidence/107-form-preview-date/host-dark-compact.png)   |
| 品牌预设 | 浅色 | [截图](evidence/107-form-preview-date/brand-light-comfortable.png) | [截图](evidence/107-form-preview-date/brand-light-compact.png) |
| 品牌预设 | 深色 | [截图](evidence/107-form-preview-date/brand-dark-comfortable.png)  | [截图](evidence/107-form-preview-date/brand-dark-compact.png)  |

[源码计算结果](evidence/107-form-preview-date/matrix.json)与[消费端结果](evidence/107-form-preview-date/consumer-scene/matrix.json)逐组记录输入高度与身份、面板归属、表面、圆角、日／月／年／周选中状态、非当前值、时间列表行高与选中配对、确认按钮、试填值和 EP 变量零回写。datetime 还记录真实 Tab 顺序，直至时间取消／确认按钮，并验证两种来源均有 2px 可见焦点。品牌圆角实测为 8px；跟随宿主的 EP 编译白色前景单列为例外。八组源码截图已逐张目检，消费端关键截图复核，未见混合主题、选中文字不可读或异常裁切。

## 真实行为、显式配置与隔离

[源码行为结果](evidence/107-form-preview-date/behavior.json)、[消费端行为结果](evidence/107-form-preview-date/consumer-scene/behavior.json)及[操作脚本](evidence/107-form-preview-date/behavior.mjs.txt)均 `errors=[]`、`resourceErrors=[]`、`unhandled=[]`、`failures=[]`：

- 旧路径不追加实例标识或实例样式；真实清空得到 EP 默认 `null`，必填失败到重新选择成功，禁用输入不打开可见面板。
- date、week、month、year 经真实键盘打开、方向键移动、Enter 选择并恢复输入焦点；当前单元格有 2px 可见焦点。week 新旧路径结果一致，显示与值格式不变。
- datetime 聚焦时间输入进入同一所属 Popper 内的真实时间列；换来源、主题、密度和启停均保留时间输入 DOM、焦点和当前值。选择分钟并确认后得到 `2026-11-15 09:31:45`，子面板和外层面板按 EP 合同关闭并恢复焦点。
- 日期输入／面板活动时切换外观保留当前值、输入 DOM 与 EP 当时的实际焦点；同 ID 重开恢复五种默认值并清除反馈。
- [双实例截图](evidence/107-form-preview-date/dual-instances.png)覆盖同 app 的跟随宿主浅色舒适与品牌深色紧凑实例；面板标识、层级、显式外部挂载和 40px large 输入各自独立。原位面板留在所属预览，卸载／重挂清理面板与样式并生成新标识。
- 无关宿主日期的选中前景、背景和无实例归属在实例重建及换肤前后一致。局部宿主深色的 body 弹层实际使用 `#162220` 表面、`#7FCFC7` 主色与 EP 白色选中文字，实例样式无 `--el-*` 声明；[截图](evidence/107-form-preview-date/scoped-host.png)。
- 显式样例同时保留通用 EP 变量与组件专用变量。实测确认 EP 在 `.el-date-picker` 内重新声明组件专用变量；旧路径对被遮蔽变量也不响应，适配器不新增其生效能力。通用 `--el-color-primary`／`--el-text-color-placeholder` 的原有效果保持优先；其余视觉偏差按配置影响记录，不冒充品牌目标通过。

## 滚动、缩放、边缘与裁切

[布局结果](evidence/107-form-preview-date/layout.json)、[消费端布局](evidence/107-form-preview-date/consumer-scene/layout.json)及[复测脚本](evidence/107-form-preview-date/layout.mjs.txt)覆盖八组外观，环境为 900×700 视口、320px 容器、容器滚动及 CSS zoom 200%。日期与时间子面板均在视口内，选中项命中检测通过、层级正常、页面无横向溢出；滚动后保持位移，或在 `top`／`right`／`bottom` 间翻转后仍按对应中心轴对齐。

[浅色舒适缩放截图](evidence/107-form-preview-date/brand-light-comfortable-zoom-200.png)与[深色紧凑缩放截图](evidence/107-form-preview-date/brand-dark-compact-zoom-200.png)已目检。该证据是 CSS zoom，不冒充浏览器／操作系统完整缩放矩阵。

## 实际 tarball 消费

三包构建并打包至 `/private/tmp/flowduet-107-pack.Mb3vC6`，在全新目录 `/private/tmp/flowduet-107-consumer.6Q7vrp` 从零安装；消费工程、驱动脚本和源码仓库分离，无源码 alias 或内部测试 API。

- [依赖树](evidence/107-form-preview-date/npm-ls.txt)：core 0.3.0、designer 0.1.0、form-create 0.1.0；EP 2.14.6 单份、renderer 3.3.4、Vue 3.5.43。
- [严格 TS 配置](evidence/107-form-preview-date/consumer-tsconfig.json)启用 `strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck=false`；[公开消费源码](evidence/107-form-preview-date/consumer-main.ts.txt)含非法密度类型反例。`tsc --noEmit` 退出码 0（[日志](evidence/107-form-preview-date/consumer-tsc.txt)）。
- [Vite 配置](evidence/107-form-preview-date/consumer-vite.config.ts.txt)与[生产构建日志](evidence/107-form-preview-date/consumer-vite-build.txt)无源码 alias。[静态结果](evidence/107-form-preview-date/consumer-static.json)确认公开 JS、声明、CSS 子路径与实际版本。
- 消费页复制当前公开 Playground 场景，并由生产构建的 Vite preview 验收；完整 40 面板矩阵、行为和八组布局均零失败。本项不替代 #108 的双入口完整发布验收。

## 工程检查

- `pnpm lint`：ESLint 与 Prettier 通过；首轮仅发现新模块一处恒真 filter，删除后复测通过。
- `pnpm test`：默认全量 **65 文件／1023 条全部通过**（core 148、designer 202、form-create 367、Playground 306）；未提高超时或跳过用例。
- `pnpm build`：core、designer、form-create、Playground 全过；保留 Playground 既有大 chunk 提示。
- changeset：`.changeset/form-preview-date-appearance.md`，仅 `@flowduet/form-create` minor；无依赖、peer 或锁文件变化。
- 初轮独立 Standards 审查：重要 1／细节 1／既有 0，发现系统时钟依赖与 select/date 同形重复；Spec 审查：重要 1／细节 0／既有 0，发现宿主时间按钮键盘焦点不可见。测试已固定并恢复系统时钟，焦点几何改为两种来源共享，规则派生合并为同一类型化 helper。
- 第二轮完整补丁复审对象 SHA-256：`79cc7f3834efcd279e44a9b872f3d21bec79549993a9bf908292fd4adfcf96fc`，清单 59 个文件与工作树哈希一致。Standards 重要 0／细节 0／既有 0；Spec 重要 0／细节 0／既有 0。初轮时钟依赖、重复遍历和宿主时间按钮焦点三项均已关闭，无新增发现；复审为独立上下文只读核对，未冒充重跑测试。

## 限制与未测项

- 本票未执行真实 macOS 中文输入法；既有合成组合输入回归不能冒充 OS IME 验收。
- Firefox、Safari／WebKit、移动端与完整可访问性认证未验证；Chromium 通过不推断其他环境兼容。
- 未执行本地 Node 22 矩阵或远端 CI；Node 22／24 双矩阵与维护者审阅留待后续 PR。
- 未推送、未开 PR、未合并、未发布 npm；Issue 保持开放。

## 2026-11-06 补充审查与修复

用户另行调用 `code-review #107`，比较 `ff28754...f5763da`；[发现评论](https://github.com/flowduet/flowduet/issues/107#issuecomment-6677883437)记录 Standards 重要 0／细节 0／既有 0，Spec 重要 1／细节 1／既有 0。用户随后授权补充评论、修复、回归与复审；这次投入属于已明确批准的两项修复，不扩展字段或适配范围。

| 发现                           | 原因与修复                                                                                                 | 处置                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| P2，宿主月份／年份悬停主色丢失 | 普通文字选择器的三个 `:not()` 增加权重，压过悬停规则；用 `:where()` 保留匹配范围并降低权重，恢复状态优先级 | 已修复，真实悬停回归通过             |
| P3，宿主日期导航箭头颜色变浅   | 图标变量回退到 secondary；恢复为宿主 `--el-text-color-primary`，未提供时使用已解析主文字色                 | 已修复，公开组件及 Chromium 回归通过 |

漏检层次：原矩阵检查了输入、表面、选中配对与焦点，没有断言月份／年份悬停或导航箭头原色；现将两者纳入独立可复测的[状态脚本](evidence/107-form-preview-date/states.mjs.txt)。脚本从公开 Playground 入口操作真实 FormCreate，使用未启用外观的 EP 原路径作为宿主对照；品牌期望来自批准设计值，局部宿主期望来自独立场景配置，不从适配实现推算期望。

- P2 红色：[修复前结果](evidence/107-form-preview-date/states-before.json)的宿主两主题×两密度×月份／年份共 8 项悬停失败，品牌 8 项通过，无资源／运行异常。降低权重并重建 form-create 产物后，16 项全部通过。
- P3 红色：[公开组件失败日志](evidence/107-form-preview-date/arrow-before.txt)确认次要文字色与 EP 主文字色期望不符；最小修复后[同一测试通过](evidence/107-form-preview-date/arrow-after.txt)。局部宿主 CSS 继承交给 Chromium 验证，happy-dom 不承担该视觉保证。
- 首次修复的生产构建 Chromium 156.0.8078.4 共 18 项通过（最终扩展结果见下文），包含八组外观的月份／年份真实悬停、宿主箭头与选中配对的旧路径对照，以及局部深色宿主的自定义悬停色／主文字色。`errors=[]`、`failures=[]`。
- 本轮不重写前述历史矩阵与审查清单；旧清单固定的是旧快照，不代表本轮修复后补丁。最终检查、实际 tarball 结果与独立复审对象见后续补记。

本轮工程门槛：`pnpm test` 默认全量 65 文件／1024 条全部通过（core 148、designer 202、form-create 368、Playground 306），无提高超时或关闭用例；`pnpm build` 四包通过，保留既有大 chunk 提示。新增一条公开日期箭头组件回归；真实悬停覆盖通过 Chromium 脚本维护，不用 happy-dom 推断 `:hover`。

实际消费复测：重新构建并打包三包至 `/private/tmp/flowduet-107-fix-pack.GYytD9`，在独立空工程 `/private/tmp/flowduet-107-fix-consumer.mhnml3` 使用先前消费工程的依赖锁文件，更新三个本地 tarball 路径及对应 SHA-512 后运行 `npm ci --offline`；不使用源码 alias 或修改第三方包。首次宽泛版本安装因新依赖未缓存退出，不计通过；锁定安装、`tsc --noEmit` 与 Vite 生产构建均通过。实际依赖仍为单份 EP 2.14.6、renderer 3.3.4、Vue 3.5.43。

首次修复的消费端 18 项状态检查亦全部通过（最终扩展结果见下文），`errors=[]`、`failures=[]`；[依赖树](evidence/107-form-preview-date/followup-npm-ls.txt)、[严格类型检查](evidence/107-form-preview-date/followup-consumer-tsc.txt)及[消费构建日志](evidence/107-form-preview-date/followup-consumer-vite-build.txt)已保存。源码与消费端均验证真实悬停和箭头颜色；本轮未重跑历史全部 40 面板、完整布局及行为矩阵，不将原历史结果冒充新执行结果。Firefox／WebKit、移动端、OS IME、Node 22／24 双矩阵 CI 等原有限制保持。

复测入口：将 `states.mjs.txt` 复制到临时 `.mjs`，执行 `node <临时脚本> <playwright/index.mjs绝对路径> <生产页URL> <输出目录>`；浏览器路径可用 `FLOWDUET_CHROMIUM_PATH` 指定。组件回归命令为 `pnpm --filter @flowduet/form-create exec vitest run src/date-appearance.test.ts`。

### 显式配置变体补修

第一次修复后的完整独立复审：Standards 重要 0／细节 0／既有 0；Spec 重要 1／细节 0／既有 0。P3 已关闭；P2 在默认配置下通过，但显式 `popperStyle` 触发的属性选择器额外增加权重，与悬停规则同权重且后置，原 P2 尚未完全关闭。该项属于同一问题的配置变体，继续在用户本次两项修复授权内补齐，没有新增字段或适配目标。首次修复快照 SHA-256 为 `a2291656996864f12631b93941b89d9748ec63e2c64c9501e5f314c79b584b5f`，不作为最终通过对象。

在原显式配置样例中追加月份／年份的 `popperStyle` 文本变量，通过公开表单定义复现；扩展状态脚本覆盖默认／显式配置×八组外观×月份／年份，加局部宿主两项，共 34 项。修复前[显式配置结果](evidence/107-form-preview-date/states-explicit-before.json)有 16 项悬停失败，涵盖两种配色来源；不将组件专用变量被 EP 遮蔽的既有例外当作新增悬停回退的豁免。仅降低显式属性匹配的权重仍会在品牌路径压过 EP 自身的悬停规则，因此最终让普通文字规则明确排除悬停、今天、选中和禁用状态；保持显式变量的原有匹配与优先机制，避免改动其他消费点。选中配对、箭头颜色及局部主题继续纳入对照。

最终生产构建与重新安装 tarball 的消费端，均完成[源码 34 项](evidence/107-form-preview-date/states.json)和[消费端 34 项](evidence/107-form-preview-date/consumer-scene/states.json)回归，`errors=[]`、`failures=[]`。普通态、真实悬停、宿主箭头与选中配对、品牌悬停及局部宿主变量均通过；显式值沿原消费点保留，不为修复而改第三方变量定义或全局主题。通过后未再修改产品实现。

### 最终检查与独立复审结论

最终 `pnpm lint`、`pnpm test`、`pnpm build` 均通过；全量仍为 65 文件／1024 条（无跳过），源码与实际 tarball 消费端各 34 项真实状态检查通过，严格类型与消费生产构建通过。两位新上下文代理分别复审增量及其与完整状态映射的交互：Standards 重要 0／细节 0／既有 0，Spec 重要 0／细节 0／既有 0；P2（含显式配置变体）与 P3 均已修复，无新增待修复项。

[复审记录](evidence/107-form-preview-date/followup-review.json)固定基线 `ff28754`、父提交 `f5763da` 与结论补记前的 71 文件快照：完整补丁 SHA-256 为 `301c21d5e81a830664a9a33d917cd1c1103f9070d4ebd3eecbfbb9e4efe61e3d`，修复增量 SHA-256 为 `8a4260b6cfc8c419edc1f7e9aab853beb49bb8f84c88ef1b0c19e92bacd81c94`；文件哈希逐一匹配。复审后仅追加本结论与复审元数据，产品实现、回归及浏览器脚本不再改变；该快照不包含描述自身结论的新增元数据。

本地修复提交可作为独立回退单元；没有数据迁移或模型格式变化，未执行回退演练。未推送、未开 PR、未关闭工单，未执行发布；后续 Node 22／24 CI 与维护者审阅仍由 PR 流程完成。
