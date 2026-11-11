# #104 FormPreview 文本与多行文本外观适配：验证记录

日期：2026-11-04。范围：公开 `FormPreview` 的文本、多行文本、预览自有表面／反馈／操作区及共享外观合同；不代表父规格 #102 的其余字段、弹层或 #108 完整安装包矩阵已完成。

**当前状态：第 3 轮竞态专项修复、最终 tarball 重验与增量双轴复审均已通过，未关闭的重要／细节发现为 0，本切片具备本地提交条件。下列结果不替代 #108 双入口矩阵，也不代表父规格 #102 的其余字段已完成。**

## 接口与实现边界

- `FormPreview` 新增可选 `appearance`；`@flowduet/form-create` 根重导出 designer 的同一 `ComponentAppearance` 与三类枚举类型。
- `@flowduet/designer` 根开放既有 `createAppearanceVariables`、`readHostAppearance` 与 `HostAppearanceContext`，供 FlowDuet 组件共享 R2 色板与宿主读取，不复制算法、不深引源码、不新增主题包。
- 密度由 form-create 自己解析到的 EP `ConfigProvider` 提供；旧路径省略 size，继续继承外层宿主，自有按钮保持固定 `small`。新路径舒适／紧凑对应 32／24px，textarea 保持自然多行高度。
- 缺省标签位置只在派生渲染选项中补 `top`；显式表单／字段／栅格配置优先，原 `rules` / `options` 字符串不改写。`rendererVersion` 仍只由表单定义对象替换递增，外观切换不重建输入。
- Playground 的“预览外观”是现有唯一演示宿主中的公开双实例场景，不是第二套长期应用。

## TDD 与公开组件回归

测试接缝为公开 `FormPreview` props、真实 FormCreate DOM、用户输入／点击与可见反馈，不新增内部测试 API。

实际红→绿记录：

1. 首个公开品牌紧凑用例在原实现上失败：`form-preview` 不含 `flowduet-appearance--brand`；接通共享解析、变量与密度后通过。
2. 缺省标签用例在原实现上失败：没有 `el-form--label-top`；仅在派生选项补缺省顶置后通过，旧路径仍右置。
3. Provider 兼容对照实际观察到直接传空 size 会破坏外层 `large` 继承，且 EP 2.14.6 声明与严格可选类型不兼容；最终旧路径省略 size、本地校正公开运行时输入类型后，行为与 `vue-tsc` 同时通过。
4. Chromium 八组矩阵在缺 CSS 时实际报告透明表面、18px 字段间距、标签尺寸／行高不符、深色值区仍浅色等失败；补齐限定实例的样式后 `failures=[]`。

[公开组件回归](../../../../packages/form-create/src/appearance.test.ts)共 12 条，覆盖品牌变量、缺省／显式配置、旧路径外层 size 继承、同周期宿主采样、合法采样中接非法配置、品牌→宿主旧变量隔离、定义重开、合成组合、非法回退、运行时启停与双实例资源隔离。真实视觉与校验失败不以 happy-dom 单独证明。

第 3 轮竞态用例先在未修实现上失败：类已为 `host/dark`，`--fd-surface` 却仍是浅色宿主的 `#FAFCFC`，而非深色宿主的 `#162220`；票据修复后 12/12 通过。[红色日志](evidence/104-form-preview-text/race-unit-red.txt)与[绿色日志](evidence/104-form-preview-text/race-unit-green.txt)保留实际结果。

## 初轮审查与追加修正授权

初轮独立审查：Standards 重要 1／细节 0／既有 0；Spec 重要 2／细节 0／既有 0。两轴共同发现品牌→宿主采样旧实例变量，Spec 另发现通用按钮变量覆盖把主“提交”降为次按钮。Chromium 原反例分别为：宿主已是 `#409eff` / `#141414`，自有变量却错留 `#2D3E97` / `#FFFFFF`；品牌深色主按钮为 `#1D2435` / `#E9EDF7` 而非主操作配对。

因 #103 已使用父规格 #102 的两轮集中修正额度，实施暂停并展示取舍。用户于 2026-11-04 明确回复 **A**，授权仅追加一轮修正这两项、补回归与增量双轴复审；若出现新的重要问题或必须改依赖／架构则立即停止，不提交。本记录就是该决定的执行留痕。

