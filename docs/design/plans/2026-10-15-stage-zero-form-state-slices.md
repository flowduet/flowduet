# 阶段零 C 组：表单状态保真薄切片执行计划

> **For agentic workers:** REQUIRED SUB-SKILL：获批准后使用 `superpowers:executing-plans` 在本会话逐片执行；建议末尾一次独立复核，执行方式待维护者确认。按复选框追踪。**本文件及配套方案目前仅供审阅，任何步骤都未获实施授权，不能从任务标题推断已开工。**

**Goal:** 对八类字段、焦点/拖拽、跨表单及异常恢复建立可复验矩阵，判断B03和安全重建的实际边界。

**Architecture:** 复用A/B的EntityRef、EditorLease、DraftStore与ContractController；新C探针组合真实FormDesigner。K保持挂载为参照，R只在内容/上下文可恢复且版本稳定时移交，失败保留旧实例并回退K；不把新策略迁入产品。

**Tech Stack:** 仓库当前锁定Vue/TypeScript、真实FormCreate Designer 3.5.0、Element Plus、Vitest与Chromium；无新依赖。

**Spec:** [C组补充方案](../2026-10-15-stage-zero-form-state-proposal.md)，尤其§4–9的F01–F08、L01/I01、X01–X09、ERR01–ERR07与C01–C08。上位[A/B规格](../2026-10-15-stage-zero-editing-contract.md)保持。

## Global Constraints

- 文档基线`develop@10b2a136c7a2d75065b2f6155a19a9dc5aa646da`；未来施工重新fetch并记录基线差异，不能照搬旧head结果。
- 本轮只交付待审文档；批准前不创建本计划列出的probe/test文件，不运行新实验。
- 后续C批准范围只限私有probe、测试与C报告；三包生产源码、根导出、依赖/lockfile、编码/部署守卫、A/B已有行为不在修改白名单；仅C4提议的只读checkPreparedCandidate入口及等价内部判定提取可随本计划审阅，不扩为公开API。
- 未知替换保留冲突输入；首期不自动合并、强制覆盖或重绑同名对象。
- 两表单切换不自动写FlowDesignSession、不要求先放弃输入；失败保留原实例和最新输入。
- 不修改既有默认5秒或已批准的单例60秒；不把FormManager单文件toString兼容扩大到新文件/全局，超时先诊断再审方案。
- 真实FormCreate参与正常和恢复路径；不能stub序列化结果/私有状态来证明保真；人工异常与天然失败分开。
- 不fork、不引入Pro；不新增全局CSS/快捷键/blur，不推进D/E、正式工作台、发布或推送。
- 保持挂载、验证后重建与失败回退分别记账；C不选资源预算、缓存容量或正式默认策略。
- 天然失败、原生拖拽或OS输入法未验证，不以合成事件替代通过；B03继续阻断。
- 不设日历时间盒；出现必须改产品/依赖、超出C4 gate的A/B接缝或成本扩大时停在当前片，带证据回审。

## Review Focus

1. 观察代码先调用exportContent触发blur，导致“未失焦成功”其实已换了被测状态——C1/C2必须先读DOM/版本，再捕获。
2. 重建时JSON相同但0/false/[]/未设置或当前字段、选项单元格、中文组合输入不同——C1/C4分别断言原始属性与上下文。
3. 真正拖拽未完成时导航/保存，只有派发事件记录却未检查规则树——C3必须用真实指针和完成/取消的前后树证明。
4. 第二个编辑器捕获/恢复失败，第一份已成功且源实例/租约提前销毁——C4分别注入首尾失败，并核对两表单和临时实例清理。
5. 临时实例挂载期间新输入、未知替换或更换租约，迟到失败/卸载清掉新成功——C2/C4锁定完整身份/租约/输入版本与导航请求，C5保留负证据。

## 文件职责与接口

下列候选路径均相对`apps/playground/probes/stage-zero/`；C报告位于`docs/design/system-v1/probes/`。不改写旧EditorRetentionProbe/ProbeDesignState以让旧负向测试变绿。

