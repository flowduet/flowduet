# 阶段零：前置技术探针计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 执行方式由用户审阅本计划后选择。

**Goal:** 取得主题隔离、编辑连续性、对象身份、校验和宿主协议的真实可行性证据，输出阶段一可以使用的合同与明确阻塞，不实施整套正式工作台。

**Architecture:** 探针复用 Playground 的依赖和真实三包源码，在独立探针分支增加临时入口，不新增长期演示应用。纯状态策略用 Vitest 验证，第三方组件、弹层、焦点和空间用真实浏览器验证；生产结构缺陷通过独立修复票交付，不把探针代码直接发布。

**Tech Stack:** 当前 Vue 3、Vite、Vitest/happy-dom、Element Plus 2.14.6、FormCreate Designer 3.5.0、Vue Flow；本计划不增加依赖。

**Spec:** [主提案](../2026-10-14-design-system-workbench-proposal.md)、[四项补充复核](../reviews/2026-10-14-supplement-review.md)、ADR-0002/0003/0006/0010/0011。本计划已获准执行，[本轮结果](../system-v1/probes/README.md) 已记录通过、失败与未测项，阶段零出口未通过。下方保留原清单，不将未执行子项批量标记完成。

2026-10-15 更新：PR #92已合入develop，本轮[剩余探针复验](2026-10-14-stage-zero-recheck.md)与[最新验收结论](../system-v1/probes/README.md)已形成；原清单保持历史/未执行项边界。

## 全局约束

- 不设日历时间盒；按证据出口复审，成本扩大时重新决策，不自动降级主题、定制或状态合同。
- 所有界面与注释用中文。核心无 UI/FormCreate 依赖，工作台控制候选方案位于 form-create 职责边界内，但本阶段不迁移生产代码。
- 新面板应用显式草稿级；旧抽屉确认、未显式启用草稿的调用与部署导出不得放宽。
- 单独的身份与结构操作修复从最新 develop 的 `fix/<issue>-<摘要>` 分支开始，先确认修复合同；不得在文档分支直接施工。
- 探针执行时先使用原生 worktree 流程建立隔离环境，从最新 develop 建立 `prototype/design-system-stage-zero` 分支；设计文档作为输入，当前文档分支保持独立。若将探针建为正式 issue，按仓库 issue 分支规范改用对应白名单分支。
- 不默认安装 Playwright 或改变 EP peer 声明；如现有工具无法产生所需证据，提出工具/依赖方案后再继续相关项。
- 所有命令从所注明目录执行；证据记录代码 SHA、lockfile 哈希、工具版本、视口与实际容器宽度。负向诊断成功不等于产品测试通过。

## Review Focus

1. 同 ID 重建却已换对象生命期：旧缓冲、选中和异步定位不得串入新对象，归任务 2。
2. 支路首节点或嵌套块变化：不能丢条件、默认引用、顺序和定位身份，归任务 1。
3. 第三方尚未失焦/无法序列化的输入：切表单、切阶段仍保留，归任务 3。
4. 已通过候选状态的等价应用与外部变化：前者保留通过，后者不能误保留，归任务 2、5。
5. 双实例弹层焦点、宿主快捷键及迟到保存：不得污染主题或把新编辑标为已保存，归任务 4、5。

## 文件与产物边界

| 路径（执行分支内）                                                                         | 用途                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `packages/designer/probes/stage-zero/branch-preservation.test.ts`                          | 真实结构操作的回归合同；初始预期为失败                                             |
| `packages/designer/probes/stage-zero/identity-policy.test.ts`                              | 对象生命期与候选校验状态的策略试验，不是公开 API                                   |
| `apps/playground/probes/stage-zero/probe-contracts.ts`                                     | 探针共享的 EntityRef 与 ValidationStamp 类型，无生产导出                           |
| `apps/playground/probes/stage-zero/index.html`、`main.ts`、`ProbeApp.vue`                  | 临时真实组件验证入口                                                               |
| `apps/playground/probes/stage-zero/vite.config.ts`                                         | 复用 Vue 插件，把三包别名明确指向源码，避免混用旧 dist                             |
| `apps/playground/probes/stage-zero/{EditorRetention,ThemeIsolation,HostProtocol}Probe.vue` | 分别负责编辑保留、主题弹层、宿主协议场景                                           |
| `apps/playground/probes/stage-zero/probe-log.ts`                                           | 统一记录 `{ caseId, action, documentEpoch, entity, observed }`，不输出真实业务数据 |
| `docs/design/system-v1/probes/`                                                            | 各探针结论、可运行入口、案例清单、截图和资源观测；由证据形成，不预填通过           |