修复后，外观 watcher 在实例变量 DOM 更新后再采样，并以 `onCleanup` 取消快速切换中的迟到读取；品牌主按钮单独映射 primary／onPrimary 三态。[反例修复结果](evidence/104-form-preview-text/review-fixes.json)与[复测脚本](evidence/104-form-preview-text/review-fixes.mjs.txt)均为 `failures=[]`，同时保留中文试填和焦点。八组矩阵新增主按钮背景／前景断言，不再只验次按钮。

## Chromium 八组外观矩阵

早期矩阵使用 Playground／Vue 3.5.43；当前 `matrix.json` 与八张截图来自最终 tarball 消费页：HeadlessChrome 156.0.0.0，Vue 3.5.44，单份 Element Plus 2.14.6，FormCreate renderer 3.3.4，Vite 8.3.5（仅消费宿主）；初始视口 1440×1100、deviceScaleFactor 1，无源码 alias。

[完整计算结果](evidence/104-form-preview-text/matrix.json)与[复测脚本](evidence/104-form-preview-text/matrix.mjs.txt)记录每组实际值，`failures=[]`。每组同时保留中文文本／多行试填、同一输入焦点和有效成功反馈；跟随宿主不写 EP 变量，品牌实例只写所属预览的局部变量。

| 配色来源 | 主题 | 舒适                                                               | 紧凑                                                           |
| -------- | ---- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| 跟随宿主 | 浅色 | [截图](evidence/104-form-preview-text/host-light-comfortable.png)  | [截图](evidence/104-form-preview-text/host-light-compact.png)  |
| 跟随宿主 | 深色 | [截图](evidence/104-form-preview-text/host-dark-comfortable.png)   | [截图](evidence/104-form-preview-text/host-dark-compact.png)   |
| 品牌预设 | 浅色 | [截图](evidence/104-form-preview-text/brand-light-comfortable.png) | [截图](evidence/104-form-preview-text/brand-light-compact.png) |
| 品牌预设 | 深色 | [截图](evidence/104-form-preview-text/brand-dark-comfortable.png)  | [截图](evidence/104-form-preview-text/brand-dark-compact.png)  |

实测输入与自有校验按钮为 32／24px，控件文字为 14／12px，字段标签保持 13px，字段间距为 16／12px，面板内边距为 24／16px。品牌主“提交”在浅色使用 `#2D3E97` / `#FFFFFF`，深色使用 `#A5BBFF` / `#171F3E`，不再被次按钮规则覆盖。textarea 仍是 `input + props.type=textarea`，rows=4，高度不被机械压成单行。八张截图均已逐张目检，未见重叠、文字裁切或异常混合主题。

跟随宿主的 EP 输入边框、占位色和主按钮原值属于宿主继承信息，不计为 FlowDuet 自有角色对比度通过。显式配置实例保持右置 96px 标签、表单及字段 large、7px 表单 padding、320px 字段 max-width 与 textarea rows=4；这些配置影响不记作主题偏离。

## 真实行为与异常路径

[行为结果](evidence/104-form-preview-text/behavior.json)与[操作脚本](evidence/104-form-preview-text/behavior.mjs.txt)的 `failures=[]`、`unhandledRejections=[]`：

- 真实 FormCreate 必填从空值失败到补填成功；字段长中文错误和项目自有失败／成功反馈均可见，Promise 拒绝被消费，无未处理异常。[失败截图](evidence/104-form-preview-text/required-failure.png)。
- 来源、浅深、密度与运行时启停保留文本／多行试填、同一输入 DOM、焦点和有效反馈；非法密度整份保留上次有效内联呈现并给出字段级告警。
- 同 ID 新对象重开及另一表单替换仍重置试填和反馈；单纯外观切换不重置。
- 同 app 双实例包含深色宿主下的品牌浅色预览；切换、卸载与重挂第一实例不改变第二实例、无关宿主 EP 控件、html 主题或挂载前已存在的 `window.onbeforeunload`／`document.body.ondrop`。
- 文本、textarea 与自有校验按钮均经真实键盘 Tab 验证 2px 焦点环。
- 长中文错误多行且无横向溢出；1024×900、局部 360px 宽、CSS zoom 200% 下按钮可达、页面无横向溢出。[缩放截图](evidence/104-form-preview-text/long-error-zoom-200.png)。