| 文件                                                     | 责任                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `form-state/fixtures.ts`                                 | 八字段/布局/日期兼容有名夹具；复用`fixtures.ts`的rulesFor及`contracts/fixtures.ts`的createContext/deferred  |
| `form-state/types.ts`                                    | FieldCaseId、StateCaseId、策略/观察/结果形状；类型仅probe内部使用                                           |
| `form-state/state-evidence.ts`                           | 纯语义比较与只读观察序列化；保留属性存在性，不先触发exportContent                                           |
| `form-state/retention-policy.ts`                         | select的K路径、R临时实例验证与安全移交、K回退及取消清理；复用A/B而非复制事务                                |
| `contracts/controller.ts`、`contracts/candidate.test.ts` | C4仅增加只读候选复验并复用既有签发/stamp判定，保留原语义及回归                                              |
| `FormStateProbe.vue`                                     | C组真实组件宿主、实验控制与双实例隔离；不是工作台，控制器通过现有createContext/createContractController创建 |
| `ProbeApp.vue`                                           | 只增C入口与组件导入，原A/B入口保持；退出C调用其dispose清理实验实例                                          |
| `form-state.test.ts`                                     | 夹具/语义边界及最小真实FormDesigner集成，真实菜单和可见字段断言                                             |
| `form-state/retention-policy.test.ts`                    | 可控时序、租约与临时实例移交/回退；宿主替身仅验证协议，不作为真实FormCreate保真证据                         |
| `editor-recovery.test.ts`                                | 真实表单失败/修正/restore及跨对象保留回归，小夹具避免同测试承担全部浏览器矩阵                               |
| `editor-state-matrix.md`、`editor-state-acceptance.md`   | 展开矩阵逐行结果、策略裁定及B03边界；不是先填通过的占位报告                                                 |
| `evidence/form-state-<实际执行日>/`                      | 锁定版本、动作、状态、原始输出和manifest；仓库相对导入，重放说明不依赖写死的用户目录                        |

### 候选内部接口（在C0核实能力后按此实现，不新增包导出）

`types.ts`定义：

```ts
export type FieldCaseId =
  "F01" | "F02" | "F03" | "F04" | "F05" | "F06" | "F07" | "F08" | "L01" | "I01";
export type StateCaseId =
  | "loaded"
  | "focused"
  | "cleared"
  | "unset"
  | "options-pending"
  | "composition"
  | "dragging"
  | "dialog-pending";
export type RetentionStrategy = "keep-mounted" | "rebuild-verified";
export type ActualStrategy = "kept" | "rebuilt" | "kept-fallback";
export type FormContent = { rules: string; options: string };
export type MountedEditor = {
  target: EditTarget;
  instanceId: string;
  adapter: EditorAdapter;
};
export type LiveState = {
  selectedField: string | null;
  configPage: string | null;
  pendingControls: readonly {
    path: string;
    text: string;
    selectedOptions: readonly string[];
    selection: readonly [number, number] | null;
  }[];
  openLayers: readonly { path: string; ownerTargetKey: string; confirmed: boolean }[];
  composing: boolean;
  dragging: boolean;
  ownerKnown: boolean;
};
export type SuspendedFormSnapshot = {
  target: EditTarget;
  content: FormContent;
  context: LiveState;
};
export type SwitchOutcome = {
  active: EditTarget;
  actual: ActualStrategy;
  reason?: string;
};
```

EditTarget/EditorAdapter/EditorLease/EditResult均从A/B`contracts/types.ts`导入。caseId由FieldCaseId、布局、StateCaseId、策略、导航路径和C0冻结的variant拼接，variant显式列出默认值类型/日期形态等，不能只靠状态名压掉数据边界。LiveState是矩阵中可观察、被明确恢复的上下文，不声称完整读取上游私有状态。实例标识是probe日志标签；租约合法性仍比较真实EditorLease，不能用日志字符串替代。

`RetentionHost`也在`types.ts`定义，方法固定为：

- `current(): MountedEditor | undefined`、`observe(editor: MountedEditor): LiveState`。
- `mountActive(target: EditTarget): Promise<MountedEditor>`：优先复用同target/生命期/有效租约的存活实例，没有才按现有openEditor/注册接缝新建，前后核对身份；不提交session。
- `mountProvisional(target: EditTarget, content: FormContent): Promise<MountedEditor>`：临时实例不注册活跃租约，事件不stage/touch。
- `restoreContext(editor: MountedEditor, before: LiveState): Promise<boolean>`：只通过已有公开/UI能力恢复；不可恢复返回false，不改私有字段，也不将缺上下文说成等价。
- `adopt(editor: MountedEditor, lease: EditorLease): void`：租约移交后将临时目标放入宿主持有表，不重新注册、不接收旧源内容；失败按ERR07保留已签发的新租约。
- `show(editor: MountedEditor): void`、`unmount(editor: MountedEditor): void`：仅操作probe持有实例；unmount旧实例只能释放其旧租约。

