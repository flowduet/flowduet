# 阶段零编辑合同薄切片执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:executing-plans（建议在本会话逐片执行）或经用户选择的 superpowers:subagent-driven-development。按复选框跟踪；**用户已批准本规格、计划、A4及本会话逐片执行；仅执行A/B，不进入正式工作台。**

**Goal:** 优先验证B02的身份、编辑、冲突恢复和实际定位合同，同时解除B05的严格类型阻断；保持正式工作台未实施。

**Architecture:** 编辑状态和身份由form-create方向的候选控制层管理，先留在Playground探针中；流程字段规则和实际选择由designer的最小接缝验证。候选准备与提交分开，所有输入失败先保留，公共导出和正式迁移不在本计划内。

**Tech Stack:** 当前仓库锁定的TypeScript、Vue 3、Vitest、真实BpmnModel/FlowDesignSession、Element Plus与FormCreate；无新依赖。

**Spec:** [阶段零剩余阻断与编辑接口规格](../2026-10-15-stage-zero-editing-contract.md)，尤其§4–8及A01–A15。

## Global Constraints

- 当前批准只整理文档；书面规格、计划和执行方式获审阅确认前，不改产品或探针代码。
- 不构建正式工作台、品牌皮肤、完整导航或业务存储。
- 不新增包，不把控制器留在Playground作为最终交付，不新增公共控制器导出。
- 不改依赖、lockfile、文档编码、部署守卫或PR #92的结构/DI合同。
- 未知替换保留冲突输入；首期不自动合并、强制覆盖或自动重绑同名对象。
- 外置应用显式`allowIncomplete: true`；旧抽屉默认语义不变。
- 单签/会签/或签/依次审批、条件/default、支路顺序、保存重开与错误方向引用拒绝均保持回归。
- A4有明确生产接缝白名单，须单独在审阅结论中批准；否则A3后停止。core生产代码不在白名单。
- B严格类型零错误是A最终验收门槛；C、D、E仍需各自补充方案复审，A通过不能解除其阻断。
- 不设日历时间盒；假设失败或成本扩大先报告，不自动缩减目标。
- 不推送、开PR、合并、发包或对外消息。

## Review Focus

五类容易被正常路径掩盖的输入，必须纳入对应测试，不能只交静态审查：

1. 用户在删除确认/异步定位期间继续输入或主动选中别处：确认过期与旧请求拒绝（A2/A4）。
2. 同ID、同名称、相同整数元组来自另一控制器，旧卸载回调晚于重挂：不得串对象或注销新实例（A1/A4）。
3. 表单外部替换时getJson抛错、输入尚无安全快照：必须保留原实例，不能清缓冲后声称恢复（A2）。
4. fork.default改变或表单被新引用，与目标局部字段无变化：完整读集仍须阻止过期提交（A3）。
5. 编译临时修改DI或提交中段失败：准备与回滚不得改变原对象/数组身份、布局或部分通知（A3）。

## 文件结构与执行起点

使用已有托管工作树和已归档复验分支作为输入，先fetch并固定执行基线。若develop已前进，建立新白名单分支`refactor/stage-zero-editing-contract`，只迁入必要探针和设计输入，记录来源；不要直接把整个历史原型分支合并进产品基线。若名称已占用先核对内容，不重置现有分支。

| 文件/目录                                                    | 责任                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `apps/playground/probes/stage-zero/contracts/types.ts`       | 候选目标、租约、缓冲/冲突及结果类型；不用于生产导出                          |
| `contracts/entity-store.ts`、`entity-store.test.ts`          | 归属、世代、生命期和租约                                                     |
| `contracts/draft-store.ts`、`draft-store.test.ts`            | 原始输入、冲突记录、待处置实例与恢复                                         |
| `contracts/candidate.ts`、`candidate.test.ts`                | 隔离准备、版本及读写集                                                       |
| `contracts/transaction.ts`、`transaction.test.ts`            | 同步提交段与失败原子性                                                       |
| `contracts/controller.ts`、`controller.test.ts`              | 小接口协调，不含路由/持久化副作用                                            |
| `contracts/fixtures.ts`                                      | 复用真实模型与session的测试夹具、可控Promise和故障注入                       |
| `ContractProbe.vue`                                          | 最小外置面板、冲突列表、默认表单配置与真实组件实验，不是工作台               |
| `contract-location.test.ts`                                  | 按真实selectedId及租约验定位                                                 |
| `contracts/validation.test.ts`、`contracts/host.test.ts`     | 候选章与保存快照竞态                                                         |
| `docs/design/system-v1/probes/contract-acceptance.md`        | A/B结果、用例追踪、证据边界                                                  |
| `docs/design/system-v1/probes/evidence/contract-2026-10-15/` | 实际执行时记录环境、基线、命令、截图、状态及哈希；日期变化按实际执行日建目录 |