## 实际 tarball 消费

core、designer、form-create 最终构建后打包至 `/private/tmp/flowduet-104-race-pack.BLIBGF`，并在全新空目录 `/private/tmp/flowduet-104-race-consumer-final.1149NW` 安装。消费工程提供公开组件页与 `scene.html` 双实例验收页；后者只复制 Playground 验收场景源码，三包全部解析为实际 tarball，没有源码 alias 或内部导出。测试宿主使用 `@vitejs/plugin-vue` 编译场景，不新增或升级仓库依赖。

首次环境准备时 `^2.14.6` 解析到 EP 2.14.7，该目录结果已弃用；随后钉死 2.14.6 并重新创建上述全新目录，以下证据均来自最终目录。

- [依赖树](evidence/104-form-preview-text/npm-ls.txt)：`@flowduet/core@0.3.0`、`@flowduet/designer@0.1.0`、`@flowduet/form-create@0.1.0`；EP 2.14.6 单份 deduped，FormCreate renderer 3.3.4，Vue 3.5.44。
- [严格 TS 配置](evidence/104-form-preview-text/consumer-tsconfig.json)、[公开消费源码](evidence/104-form-preview-text/consumer-main.ts.txt)、[矩阵入口](evidence/104-form-preview-text/consumer-scene.ts.txt)与[声明文件](evidence/104-form-preview-text/consumer-env.d.ts.txt)：`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck=false`；实际 `tsc --noEmit` 退出码 0（[日志](evidence/104-form-preview-text/consumer-tsc.txt)），非法枚举与缺少 mode 均由 `@ts-expect-error` 捕获。
- [Vite 配置](evidence/104-form-preview-text/consumer-vite.config.ts.txt)与[生产构建日志](evidence/104-form-preview-text/consumer-vite-build.txt)同时构建两个浏览器消费页。[静态消费结果](evidence/104-form-preview-text/consumer-static.json)确认公开 JS 入口、包根声明与 CSS 子路径存在，CSS 无残留 `:deep`。这里验证的是浏览器目标包，不把 Node 直接导入当作 SSR 合同。
- [浏览器消费结果](evidence/104-form-preview-text/consumer-browser.json)与[截图](evidence/104-form-preview-text/consumer.png)：渲染文本／textarea、品牌深色变量、24px 自有按钮、主按钮 primary／onPrimary 配对、顶置缺省标签、真实试填及校验成功，`errors=[]`、`failures=[]`。[复测脚本](evidence/104-form-preview-text/consumer.mjs.txt)。
- 最终 tarball 上重跑[八组矩阵](evidence/104-form-preview-text/matrix.json)、[完整行为](evidence/104-form-preview-text/behavior.json)与[竞态场景](evidence/104-form-preview-text/review-fixes.json)，三者均为 `failures=[]`；矩阵与行为的 `errors=[]`、`resourceErrors=[]`，行为同时保持 `unhandledRejections=[]`。

本票只做上述文本切片消费验证，不替代 #108 的双入口完整三包浏览器矩阵。

## 工程检查

- `pnpm lint`：ESLint 与 Prettier 通过。
- 标准 `pnpm test`：62 个文件／980 条测试全过；core 148、designer 202、form-create 324、Playground 306。未修改默认 5 秒超时。
- `pnpm build`：core、designer、form-create、Playground 全过；保留 Playground 既有大 chunk 提示。
- changeset：`.changeset/form-preview-text-appearance.md`，designer 与 form-create 均为 minor；无新增／升级依赖、无锁文件变化、无第三方包修改。

## 第 2 轮复审与停止结果

最终完整补丁基线为 `341da2c`，复审快照 SHA-256 `9c60e3a5aba0e6599c4250e400092ac3bef71c36d870fd695810754497d901ed`。