C4在现有probe controller增加`checkPreparedCandidate(candidate: PreparedCandidate): EditResult<void>`，PreparedCandidate从`contracts/candidate.ts`导入；复用其原有WeakMap+stamp检查，只检查签发及当前性，不再flush/capture。原versions使用同一判定，原apply/save/validate语义不变。未批准此接缝则停在K验证，不实现不安全R。

`retention-policy.ts`产出：

```ts
export declare function createRetentionPolicy(
  controller: ContractController,
  host: RetentionHost,
): {
  select(target: EditTarget, strategy: RetentionStrategy): Promise<EditResult<SwitchOutcome>>;
  dispose(): void;
};
```

select仅接受本controller的存活form-content目标。K调用mountActive复用旧实例；R先证明源A可安全暂停，保存SuspendedFormSnapshot，再从目标B自己的未应用缓冲/有效快照或未编辑定义装载临时B。B的openEditor基线须在prepare前建立；候选复验后，policy为B签新租约并撤销A旧租约，host.adopt接管B，再showB、卸载旧A。源A快照和未应用缓冲保留；未来返回A重新验证、签新租约。移交前不销毁A，失败可按K导航但必须actual=kept-fallback；B无法装载则返回失败并保留A。target失效/导航更新时不猜替代目标。

两策略从独立重置会话使用同一夹具/动作；纯R稳定状态为一个可交互实例，临时验证允许多实例。任何K回退/冲突保留导致的额外实例都记录，不把逐对象重建仍全量保持挂载误称单实例策略。缓存仅会话内、按完整targetKey归属，不序列化租约或写入设计文档。

`state-evidence.ts`产出`describeValue(rule: Record<string, unknown>): { present: boolean; type: string; json: string | null }`及`equivalentContent(a: FormContent, b: FormContent): boolean`；先用`rulesSemantics`及options深比，再递归核对原始value存在性/类型和布局路径。`describeValue`未设置时present=false、json=null，显式null时present=true、type="object"、json="null"；schema是否允许该值仍交现有守卫。LiveState由宿主只读DOM观察，不在此调用导出函数。

## C0：冻结实际状态清单与观察基准

**Files:** 读方案§2/4/5、现有FormDesigner/config/schema/checkbox-defaults及A/B接缝；建`form-state/fixtures.ts`、`types.ts`、`state-evidence.ts`、`form-state.test.ts`、`editor-state-matrix.md`；创建只服务本片的`FormStateProbe.vue`和ProbeApp入口。

**Interfaces:** 消费rulesFor、createContext/createContractController及既有exportContent；产出上节类型/比较器与只读观察入口，探针先只实现K所需最小真实宿主，不搭R空壳。