下述`contracts/*`均相对于`apps/playground/probes/stage-zero/`。A1–A3只改此目录及原探针接入代码、报告；A4才可触碰明确列出的生产文件。原始历史证据不改写。

## Task 1：B — 严格模板类型入口（P0，A最终验收前完成）

**Files:** 读取已有`evidence/recheck-2026-10-15/probe-types.txt`；候选修改仅`HostProtocolProbe.vue`、`ThemeIsolationProbe.vue`及probe `tsconfig.json`中的准确绑定。新增`contracts/type-contract.test-d.ts`验证本地接缝类型，不能降低严格检查。

**Interfaces:** 消费当前真实ElSelect/ElOption组件类型；产出同一真实组件、运行参数与事件语义不变的严格模板入口。类型问题无关业务控件实现，不顺手更改NodeDrawer。

- [x] 先运行下方严格命令并保存原始输出；核对是否仍为13处声明推断错误。预期是该错误基线；数量/根因变化时先更新诊断，不按旧结论盲修。
- [x] 做最小真实Select/Option声明解析复现，记录解析文件、编译器与实际版本；核对生产包和探针为何有差异。若需依赖/公共声明调整，停止本项并提交方案。
- [x] 在探针内实施已证实的最小绑定修订，保留真实组件。类型拒绝用例包含非法modelValue/option类型，必须继续被拒绝，不能通过整体断言为宽泛组件类型来消音。
- [x] 同一严格命令转绿；原生选择器下拉/值变更及主题样本仍用真实EP。最后随A全套验证，不提前声称B已解除。
- [x] 原子提交：`fix(probe): 修正真实选择器的严格模板类型接缝`；若未解决，仅提交根因和阻断记录，不提交绕过实现。

Run：

```sh
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

Expected：起初复现实际错误；修订后退出0，非法输入类型测试仍受约束。

## Task 2：A1 — 所属控制器、生命期和租约

**Files:** Create `contracts/types.ts`、`entity-store.ts`、`entity-store.test.ts`、`fixtures.ts`；Modify 原`design-state.ts`的实验接入，旧测试不删除。

**Interfaces:** `createEntityStore(controllerId: string)`返回`target(kind, id, facet)`、`resolve(ref)`、`reconcile(observed)`、`registerEditor(target, editor)`及`releaseEditor(lease)`。target/错误按规格§4；reconcile的延续信息只能来自内部受控命令。EditorAdapter签名为`flush(): void`及`capture(): DraftValue | null`，可抛错，租约由store签发，宿主不提供continuity名单。

- [x] 写测试`foreign_ref_rejected`、`facet_kind_rejected`、`same_command_reuse_new_lifetime`、`late_release_keeps_new_editor`、`process_ref_expires_on_replace`。断言外来引用即使所有其他字段相同也拒绝；新生命期不能读取旧缓冲；旧release不改变新租约。覆盖A01/A02及Review Focus 2。
- [x] 运行测试观察预期合同失败；测试桩缺失可用于初次红灯，但夹具必须使用真实BpmnModel与FlowDesignSession。
- [x] 实现内部归属登记与租约；reconcile先通知draft-store转移待处置输入，再注销旧身份，不能沿用旧registry直接删除缓冲的次序。为A2留生命周期回调`beforeInvalidate(ref, reason)`。
- [x] 运行新用例与原identity/design-state测试，全部通过；断言保存文档不含controllerId/epoch/lifetime/lease。
- [x] 原子提交：`test(probe): 验证控制器归属与编辑器生命期`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/entity-store.test.ts probes/stage-zero/design-state.test.ts --testTimeout 20000`；Expected：先合同红灯，再全部PASS。原designer身份11项在A5一起复跑。