- **Standards：重要 0／细节 0／既有 0**。上一轮宿主采样常规路径与主按钮问题已关闭；公开回归 11/11 通过。
- **Spec：重要 1／细节 0／既有 0**。新发现：合法 host 更新正在等待 `nextTick` 采样时，随后的非法配置会触发上一次 watcher 的 `onCleanup`；非法路径又因 `resolved===previous` 直接返回，导致旧宿主快照永久残留。独立复审在最终 tarball Chromium 实测：宿主已为 `#162220` / `#7FCFC7`，同周期浅→深后接非法 density，稳定后类为 `host/dark`，但 `--fd-surface=#FFFFFF`、`--fd-primary=#409EFF`。这违反 #104 的“非法配置遵循首票整份拒绝与可见告警合同”，因为拒绝非法值后呈现的宿主角色已不再是上次有效内容。
- 上轮主按钮项保持关闭；纯合法连切、启停和卸载未见新增问题，无 scope creep。现有证据没有覆盖上述“合法更新等待中接非法配置”交互。

根据用户对选项 A 的明确停止条件，本轮立即暂停，不再修复该新重要问题，也不提交实施代码。当前分支 `feat/104-form-preview-text-appearance` 保留未提交补丁与证据；没有推送、开 PR、关票或发布。本节的复审结果文档更新发生在上述代码快照之后，不改变产品／测试代码。

## 第 3 轮竞态专项修复与复审

用户于 2026-11-04 再授权一轮，范围仅限第 2 轮发现的宿主采样竞态及其回归，不扩字段、不重构，验收条件不放宽。本轮按已确认的 Q1 采样票据方案实施：组件级 `sampleTicket` 只随合法变化推进，非法输入不推进票据、不取消已排队的合法采样；合法连切由票据比对淘汰旧采样，合法停用同样推进票据，`disposed` 与 `{ immediate: true, flush: "post" }` 保持，移除 `onCleanup` 取消逻辑。FormPreview 的 DOM、`data-test` 与公开 API 未变。

- **组件红绿**：新增公开竞态用例在未修实现上因 `#FAFCFC` 残留而失败，修复及夹具去重后 12/12 通过；见[红色](evidence/104-form-preview-text/race-unit-red.txt)／[绿色](evidence/104-form-preview-text/race-unit-green.txt)日志。
- **Chromium 红绿**：修复前 `host/dark` 下宿主已为 `#162220` / `#7FCFC7`，实例却为 `#FFFFFF` / `#409EFF`，[红色结果](evidence/104-form-preview-text/race-chromium-red.json)记录两项失败。修复后[竞态结果](evidence/104-form-preview-text/review-fixes.json)为 `failures=[]`，深色变量与宿主一致、告警保留、中文试填与第二实例不受影响；最终结果在全新目录 tarball 上复测。
- **相邻变体压测**：独立审查覆盖合法→合法→非法、采样中启停及反向恢复、采样中卸载／重挂、品牌→宿主后接非法、双实例隔离。[五类三轮 Chromium 结果](evidence/104-form-preview-text/race-variants.json)共 15 轮，`failed=[]`、`errors=[]`；[复测脚本](evidence/104-form-preview-text/race-variants.mjs.txt)。Spec 审查另以 6 条组件压测核对只末次合法采样、单独非法配置零补采及卸载迟到写入拦截。
- **增量双轴结论**：Standards 初审重要 0／细节 1（仅测试色值夹具重复），提取共享常量后复核为重要 0／细节 0／既有 0；Spec 初审及细节复核均为重要 0／细节 0／既有 0。没有触发停止条件，产品实现未因细节修复改变。

## 限制与未测项

- 组合输入仅为合成 `CompositionEvent` / `InputEvent`，未执行真实 macOS 中文输入法。
- 缩放证据为 CSS zoom 200%，不是浏览器／操作系统完整缩放矩阵。
- Firefox、Safari／WebKit、移动端与完整可访问性认证未验证；Chromium 通过不推断其他环境兼容。
- Playground 仍有既有 favicon 404 控制台日志；结果保留该事实，不宣称页面资源零错误。独立 tarball 消费页使用 data favicon，浏览器错误为空。
- 未执行 Node 22 本地矩阵或远端 CI；Node 22／24 与维护者审阅留待后续 PR。