- [ ] 重新fetch并固定最新develop；新白名单分支`refactor/stage-zero-form-state`，迁入已批准两份文档，记录其SHA。若develop相对10b2a13有相关差异，先核对适用性；复用隔离工作树，不重置现有文档分支。
- [ ] 执行一次默认全量与严格probe作为施工基线；实际数量/错误不同即记录，不预填657为将来结果。
- [ ] 建固定F01–F08、L01、I01夹具；两表单字段采用`a_`/`b_`前缀与不同默认值。给A/B两个controller相同form ID，断言归属按真实ref，而不是名称。
- [ ] 写`value_presence_and_types_are_distinct`：0与"0"、false与未设置、[]与未设置、空串与未设置比较为不等；规则元数据差异可等价，字段/选项/列顺序差异不等。先验证比较器负样例会失败，再实现其最小逻辑。
- [ ] 用真实菜单/属性面板盘点八类实际控件、日期导入形态、可达弹层、选项编辑层、数字/日期中间串和可取消拖拽入口。展开每个caseId，记录适用性依据；发现原合同外但当前schema接受的输入先纳入兼容行，不擅自删范围。
- [ ] 验证只读观察不会触发blur、导出、stage、版本增长或改变session；先观察原始焦点，再允许捕获。真实菜单/已装载字段必须在场，不能只测types/比较器。
- [ ] 将实际可达状态清单交维护者核读；若新增生产接缝需求，带失败证据停在此片。提交`test(probe): 建立表单内部状态夹具与观察基准`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state.test.ts --reporter=verbose`；另启动下方浏览器入口。Expected：比较器/真实装载通过，清单每项有依据，不代表保真已验收。映射C01，Review Focus 1/2。

## C1：字段与布局往返矩阵

**Files:** 扩展`form-state.test.ts`、夹具、FormStateProbe；逐行填`editor-state-matrix.md`。

**Interfaces:** 消费C0完整矩阵及equivalentContent/describeValue，使用原exportContent/现有schema守卫；暂按K保留，不自动向session应用。

- [ ] 写有名用例`typed_defaults_roundtrip`、`checkbox_empty_array_vs_absent`、`textarea_newline_and_grid_order`、`imported_single_date_shapes_keep_type`，逐项断言方案F/L/I规定值。既有行为已通过的特征测试直接保留，不故意制造RED；发现差异保存最小失败回归再处理。
- [ ] 在真实浏览器逐项创建/装载八类字段、清空、默认值与适用选项编辑；顶层/列内分别检查，保留每个适用单元格的结果，不用一个大截图代替矩阵。
- [ ] 比较导出前DOM、导出后候选及重开可见值；单独比较title/field/required/options/order/layout与原始value存在性，不只比较JSON文本。
- [ ] 默认选项删除后，观察真实控件/候选是否一致；若非法保留输入并拒绝，不在probe内“修正”schema后伪装成功。
- [ ] 生产或第三方本身有差异时记录失败并另报最小修复方案；本片不得直接修form-create生产实现或扩大上游支持范围。
- [ ] 定向测试和所列原生行重验通过后提交`test(probe): 覆盖八类字段与布局状态往返`；未通过可提交负证据，但不能勾C02通过。

Run沿C0定向命令；Expected：F01–F08/L01/I01在K下的适用状态逐行可判；R列留到C4，不能提前填通过。映射C02，Review Focus 1/2。

## C2：焦点、两表单导航与原生输入

**Files:** 扩展FormStateProbe、`form-state.test.ts`、矩阵；必要协议检查放`form-state/retention-policy.test.ts`，本片仅实现select的K分支，R返回明确未支持而非假成功。

**Interfaces:** 消费LiveState/RetentionHost与A/B完整targetKey、租约、composition保护；产出K的select和实例归属记录。局部收集按钮/快捷键只在C实例内有效，不能接管宿主Cmd/Ctrl+S。

- [ ] 新增`observe_does_not_flush_focused_input`、`composing_blocks_capture_not_input_retention`、`two_forms_switch_without_session_write`、`foreign_popup_never_blurred`；断言flush/capture之前焦点与原始文字仍在，组合结束后的Vue刷新前拒绝，刷新后才取得完整值。
- [ ] 真实浏览器保持焦点执行A→B→A、表单→流程→表单，再走局部快捷键收集；同时验证B和另一controller不变。正常点击/快捷键分别留动作记录，不先人工失焦。
- [ ] 对实际可达弹层核对owner、活动输入与候选；无法通过现有能力确定归属时返回不确定/回退，不全局blur其他实例。此处不改主题或弹层CSS。
- [ ] 记录组件CompositionEvent轨迹；另以明确OS/输入法运行原生组合输入。工具不能操作时写工具阻断，保留原生行未通过，不能用第一项替代。
- [ ] X01–X04/X09关键轨迹各3次重置，检查上下文与输入、session及持久化调用；有新输入/租约变化则旧结果不能确认新状态。
- [ ] 通过定向协议及实际原生行后提交`test(probe): 验证焦点输入与两表单切换保真`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state.test.ts probes/stage-zero/form-state/retention-policy.test.ts --reporter=verbose`。Expected：K及捕获屏障通过；OS未知仍保留C03/C07限制。Review Focus 1/4/5。

## C3：真实拖拽完成、取消及中断

**Files:** 扩展FormStateProbe和矩阵；将可确定的中断保护协议回归纳入retention-policy.test；浏览器动作与状态存实际证据目录。

**Interfaces:** 消费C0识别的真实拖拽入口及LiveState.dragging；只通过可观察事件/上游公开UI能力判断，不能仅收到draftChange就推断正在拖拽或已drop成功。

- [ ] 写`drag_busy_refuses_snapshot_handoff`、`cancelled_drag_keeps_original_layout`的协议测试；实际规则变化仍由真实FormCreate和浏览器验证，不用宿主替身替代。
- [ ] F01–F08各做菜单→顶层/列内的真实drop；L01做建行、跨列、排序、禁止嵌套。核对实际规则tree、顺序、重复字段和未提交输入。
- [ ] 对方案X06规定的代表字段/布局，按真实pointerdown/move维持未drop状态，尝试导航及局部收集；拖出有效区、pointercancel及实际支持的Escape取消分列。记录拖前/拖中/拖后规则与实例。
- [ ] 取消应回到拖前布局，完成只保留最终布局；拖中收集不能标当前保存/校验通过。无法观察结束时保持不确定并保留原实例，不加固定sleep后假定稳定。
- [ ] 中断关键轨迹3次重置；普通事件派发成功但原生不能执行时，分别登记协议通过/原生工具阻断，不合并为C04通过。
- [ ] 提交`test(probe): 记录真实拖拽完成与中断边界`；发现需要产品拖拽事件接缝则停片提案。