各 Vue 探针挂载真实组件。必要的候选控制逻辑仅在探针目录内，不新增正式包导出。开发入口从 `apps/playground` 执行 `pnpm exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1`，访问返回端口的 `/probes/stage-zero/index.html`；生产 main.ts 和 App.vue 不替换。

## 任务 1：固定结构操作缺陷的回归合同与修复边界

**Files:** 新建 `packages/designer/probes/stage-zero/branch-preservation.test.ts`；读取 `packages/designer/src/operations.ts`、`packages/core/src/model/bpmn-model.ts`；输出 `docs/design/system-v1/probes/structure-baseline.md`。

**Interfaces:** 消费现有 `convertApprovalToMulti`、`convertMultiToSingle`、`removeApprovalNode`、`removeBranch`、`removeBlock`、`branchHeadFlowId`。输出具名失败用例、最小模型与建议修复接缝，不在此任务增加生产方法。

- [ ] 编写 `preserves_branch_head_on_conversion`：条件与默认两组分别验证单转多、多转单。断言头边 ID 为 `fa`、名称不变、条件表达式或网关 default 引用保留、出边顺序为 `[fa, fb]`，两侧存续边身份稳定。
- [ ] 编写 `preserves_branch_head_when_removing_first_or_nested_block`：删除两节点支路首节点、删除外层支路开头嵌套块且保留 tail。断言 `fa` 改接保留后继而语义/顺序保持；删除会产生空分支的既有拒绝场景仍不改模型。
- [ ] 执行 `pnpm --filter @flowduet/designer exec vitest run probes/stage-zero/branch-preservation.test.ts`。当前基线预期出现明确字段/ID/顺序断言失败；依赖错误或加载失败不算复现。
- [ ] 比较原位修改任务形态与安全重接连线两条修复路径，检查全量表达式、扩展字段、双向引用及 DI 影响。提交可审阅的生产修复接口与原子性合同；不在诊断中顺手改生产代码。
- [ ] 记录前置修复票范围与阻塞关系；正式建票/实现遵守用户授权和仓库规则。修复获准并完成后，把用例移入正式测试位置，验证 parse/compile 语义与相应浏览器路径，再解锁任务 3/5 的端到端结构场景。
- [ ] 提交探针与证据：`test(probe): 固定支路身份与语义保真合同`。保留“当前红色基线”的明确标记；此分支不当作可发布产品分支。

## 任务 2：对象生命期与有效设计状态策略

**Files:** 新建 `packages/designer/probes/stage-zero/identity-policy.test.ts`、`apps/playground/probes/stage-zero/probe-contracts.ts`，输出 `docs/design/system-v1/probes/identity-and-validation.md`。

**Interfaces:** 在 `probe-contracts.ts` 定义并仅向探针代码导出 `EntityRef = { documentEpoch: number; kind: 'node' | 'flow' | 'form'; id: string; lifetime: number }` 与 `ValidationStamp = { documentEpoch: number; effectiveRevision: number; ruleRevision: number }`，任务 3/5 按此复用。生命周期记录来自受控操作及前后元素引用；这两种类型是待验证候选，不是批准的公开 API。