## Task 3：A2 — 冲突输入与明确恢复

**Files:** Create `contracts/draft-store.ts`、`draft-store.test.ts`、`controller.ts`骨架；Modify `design-state.ts`和`EditorRetentionProbe.vue`的候选接入。

**Interfaces:** 消费A1的`beforeInvalidate`与EditorLease；产出`stage(target, draft)`、`status(target)`、`conflicts()`、`resolveConflict(id, "discard-local" | "restart-on-current")`。内部`requestDelete(impact, confirm)`绑定确认时的版本/影响集；confirm由实验宿主注入，不作为未来公共任意命令执行器。

- [x] 写`unknown_form_replace_keeps_live_editor_on_capture_throw`、`in_place_change_keeps_original_basis`、`discard_affects_one_record`、`restart_uses_current_without_copying_local`、`deleted_target_cannot_restart`。断言旧输入保留，模型零写入，重启只是从当前值建新缓冲并保留比较材料。覆盖A03/A04及Review Focus 3。
- [x] 写`delete_confirmation_expires_after_edit`、`failed_cascade_keeps_buffers`、`successful_cascade_clears_only_deleted`；使用真实removeBranch/removeBlock与表单引用守卫，不手工拼删除结果。覆盖A02/A05及Review Focus 1。
- [x] 运行看到合同红灯，再实现状态转移；已确认删除才清输入，未知替换改为detached；不能序列化时不卸载原编辑器。restore在冲突态返回conflict，不能当隐式discard。
- [x] 定向全绿，实际两FormDesigner模拟未知替换并验证原实例仍在、两个恢复动作不改模型。文档切换期间迟到捕获不得写新文档。
- [x] 原子提交：`test(probe): 验证冲突输入保留与显式恢复`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/draft-store.test.ts probes/stage-zero/contracts/entity-store.test.ts --testTimeout 20000`；Expected：红→绿；不把注入异常称为天然第三方异常。

## Task 4：A3 — 隔离候选、读写集与原子提交

**Files:** Create `contracts/candidate.ts`、`candidate.test.ts`、`transaction.ts`、`transaction.test.ts`、`controller.test.ts`；Modify `contracts/controller.ts`。

**Interfaces:** 消费A1/A2，产出控制层`prepare(purpose: "draft-save" | "validate")`、`apply(target): Promise<OperationResult>`、`restore(target): OperationResult`；结果与规格§4一致。内部`prepareCandidate(context)`生成只读候选及受控令牌，`commitPrepared(command, token)`只供同步内部提交，不对宿主公开。context含实际session、身份/缓冲与已核验命令规则，不接受不受信任的任意model回调。A3先以现有operations及名称、默认引用、表单更新命令证明事务；审批全字段校验适配在A4接入共享规则后再跑本片全套，A3不得提前声称所有节点字段合同已完成。

- [x] 写`focused_flush_included_in_first_candidate`、`second_capture_failure_zero_live_writes`、`prepare_new_input_rejected`、`snapshot_compile_keeps_original_di`、`unsupported_extension_preserved_or_rejected`，断言原model/session/forms、字段/数组引用、DI及所有输入不变，编译只发生在隔离副本。覆盖A06/A15。
- [x] 写`fork_default_readset_detects_sibling_change`、`new_form_reference_blocks_stale_delete`；目标局部值相同但共享读集已变也须拒绝。覆盖A08及Review Focus 4。
- [x] 写`commit_middle_failure_rolls_back_identity_arrays_di_events`；在写入中段注入异常，核对原对象/数组身份及内容、default、顺序、DI、租约、版本和事件数量。覆盖A07及Review Focus 5。
- [x] 红灯后实现隔离prepare与同步提交策略。快照先验证现有`model.toXML()`→`parse`（同适配器）的无副作用路径，只在副本上运行compile；若无法无副作用取得副本，记录阻断并提出最小core接缝方案，本片不改core。
- [x] 验证不靠整体替换当前模型“回滚”；如果无法证明原子性，停止A3，保留证据，不进入A4或宣布B02通过。
- [x] 全部定向通过，复跑A1/A2；原子提交：`test(probe): 验证候选隔离与原子应用合同`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts --testTimeout 20000`；Expected：新增针对性红灯后全部PASS，失败路径有同等强度断言。