Expected：C04每条有真实UI结果或明确阻断，Review Focus 3/5覆盖。不得按DOM拖影消失单独认定规则已恢复。

## C4：验证后重建、失败回退与异常恢复

**Files:** 仅在本方案gate获批准后扩展`contracts/controller.ts`及`contracts/candidate.test.ts`，实现retention-policy的R分支，扩展FormStateProbe、retention-policy.test、`editor-recovery.test.ts`及矩阵。

**Interfaces:** 消费C0–C3的观察/宿主接口与A/B现成store/controller；产出完整select/dispose。以方案§7为唯一移交顺序，临时实例不注册、不触发live stage/touch；完成待处理Vue事件后复验候选/身份/导航/上下文，gate到现有registerEditor签新租约的段内无await/宿主回调。provisional是否有内部监听只验证本probe创建的清理，不据此宣布上游无泄漏。

- [ ] 先写`candidate_gate_rejects_foreign_stale_or_disposed`与`candidate_gate_does_not_recapture_or_write`：有效候选通过，外来/伪造/新输入/新租约候选返回version-changed，dispose返回cancelled；读取异常沿用capture-failed，新成功不能被迟到旧候选清空。提取并复用现有WeakMap+stamp判定，保持既有版本测试通过。
- [ ] 写`rebuild_preserves_source_identity_and_targets_destination`：源A快照留给A，目标B装载自己的内容；candidate未核验前A旧租约有效，核验后B新租约有效、A旧租约失效，迟到旧release不改变B或未来A新租约。
- [ ] 写`json_equal_but_context_missing_falls_back`、`capture_throw_null_invalid_keeps_both_forms`、`provisional_mount_or_export_failure_keeps_original`、`input_during_restore_rejects_stale_candidate`、`late_failure_and_release_keep_new_success`。R快照必须经controller.prepare("draft-save")统一捕获并从已捕获的源表单缓冲读取，不能直接adapter调用绕过A/B。适配器故障枚举throw/null/非法JSON/wrong kind/schema非法；分别在第一与第二对象注入，session/model/DI零变化，persist=0。
- [ ] 补`destination_basis_locked_before_prepare`与`lease_handoff_never_confirms_persistence`：目标B显示前锁基线，首次输入不能吸收后来的外部值；K纯隐藏/显示不制造编辑，R更换租约按A/B重新核对覆盖，不自动确认保存或重用过期校验章。
- [ ] 观察缺失策略时的预期失败，再实现最小R与K回退；不改A/B错误分类。移交前mount/restore/verify任一失败先清临时实例，旧实例及输入继续可用。移交后adopt/show/unmount失败按ERR07保留新租约及新输入、报告并重试，不回滚到失效旧租约。回退result.actual必须为kept-fallback，不能返回rebuilt。
- [ ] 在真实FormDesigner上执行K/R同夹具对照；重建前后导出语义、原始默认值及LiveState都验证，恢复无法用现有公开/UI能力完成就记录R失败，不写第三方私有状态强行通过。
- [ ] 实际运行ERR01–ERR04/ERR06/ERR07，并写`post_handoff_cleanup_failure_keeps_new_lease`：故障后继续输入并重试取得最新值；显式restore只影响当前表单，另一张及旧只读比较保留，未知替换不串同ID新对象。清理覆盖正常、断言失败、取消请求、provisional抛错及dispose；纯R完成切换后仅一个可交互实例，K回退或冲突保留则如实记录额外实例。
- [ ] 以未修改序列化方法的受支持UI状态探索ERR05；发现天然错误保存最小复现并观察失败后纳入回归。只取得输入守卫/人工故障或没找到安全复现时，写自然失败未验证，B03保持阻断，不制造自然故障声明。
- [ ] 按每行裁定K通过、R通过/拒绝采用或K回退，维护者确认拒绝R的依据；提交`test(probe): 验证编辑器重建移交与失败保留`。