- [ ] 写 `reused_id_is_not_old_entity`、`cascade_invalidates_all_descendants`、`atomic_replace_requires_continuity_notice`：覆盖删节点/删支路/删块、嵌套级联、删除后同步插入复用 ID、同一命令内部删后重建、同 ID 外部对象替换。断言旧缓冲和定位失效，新对象不能继承输入；已明确的逻辑转换仍需验证字段相容性。
- [ ] 加入表单删除再创建复用 ID、文档替换同 ID、级联删除后迟到定位请求、删除失败模型未变四例；失败删除不得误清仍存对象的输入。
- [ ] 写 `exact_apply_preserves_validation_not_persistence`、`changed_candidate_invalidates_validation`：完整候选校验后等价应用保持通过且不清除宿主未保存状态；新内容、真正还原、结构/表单变更和规则版本变化失效。规范化结果不等价、目标生命期变化或无法证明等价时必须重验；无变化应用/还原不失效。
- [ ] 运行 `pnpm --filter @flowduet/designer exec vitest run probes/stage-zero/identity-policy.test.ts`。先证明 ID-only 策略会留下旧缓冲，再完成候选生命周期策略并重跑；报告分别标明真实模型操作与模拟控制状态。
- [ ] 写出操作清理时点、外部模型修改边界与校验 stamp 合同，不通过完整 XML 字符串的偶然相同推导对象身份相同。
- [ ] 提交：`test(probe): 验证对象生命期和候选校验状态`。

## 任务 3：真实编辑器缓冲与入口验证

**Files:** 创建临时入口、`EditorRetentionProbe.vue`、`probe-log.ts`；读取 `NodeDrawer.vue`、`FormManager.vue`、`FormDesigner.vue`、`DingtalkDesigner.vue`；输出 `docs/design/system-v1/probes/editor-retention.md`。

**Interfaces:** 使用现有 `FormDesigner.exportContent()` 和 session 的表单内容接口；候选 `captureDraft(formRef: EntityRef): { rules: string; options: string } | { error: string }` 只负责读编辑器并报告失败，不写 session。无法序列化时保留原编辑器实例及输入，不伪造成功快照。

- [ ] 在同一入口提供“单编辑器导出再恢复”和“按对象保留挂载”两种试验方式，显示 model/session 值与缓冲值的区别，不连接真实存储。
- [ ] 真实输入尚未失焦时切节点、切表单、切阶段，再返回；测试空 collection、非法非空 collection、抄送占位、默认值/选项编辑及结构非法内容。新面板草稿级应用允许业务缺项但拦非法格式；旧抽屉路径仍按原行为拒绝对应普通确定。
- [ ] 两张表单各有未应用修改时保存：必须收集两者；其中一份导出失败时不关闭/丢弃其编辑器，不保存旧内容冒充当前内容。表单删除重建同 ID 时旧内容不得串入。
- [ ] 验证工作台仅有一处默认表单编辑入口，流程页为摘要/跳转；独立 `DingtalkDesigner` 的原有内置选择条仍显示。候选隐藏接缝若需临时原型修改，留在探针分支并清楚标记，不发布为正式 API。
- [ ] 使用 2 张与 10 张表单分别往返切换 20 次，记录挂载实例数、事件监听、DOM 数与可取得的浏览器内存指标；不以任意预设毫秒数伪称性能达标。
- [ ] 运行相关既有组件测试并以真实浏览器复核可达输入、焦点和保留行为。结构转换场景需任务 1 的正式修复证据，否则标记“被已知缺陷阻断”。
- [ ] 提交：`test(probe): 验证多对象编辑连续性和表单入口`。

## 任务 4：主题、弹层及容器边界

**Files:** `ThemeIsolationProbe.vue`，输出 `docs/design/system-v1/probes/theme-and-container.md`。消费任务 3 的真实入口与日志，不改全局 html/body 主题。