## Task 5：A4 — 共享字段与真实选择最小接缝（需明确批准）

**Files / 生产白名单：**

- Create `packages/designer/src/property-editing.ts`及`property-editing.test.ts`：从既有抽屉抽离读取/字段规则/准备逻辑。
- Create `packages/designer/src/components/NodePropertyFields.vue`及组件测试：共享纯字段内容。
- Modify `packages/designer/src/components/NodeDrawer.vue`及既有测试：包装共享字段，保留旧行为。
- Modify `packages/designer/src/components/DingtalkDesigner.vue`，必要时`BlockNodeList.vue`仅透传当前选择/事件，以及对应组件测试：external模式、选择与受控操作请求、默认条显式开关。
- Create `.changeset/stage-zero-external-editing.md`：若A4进入公开包PR，必须附designer的minor changeset（新增显式外置行为，沿用0.x增量能力规则）；本轮文档不建changeset、不bump版本或发包。
- 不修改`packages/designer/src/index.ts`、`packages/form-create/src`、`packages/core/src`、任何package.json或lockfile。探针通过源码别名验证候选，公共导出另审。
- Create probe `ContractProbe.vue`、`contract-location.test.ts`；Modify `ProbeApp.vue`仅增加实验入口。

**Interfaces:** 按规格§7提供`propertyEditing: "drawer" | "external"`（默认drawer）、`selectedId?: string`、`showDefaultForm: boolean`（默认true）、`selection-request`、`operation-request`与`focusElement(id, signal?): Promise<FocusResult>`。共享字段使用规格§4.3的FlowPropertyDraft，不从form-create反向导入。事件签名与语义命令联合严格按规格§7，在`property-editing.ts`中定义；不增加新操作。表单内容/默认引用的DraftValue仍只在候选控制器中定义。

- [x] 在片前核对批准结论；没有A4授权则停止并标明A01–A08局部通过，不制作复制版组件绕过。
- [x] 写`legacy_drawer_contract_unchanged`、`external_switch_keeps_two_invalid_drafts`、`external_commit_pending_refuses`、`draft_apply_does_not_relax_legacy_confirm`、`external_structure_request_does_not_mutate_first`。先证明新接缝尚不存在/不满足合同，再抽离共享规则；旧测试保留。覆盖A09。
- [x] 写`locate_same_name_by_actual_id`、`foreign_instance_refused`、`late_locate_cannot_steal_manual_selection`、`destroyed_view_cancels_focus`、`default_form_unique_real_entry`、`bpmn_remains_readonly`。读取实际selectedId和字段目标，不断言成功文案或DOM模拟click。覆盖A10/A12及Review Focus 1/2。
- [x] 写`fa_after_convert_delete_and_nested_block`，结合真实PR #92操作、缓冲200/模型100不同值夹具，断言ID/条件/default/顺序与输入归属；保存重开三档转单签仍通过。覆盖A11。
- [x] 实施最小接缝与实验定位协调：每次await后重查租约/引用/请求号，用户主动选择也推进请求号；旧抽屉路径不附加新的自动提交/缓冲策略。
- [x] 组件测试通过后，原生浏览器使用两个实例、同名不同ID及冲突输入执行上述路径，核对真实activeId/选择状态、焦点与模型；保留无法定位/取消/失效的负证据。
- [x] 分组提交共享字段兼容抽离与实际选择接缝，建议`refactor(designer): 抽离共享属性字段并保持抽屉合同`、`feat(designer): 增加显式外置编辑实验接缝`。A4附上述changeset，公共发布名称、迁移与实际发布仍另行审阅，本计划不发包。

Run：

```sh
pnpm --filter @flowduet/designer exec vitest run --testTimeout 20000
pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contract-location.test.ts probes/stage-zero/contracts --testTimeout 20000
```

Expected：新接缝用例先红后绿，既有designer用例全部通过。浏览器失败不能以happy-dom替代通过。

## Task 6：A5 — 校验/保存版本与A/B汇总

**Files:** Create `contracts/validation.test.ts`、`contracts/host.test.ts`及必要候选控制器内部实现；Modify `ContractProbe.vue`、当前验收README；Create `contract-acceptance.md`和实际证据目录。

