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

## 工程检查

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