- [ ] 同页挂载浅色、深色两个实例，外部放一组宿主 Element Plus 控件作对照；列出当前开放的八类表单字段及其真实可达弹层，逐一记录挂载点与 computed 变量来源。
- [ ] 分别验证浅/深 × 紧凑/舒适四组合，实例主题切换、打开/关闭弹层、卸载/重挂后宿主样式与另一实例不变。检查现有全局 CSS 导入与 app.use 的影响，不把日志无异常当作隔离通过。
- [ ] 以容器 1440、1280、1024、900、768 CSS px 作为探索样本，面板 280、320、400 px 作为候选测量值；记录实际可用区、遮挡/溢出与长中文内容。上述值用于探索，不自动成为支持承诺。
- [ ] 测量候选默认主题文本/非文本对比度，并逐项检查键盘焦点；不支持的第三方操作列为限制。验证深色全覆盖或隔离失败时报告原因及可选方案，不主动采用浅色孤岛。
- [ ] 提交截图、环境与覆盖清单，区分通过、未测和失败；提交：`docs(probe): 记录主题隔离与容器测量证据`。

## 任务 5：宿主协议、并发与定位接缝

**Files:** `HostProtocolProbe.vue`，必要的局部测试 `apps/playground/probes/stage-zero/host-protocol.test.ts`，输出 `docs/design/system-v1/probes/host-and-location.md`。

**Interfaces:** 使用人工控制 resolve/reject 的 `load(): Promise<string>`、`save(documentJson: string): Promise<void>` 探针适配器；每次请求记录文档世代、请求序号和候选版本。它们是验证载体，最终公共签名由证据评审确定。

- [ ] 用失败用例锁定保存中继续编辑、先保存后新建、连续加载反序完成、加载期间新输入、保存失败、宿主拒绝 ID 冲突与离开取消；完成候选控制逻辑后分别验证旧快照不覆盖新编辑、不误标保存成功。
- [ ] 覆盖“校验候选 → 原样应用 → 继续保持校验通过 → 保存仍未成功”的链路；应用引起未预期分支变化时必须失效，不能以按钮动作豁免。
- [ ] 真实浏览器在两个实例及各自弹层内按 Cmd/Ctrl+S，再在宿主控件按快捷键；只有焦点所属实例接管。未提供文件/保存适配器时对应入口隐藏或明确不可用，不出现假成功。
- [ ] 从 BPMN 只读视图点击诊断，回钉钉式定位节点/分支；默认表单问题跳表单阶段。删除、改结构、复用 ID 后触发旧诊断请求，必须重验或拒绝，不能跳错对象。
- [ ] 执行 `pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/host-protocol.test.ts` 并补浏览器结果；已有公开组件和 session 仍可独立消费。
- [ ] 提交：`test(probe): 验证宿主并发与定位合同`。

## 任务 6：证据审阅与阶段出口

**Files:** 新建 `docs/design/system-v1/probes/README.md`，按实际证据更新主提案与接口候选文档。

- [ ] 汇总全部案例为“已证明可行 / 需修复或修订 / 尚无结论”，链接精确代码提交、命令输出和截图；列出仍依赖生产结构修复的场景。
- [ ] 核查独立组件兼容、core 职责、无第二份业务模型、无预授权范围降级，以及真实浏览器与模拟策略证据的区别。
- [ ] 给出最小可用容器、主题/弹层方案、状态保存策略、宿主协议、依赖与资源风险建议。无法得出结论的项说明缺少什么证据及下一步责任，不编造数值或承诺日期。
- [ ] 自审后提交：`docs(design): 汇总阶段零证据与接口决策建议`。不自动推送、开 PR、发布或进入完整页面稿。
- [ ] 用户审阅阶段零结果；关键假设通过后进入阶段一设计基线，失败则由用户决定具体修订/修复与投入边界。

## 依赖与执行方式

任务 1 的诊断和任务 2 可先完成；任务 3–5 共享临时入口，宜由同一执行者连续推进。任务 4 与生产结构修复逻辑独立，可在结构修复仍待审阅时取证。任务 6 必须等所有已执行项给出明确结果，不要求用降级伪造全部通过。

建议在当前会话逐项执行并在末尾独立复核，理由是共享真实浏览器状态与编辑器实例较多，拆给多个并行实现者易产生互相覆盖。也可由用户选择逐任务子代理实现与复核。两种方式均先审阅本计划；没有自动创建后台任务。