Run：`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts probes/stage-zero/contracts/validation.test.ts probes/stage-zero/contracts/error-boundary.test.ts probes/stage-zero/form-state/retention-policy.test.ts probes/stage-zero/editor-recovery.test.ts probes/stage-zero/form-state.test.ts --reporter=verbose`。Expected：协议/真实组件回归通过，R实际能力不预设；自然/OS阻断如实留在报告。映射C05–C07，Review Focus 2/4/5。

## C5：最终重放、独立复核及B03裁定

**Files:** 新`editor-state-acceptance.md`、当前矩阵与evidence manifest；更新阶段零README的C/B03结论。不改旧manifest和历史失败日志。

**Interfaces:** 消费所有caseId的原始观察、K/R实际策略及C01–C08；产出固定源码与证据哈希、实际测试计数和出口结论。不生成公开控制器/API或正式工作台。

- [ ] 先冻结执行源码head与锁定环境；审计每个适用行均有结果及原始材料，不适用必须有C0依据。新增状态不得借更新清单抹掉失败。
- [ ] 在最终源码重放全部已声明通过的原生矩阵；对仅旧head有效的证据单列历史，不能让新截图替代未执行的输入/候选断言。
- [ ] 执行下方默认全量、build、lint、严格类型。统计正式/探针与各包实际数量；不预填新的总数，不为C放宽时限。变化/失败才补相应回归，避免无理由反复全跑。
- [ ] 按固定范围由独立审阅者核对规格/标准、五层观察、矩阵覆盖、异常来源、原生/模拟边界及K/R租约移交。报告亲跑与仅核读项；发现问题先保留失败回归，修后执行适用验证，不把执行方补修冒充独立再审。
- [ ] 按方案§9裁定：C完成实验不等于B03通过；自然失败/OS/原生拖拽仍未验证则维持B03阻断。R被拒绝且K所有必需项成立时可提交K覆盖范围供维护者裁定，不要求强行修R。
- [ ] manifest固定执行基线、最终源码、环境、命令/退出码、caseId到证据映射、SHA256及缺口；原始失败日志显式归档，不受*.log忽略规则漏掉。清理本次启动的浏览器/服务器，保留所需工作树。
- [ ] 分组提交源码与文档，文档提交`docs(design): 归档C组表单状态验证与B03边界`；交维护者审阅，未另获授权不推送、不开PR、不进入D/E。

```sh
pnpm test
pnpm build
pnpm lint
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

Expected：命令退出0；浏览器的每个必需适用项实际通过才解除相应限制。远端Node22/24 CI须在未来获准推送/PR后执行，不能从本地命令推断；本组也不要求偷偷推送来完成C08。

## 浏览器入口与证据协议

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1
```

实际返回端口的`/probes/stage-zero/index.html`进入拟新增“表单状态 C”入口；写入方案规定的浏览器/OS及版本。开始前记录源码head、实际页面URL与组件已加载的真实字段/菜单，使用虚构数据。浏览器驱动遵守实际可用工具的技能，不在本计划预设未经验证的CLI参数。

每项在导出前先观察焦点/文本/选区/拖拽/身份；导出后再记录候选与session/另一实例不变。截图只作辅助，规则树与字段值、事件/租约才是主要证据。表单配置、静态选项单元格及可达弹层都要有明确所有者；主题/颜色与资源指标不在本组测量。

## 覆盖检查与审批入口

| 规格验收 | 任务与证据                                              |
| -------- | ------------------------------------------------------- |
| C01      | C0清单、夹具、观察无副作用、日期兼容依据                |
| C02      | C1全字段K矩阵 + C4同夹具R/回退裁定                      |
| C03      | C2真实焦点/弹层/两表单与组件/OS输入法分列               |
| C04      | C3真实拖放/取消/中断与规则前后状态                      |
| C05/C06  | C4双对象异常/修正、临时实例清理、等价核对与租约原子接管 |
| C07      | C2 OS记录 + C4天然失败记录；未验证不宣称通过            |
| C08      | C5最终源码重放、实际全量/类型等结果、独立复核与哈希     |

自审已核对：方法名/类型与上位A/B一致，选项/日期兼容和value存在性有独立断言，五条Review Focus均落入任务；无默认“全部成功”或资源阈值。C0–C5当前均未执行，仅本计划的本地链接/格式/范围核对在文档收尾时执行。

请维护者审阅本计划与配套方案，确认矩阵、R暂停/恢复与回退合同、probe只读候选复验入口、探针白名单及本会话逐片执行方式。批准前agent停在文档交付，不写C组实现；D/E仍需各自补充方案，正式工作台不在此审批范围。