**Interfaces:** 沿用§8的ValidationStamp与`{ snapshotId, controllerId, documentEpoch, generation, json }`保存消息。宿主适配器签名`persist(snapshot): Promise<void>`；只确认同一世代/请求快照，控制器不内置存储或下载。

- [x] 写`equivalent_apply_keeps_validation_not_saved`、`normalization_invalidates_validation`、`unknown_change_requires_revalidation`、`save_during_edit_keeps_dirty`、`stale_epoch_save_does_not_confirm`；未解决conflict/detached时prepare拒绝并保留输入。覆盖A13/A14。
- [x] 红灯后实现候选内容/目标身份/规则版本及宿主快照确认；不使用当前局部JSON指纹代表完整模型。运行A1–A5全部测试转绿。
- [x] 原生浏览器执行焦点未失去的输入、跨对象切换、冲突比较/两种处置、捕获失败、实际ID定位及保存竞态。没有执行的状态明确列未测。
- [x] 运行下方共同命令，记录各包实际数量/版本/耗时与告警。严格类型仍失败时A/B不得标全通过，不据全套测试绿掩盖。
- [x] 自审接口一致性、A01–A15与证据链接；做一次独立全范围复核，区分重新执行与只核读。修改核心接缝的复核问题先按严重度处置，不能直接进入工作台。
- [x] 更新B02/B05结论，B01/B03/B04保留原状态及后续门槛；原子提交`docs(design): 记录编辑合同与严格类型验收`。不推送或开PR。

```sh
pnpm -r test --testTimeout 20000
pnpm build
pnpm lint
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

Expected：每条退出0；测试数量依据实际输出，不预填548。无引擎部署时保留此验证边界，新增公共导出/发布另行计划。

## 后续C/D/E的独立薄切片与复审门槛

以下是下一组计划的输入与验收协议，不是A/B执行授权的自动延伸。

| 切片              | 精确输入/候选文件                                                                                   | 实验及应交证据                                                                    | 进入下一步条件                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| C1 内部输入矩阵   | 现有`fixtures.ts`八类字段、EditorRetentionProbe、A的EditorAdapter/Lease；新`editor-state-matrix.md` | 每类焦点/清空/默认值及适用选项，拖拽未完成/取消、两份表单往返；人工与天然异常分列 | 补充方案审阅后实施；未证明保真继续保持挂载，不切默认单例           |
| C2 恢复及异常     | C1矩阵、待处置实例；候选`editor-recovery.test.ts`                                                   | 真正失焦/序列化失败保留输入与实例；单例恢复与保持挂载逐项对照                     | 全部支持状态有结论；无法自然复现写未验证，B03不自动解除            |
| D1 主题/弹层调查  | ThemeIsolationProbe、真实可达弹层；新`theme-bridge-proposal.md`                                     | 映射公开配置、第三方覆盖点、注册/CSS影响、卸载清理；禁止全局主题覆写              | 先审阅桥接方案及依赖影响；不在调查中散落生产CSS                    |
| D2 双实例适配验证 | 获批D1、A4面板样机；候选`theme-instance.test.ts`                                                    | 浅深×两密度、主题交换、真实弹层、焦点/错误/禁用/长中文；对比度按规格§9            | 弹层及宿主归属可证，无白色孤岛或取消隔离的默认降级                 |
| E1 资源协议       | C/D的固定实现版本；新`resource-budget-proposal.md`                                                  | 新页面2/10/20表单、两策略、20次往返×至少3轮、冷启动/GC对照、时延与资源            | 先审阅测量协议，再执行；没有人为预设“通过”绝对值                   |
| E2 容器任务与预算 | E1环境、A4面板、两档密度                                                                            | 1440/1280/1024/900/768px×280/320/400px面板，长中文/多分支任务；按实际故障提出阈值 | 维护者批准默认策略、最小宽度与低于下限行为；真实顾问走查缺席须记录 |

每组只创建实际需要的资料，不提前造完整生产主题或工作台。C/D/E最后更新同一B01–B05验收表；不能将某组的负诊断计作产品能力通过。

## 交付、审阅与执行方式

原计划审阅入口（历史）：当时需要用户审阅本规格及计划，尤其A4生产白名单与A3失败停止条件。建议沿用**本会话逐片执行＋末尾一次独立复核**：A1–A5共享身份、冲突与候选接口，连续执行可减少重复理解；如希望每片都独立评审，可选择子代理逐片实施/复核，成本更高。

批准记录应明确：规格/计划是否通过、是否包含A4、执行方式。尚未批准前保持只有文档；C/D/E仍在各自补充方案审阅后推进。用户无需现在提供代码、截图或额外环境。

## 文档自审记录（2026-10-15）

已核对规格A01–A15均映射到任务，候选字段/结果类型及相邻切片依赖一致；A3的全字段验证依赖A4后回跑，不提前宣称完成。焦点flush纳入首个捕获版本，未知替换保留租约，A4实际选择与归属校验分层。生产白名单包含必要changeset，公共控制器和core变更仍在范围外。

方案初稿阶段只验证文档本地链接、格式与差异范围；当时未执行未来计划中的测试、浏览器实验或类型修复，原B01–B05状态保持不变。当前执行结论以下方记录为准。

## 批准与本轮基线

2026-10-15，用户明确批准规格、计划及A4，选择本会话逐片执行，要求回归和独立复核，不推送。产品develop重新fetch仍为`02d3474`；在已有托管工作树新建`refactor/stage-zero-editing-contract`，从`e78d56a`保留已批准文档和隔离探针输入；相对develop无生产改动。数字任务编号仅适配执行工具，A/B语义编号不变。

## 当前执行状态

A/B及A4实现完成，独立复核发现三个Important，已在`10b66f4`以三项真实组件失败回归补修，并在`9c8a8f5`补齐capture同内容替换的失败回归与屏障，执行方全包638/638、build/lint/严格probe及浏览器补验通过。B02/B05候选合同验收通过；C/D/E未启动、B01/B03/B04仍阻断，未推送。没有二次独立复审，初审及处置范围分别记载。实际新增openEditor基线、已解析表单引用依赖及最终消费凭据检查见[验收记录](../system-v1/probes/contract-acceptance.md)，不把控制器原型直接冻结为公共API。

## 四项P2补修（2026-10-15，用户已授权执行）

基线`247acb4`，继续原隔离分支；先将四条独立复现纳入仓库回归，再逐项RED→GREEN，不扩大生产白名单。

- [x] 异常边界：`contracts/controller.ts`及`location.ts`统一接住初始/异步版本核对异常，保留缓冲、失效当前校验，不将不可读状态伪装为已保存；测试初始同步、异步期间不可序列化、save/validate/locate及恢复后重试。
- [x] 类型匹配：`contracts/draft-store.ts`在覆盖前核对target/facet与当前可编辑kind；拒绝错误联合类型且原缓冲/版本不变，合法业务未完成输入仍允许保留。
- [x] 表单还原：还原成功撤销旧EditorLease，通知探针宿主按目标重建当前实例；不改FormDesigner生产API。真实可见表单8→9→还原→候选8，另表单输入保留，旧回调无权写新会话。
- [x] 默认配置恢复：`ContractInstanceProbe.vue`按facet区分默认配置，保持flowTarget；restart及discard均验证默认区可见、流程返回原节点。
- [x] 全包test、build、lint及严格probe类型；真实浏览器补验适用路径；对固定补修head做独立Standards/Spec复核，归档本轮证据与边界后更新B02/B05并分组提交。

验收：四条原复现及相邻边界全部转绿，独立复核无未处置阻断；B02只恢复候选可行性通过，B05只覆盖锁定版本；B01/B03/B04仍阻断。C/D/E、正式工作台、推送与发布均不在本轮。

本轮补修源码`83ec03d`，独立复核固定此head发现一项Important（定位/结构两个入口）。执行方`1506b16`以两条RED→GREEN闭环；当时657/657在本地20秒参数下通过，build/lint/strict通过，默认两项5秒超时作为历史保留。随后已完成批准的FormManager单文件测试兼容/清理补修：两项5轮、整文件2轮和原样`pnpm test`657/657通过，见[最新验证](../system-v1/probes/formmanager-default-2026-10-15.md)。最终head无二次独立全审或远端CI结论。C/D/E未启动，未推送。
