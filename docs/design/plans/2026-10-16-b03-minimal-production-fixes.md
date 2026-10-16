# B03 最小生产修复薄切片计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task after user approval. Steps use checkbox (`- [ ]`) syntax for tracking. 此为计划编写时说明；现仅P0获维护者授权，执行记录见Task 1末尾，后续片不自动启动。

**Goal:** 按数值/日期中间输入、文字空串、拖拽取消的顺序，修复明确启用retained模式的K路径，并保留全部既有合同与负证据。

**Architecture:** FormDesigner拥有每实例、按字段生命期的原文/存在性缓冲，通过FormCreate公开扩展组件进入原规则；捕获是同步、可明确阻断的成对出口。legacy默认不变，R不采用。拖拽必须先证明公开非重建取消通道，失败就停片。

**Tech Stack:** 当前锁定Vue3、Element Plus、FormCreate Designer3.5.0/element-ui3.3.4、TypeScript、Vitest及真实Chromium；无新依赖。

**Spec:** [B03最小生产修复提案](../2026-10-16-b03-minimal-production-fixes-proposal.md)。[C交付证据](../system-v1/probes/editor-state-acceptance.md)为历史基线，不是新实现的通过证明。

## Global Constraints

- R不采用，不修R恢复、不引入实例淘汰/容量策略，K仅作为当前验收参照。
- 原始未完成输入留在编辑会话，不能塞进流程设计文档冒充合法定义。无法收集时保留输入并返回阻断；不会保存旧值后报成功。
- core、designer、设计文档格式、引擎/部署合同、依赖与lockfile均不改；不新增包、不fork、不启用Pro，不实施D/E、主题、布局、资源预算、正式工作台或推送。
- `editingMode`默认legacy、单次挂载固定；验收结果只覆盖明确启用retained的范围，不能宣传默认FormManager无损。
- 不修改同步EditorAdapter、A/B controller、ValidationStamp或保存世代合同；UI入口可在一次nextTick后重读，不能加sleep或无限重试。
- 仅使用公开扩展/组件/原生事件；不写DOM来恢复值，不访问`setupState`/`_sortable`/`__rule__`，不以setRule、改key、重挂载或整文档替换取消拖动。
- retained的canSuspend只允许保持挂载的K隐藏，不授权Dialog关闭/销毁。FormManager关闭须成功提交或当前会话明确放弃，状态转发和Escape优先级按规格§4.4；legacy默认不增加确认或吞键。
- APP-T独立，仅定位计划，不纳入本计划产品改动；保留默认5秒和真实FormCreate/业务断言。
- 原C证据不覆盖，新结果独立目录；协议、真实UI、OS和自然异常分开。未知仍阻断B03，不改为不适用。

## Review Focus

1. 未完成原文已经丢失才检查click或序列化旧业务值：在pointerdown/快捷键与blur之前证明缓存归属，验证`-`/`2026-`原文及候选零写入。
2. 字段被删除后立即复用ID、同ID双控制器或回调rule对象不稳定：旧缓存不得套入新生命期，不能靠最终ID集合或getRule复制对象判身份。
3. 输入已经有效但公开prop尚未回显，或compositionend同一Vue刷新内收集：明确pending-update并拒绝，不放宽同步adapter或用固定延时假定稳定。
4. 首对象故障根本没执行、第二对象失败后先写第一对象：保持原adapter和租约、显式计数/顺序，双活输入及重试候选均核对。
5. Escape被Dialog当作关闭，或取消请求被当成完成、迟到drop再提交：IME/弹层优先，拖动Escape不销毁表单；关闭确认须核对实例key/revision，原位取消另验真实结束/树/原文，禁止setRule回滚。

## 执行与基线门

计划编写时本地已存在C分支，书面材料基于`686ecc0`，该文档阶段不fetch/切换/实施。获准开工时先核对最新develop与C提交依赖，按仓库分支规则建立实施分支；若C尚未进入该基线，先报告依赖缺口并确认取入方式，不默默cherry-pick整批未合并代码或直接在develop/main提交。

将下面P0→P4映射进同一执行账本，每片写BASE、命令、退出码、来源和范围；P0、P3门失败不执行后续依赖步骤，不自动降级合同。没有日历时间盒，以成果复审控制；成本扩大再决策。每片只提交其源码/测试与证据，推送/发布另获授权。

### Task 1（P0）：证明默认值编辑接缝与身份，不写生产实现

**Files:**

- Create: `apps/playground/probes/stage-zero/form-repair/DefaultEditorSeamProbe.vue`、`seam-proof.ts`（只回答注入/身份/事件时序，不复制业务校验）。
- Modify: `apps/playground/probes/stage-zero/ProbeApp.vue`（实验入口）。
- Create: `docs/design/system-v1/probes/b03-repair-seams.md`及独立evidence子目录。

**Interfaces:** 消费锁定版本componentRule/组件注册与现有C夹具、只读观察、target/lease；产出“实例注入、字段token、删除时点、同步回显、日历确认”及Dialog公开关闭/键盘路由的能力证据及可继续/停止裁定。P1消费这些证据，不能消费一个未经证明的私有字段名。

- [x] 写并先跑失败断言`public_default_editor_preserves_pending_number/date`：普通切换前后要看到`-`/`2026-`，捕获不得返回旧业务值；明确区分当前生产路径失败与新样稿能力证据。
- [x] 在真实FormCreate中仅使用公开扩展注册无状态的样稿组件，观察每实例owner、componentRule回调对象身份和v-model回显顺序。测切字段、回到原字段、顶层/col、删除后立即复用同名field、同ID两控制器、卸载；不从getRule副本建立身份。
- [x] 核对自定义数值文本入口、日期手工文本与原日历确认可分离；核对六类I01无编辑保真及非标准valueFormat编辑的可支持范围。不新开日期类型选择器。
- [x] 明确drag/composition/busy和外来弹层能否通过本实例公开/原生信号识别；泛化`@drag`不作为可靠start/end，未确认状态一律不可收集。
- [x] 用锁定ElDialog公开props/before-close核对Escape默认关闭、X/遮罩回调、程序化关闭和卸载的不同路径；样稿证明关闭触发的pointerdown/键盘前置保护可先于blur，拒绝的手势后续click也不会放行；retained关闭协调在公开边界完成且不误拦正常输入/另一实例，不能假设before-close拦所有销毁，不改现有FormManager产品代码。
- [x] 按提案§9裁定。缺稳定身份、每实例隔离、安全日历输入或公开关闭/键盘接线时保存失败样本并停止P1，不改第三方/依赖来强行通过。
- [x] 证据输出标明sourceRef/clone的区别、删除回调时点、actualMode、真实/协议来源；提交`test(probe): 验证B03默认值公开编辑接缝`。

**Run:** 接缝样稿经Playground专用探针Vite入口、真实浏览器逐项执行；新增纯检查从既有`contracts/candidate.test.ts`导入，`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts`。

**Expected:** 只能是五项编辑接缝与Dialog接线均有真实证据的“可进入P1”，或可定位的“停止”。样稿输出、派发事件、类型可编译不能代替稳定性证据。覆盖Review Focus 1/2/3。

P0执行记录：见[公开接缝报告](../system-v1/probes/b03-repair-seams.md)。仅Task 1获授权并完成；公开能力门通过，P1–P4未执行，B03未解除。取入C依赖的方式已由维护者问题卡确认，具体基线、原样默认超时及末次结果保留在独立证据目录。

### Task 2（P1）：数值/日期原文与同步捕获

**Files:**

- Create: `packages/form-create/src/editor-state.ts`、`components/editor-input-state.ts`、`components/NumberDefaultEditor.vue`、`components/DateDefaultEditor.vue`、`editor-input-state.test.ts`。
- Modify: `components/FormDesigner.vue`、`components/FormManager.vue`、`components/designer-config.ts`、`components.test.ts`、`index.ts`、`README.md`（均在form-create/src或包根相应位置）。
- Conditional modify: `packages/form-create/src/form-create-setup.ts`，只按P0证明的必要注册，不放全局实例状态。
- Create: `apps/playground/probes/stage-zero/form-repair/FormRepairProbe.vue`、`FormRepairInstance.vue`、`input-capture.cases.ts`；Modify: `ProbeApp.vue`及既有候选测试入口。

**Interfaces:** 消费P0已证明的owner/字段生命期接缝；产出提案§4.3三个DTO、FormDesigner实例`readEditingState()/captureContent()`及`editingStateChange`；FormManager新增`readEditingState(): FormDesignerEditingState | null`与nullable状态转发，关闭授权按§4.4，`editingMode`精确为legacy|retained。P2复用同一状态控制器，P3复用busy/版本状态，不另造输入事实源。

- [ ] 先写状态/真实组件失败用例：`pending_number_text_survives_navigation`、`partial_date_does_not_normalize_on_blur`、`valid_echo_pending_blocks_capture`、`composition_end_same_tick_is_blocked`、`foreign_editor_keeps_focus`、`deleted_field_lifetime_never_reuses_raw`。
- [ ] RED中明确断言实际mode为retained，避免未知prop被当HTML attr忽略；数字`-`必须真在文本控件raw中，不能把空value+badInput消失记成保持。
- [ ] 实现每实例控制器与自有默认值编辑器；以公开prop回显确认合法值已进入规则，中间原文继续留缓存。沿用原props/规则开放范围，不改schema来接纳中间串。
- [ ] 实现三个DTO的根导出及mode固定、只读/捕获API；成对出口捕获前后复验本地revision，blocked不序列化/不写session。FormManager精确显示retained阻断原因；旧方法签名和legacy默认行为不变，retained按规格§4.4协调关闭。
- [ ] 先写`manager_retained_query_and_forward`、`manager_suspend_is_not_discard`、`manager_ime_escape_keeps_editor`、`manager_dismiss_requires_discard`、`manager_late_discard_rejected`、`manager_old_editor_state_dropped`、`manager_busy_close_gesture_cannot_blur_then_close`、`manager_old_close_request_cannot_target_reopened_editor`、`legacy_dialog_dismiss_unchanged` RED；使用真实FormManager/Dialog/FormDesigner，不能只测新状态机或capture返回值。
- [ ] 实现FormManager只读代理/当前子状态转发：会话未就绪/收尾中返回not-ready快照，完全无编辑器才null；使用内部唯一editorInstanceKey丢弃旧子状态/save/cancel/旧关闭null，即使formId相同也不复用。查询/转发不发draftChange、不确认保存。
- [ ] retained明确禁用Dialog自动Escape关闭，X/遮罩/取消触发先于blur执行pointerdown/键盘状态检查，拒绝后续click；公共before-close、表单cancel及程序化关闭统一走授权入口。before-close并非万能拦截器；不得用canSuspend/canCapture或v-model=false直接放行销毁，FormManager不在本片实现K隐藏。
- [ ] 按§4.4优先级保留IME/内部弹层的Escape语义，组合/拖中/unknown等忙碌关闭不弹抢焦点确认；空闲Escape也不关闭。P3尚未支持时，拖动Escape不得调用不存在的取消API或退化为关闭表单。
- [ ] 普通未完成原文可进入“继续编辑/放弃并关闭”的统一确认，不先序列化/写会话；拒绝、关闭确认或异常都保留同一实例。请求入口绑定事件所属key；nextTick等所有等待后先核对该key/模式，肯定答复后再复验key/revision/就绪状态，过期答复不生效；最终复验到内部一次性授权关闭无await、无对外bypass。
- [ ] 成功提交仅在既有捕获/内容守卫与当前会话检查成功后关闭；blocked/failed继续打开。授权销毁先使旧回调失效，收尾null不能清空新实例；显式放弃只丢当前raw，不发updateContent/save，不改另一表单或持久化状态。父级破坏性卸载/替换须先遵守宿主确认，不宣称Dialog可拦强制unmount。
- [ ] 实验宿主在pointerdown/快捷键前查canSuspend；普通中间输入可K隐藏并保留，busy阻止破坏性切换。UI收集可先nextTick，再重读状态并进入既有controller.prepare；不改EditorAdapter同步合同。
- [ ] 实跑B03-N01–N08、H01–H03及M01–M08的数值/日期与关闭保护子项；M05先验未支持取消时Dialog也不误关。文本子项由P2补、真实取消由P3补，未执行子项保持待执行，不计通过也不反向阻止P1交付。第一/第二活对象故障保留adapter/lease，显式断言故障方法计数和顺序、两份输入、persist=0、修正后的最新候选；不能重复C的假覆盖。
- [ ] 复验legacy未传mode时的真实export/save/cancel与全部旧断言。只读查询、纯K切换不touch；busy期间不展示当前校验通过，捕获不当作持久化。
- [ ] 提交`fix(form-create): 显式保留数值日期中间输入并保护捕获`，记录允许模式、I01/自定义格式边界与未验证项。

**Run:** `pnpm --filter @flowduet/form-create exec vitest run src/editor-input-state.test.ts src/components.test.ts`；`pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts probes/stage-zero/contracts/validation.test.ts probes/stage-zero/contracts/error-boundary.test.ts`；新UI经真实浏览器、1440×1000/DPR1、顶层/列内和3轮关键轨迹。

**Expected:** 数值/日期原文在K切换后逐字保持，非法中间输入明确blocked，合法number/date及未编辑I01往返保持；两份候选故障零live写入；真实FormManager的状态/关闭/重开符合上述本片M子项，legacy默认回归无变化；不宣称P2文本或P3真实取消子项已通过。未取得OS证据不勾V01。覆盖Review Focus 1–4。

### Task 3（P2）：文字显式空串与未设置

**Files:** Create: `packages/form-create/src/components/TextDefaultEditor.vue`、`text-defaults.ts`、`text-defaults.test.ts`。Modify: `components/designer-config.ts`、`components/FormDesigner.vue`、`components.test.ts`及P1的`editor-input-state.ts`（均在form-create/src）。只有确需共享递归才局部调整`checkbox-defaults.ts`及其测试，保留旧语义。扩展form-repair样稿、存在性cases和证据。

**Interfaces:** 消费P1每实例存在性/生命周期；产出文本的prepare/restore内部函数及retained默认值开关，精确为`prepareTextDefaults(rules: FieldRule[]): void`/`restoreTextDefaults(rules: FieldRule[]): void`。只原位处理现有checkbox helper刚解析出的临时数组，不能传live session引用。内部常量`TEXT_DEFAULT_STATE`取`__flowduetTextDefault`；prepare剥除外部同名标记后依据真实value添加编辑标记，restore恢复存在性并在序列化前移除新标记；原始规则仍走既有parseFormRules/props守卫。

- [ ] 写失败用例`explicit_empty_text_survives_clear/reopen`、`untouched_missing_text_stays_absent`、`text_presence_switch_distinguishes_unset`、`text_marker_never_leaks_or_overrides_import`。手写期望：`Object.hasOwn(rule,"value")===true && rule.value===""`，未设置必须false。
- [ ] 在retained配置中接入自有TextDefaultEditor和F01/F02存在性开关；非空清空仍显式空串，关闭开关才未设置。加载不信外部编辑标记，以实际value为准。
- [ ] 在成对捕获出口组合既有checkbox与新文本准备/恢复，不把新标记/raw放文档；不做全字段value补全或全局JSON替换。
- [ ] 测顶层/列内、两表单切换、保存重开、显式还原/删除重建；测0、false、[]、radio/select的number0/string0、选项顺序无回归。
- [ ] legacy默认路径保持旧行为，本片结果只计retained；旧C失败文件不改写。提交`fix(form-create): 区分文本空默认值与未设置`。

**Run:** `pnpm --filter @flowduet/form-create exec vitest run src/components/text-defaults.test.ts src/components/checkbox-defaults.test.ts src/components.test.ts src/document.test.ts`，并真实浏览器B03-T01–T04、N08/H02，补验空串可捕获但未获放弃授权时X/遮罩仍不销毁（M02/M03/M07）。

**Expected:** 原4条文字失败在retained转绿；所有新增提供者标记从编辑器输出消失，文档版本和checkbox默认[]合同不变。覆盖Review Focus 2/4。

### Task 4（P3）：先过非重建取消门，再谈取消实现

**Files:** 先仅Create: `apps/playground/probes/stage-zero/form-repair/drag-seam-proof.ts`、`docs/design/system-v1/probes/b03-drag-seam.md`及证据。仅门通过后才Create: `packages/form-create/src/components/drag-transaction.ts`、`drag-transaction.test.ts`，Modify: `FormDesigner.vue`、`editor-input-state.ts`、`editor-state.ts`/`index.ts`及对应真实组件测试和form-repair接线。

**Interfaces:** 消费P1的独有owner、busy/版本、FormManager关闭守卫/状态转发和已保留原文，及锁定提供者真正公开的生命周期/提交控制。门通过后产出提案§5.2准确声明的`requestDragCancel(): FormDesignerDragCancelResult`、EditingState可选dragCancellation及对应状态事件；requested不是成功。匹配transactionId并核验cancelled；不暴露供应商句柄或内部树。

- [ ] 先以C原失败动作写`escape_cancel_does_not_insert_or_reorder`和`cancel_keeps_pending_input` RED；真实拖动到画布/col，再Escape和迟到mouseup，核对树和原文，不只看事件/拖影。
- [ ] 只验证公开非重建通道：菜单新增、已有节点排序/跨列均能取消，能取得本实例明确结束，且不破坏P1/P2原文/存在性/字段身份。FcTree的取消不作为画布证明。
- [ ] 若缺任何通道，输出具体缺失事件/提交钩子、可复现样本及下一份需审阅的接缝建议；本Task停止，不创建生产drag-transaction或成功取消API，不用setRule/私有Sortable/换依赖替代。
- [ ] 门通过时先写`cancel_request_is_not_completion`、`late_drop_after_cancel_is_rejected`、`old_transaction_cannot_finish_new_drag`、`uncertain_end_blocks_capture`、`other_instance_is_untouched`和`manager_drag_escape_cannot_close_dialog` RED，再实现最小事务状态机。
- [ ] 接入Escape服从规格§4.4：先IME/归属明确弹层，再本实例活动拖动；FormManager不自动关闭，结构比较与已有raw/选中字段/焦点核验通过后才确认取消。未知/失败保留比较并阻断，不回滚失效租约或替换整个文档。
- [ ] 完整B03-D01–D05和M04/M05；菜单八字段×顶层/列内、跨列/排序/禁嵌套、取消关键轨迹3轮。native pointercancel无工具则保持未知；注入pointercancel只计协议。
- [ ] 通过时提交`fix(form-create): 核验拖动取消事务与迟到提交`；停止时只提交`docs(design): 记录B03拖拽公开接缝阻断`，不把停止产物叫修复完成。

**Run:** 门阶段经专用真实浏览器；实现阶段再跑`pnpm --filter @flowduet/form-create exec vitest run src/components/drag-transaction.test.ts src/components.test.ts`及既有候选/新取消cases。

**Expected:** 公开原位取消被实证且D行通过，或明确P3受阻。两种结果不混记；受阻时B03依旧阻断，P4只可归档部分成果。覆盖Review Focus 1/2/5，M05分别记录“Dialog未误关”与“真实取消”，不能用前者冒充后者。

### Task 5（P4）：最终重放、复核与有边界的验收

**Files:** Create: `docs/design/system-v1/probes/b03-production-repair-acceptance.md`、独立evidence目录/manifest。Modify:阶段零README/当前结果索引；不改C历史归档。

**Interfaces:** 消费P0门和N/T/D/H/M/V逐行记录；产出固定实现head、模式/策略范围、原始动作/前后五层状态、命令/退出码和SHA256。P3或V未知必须维持B03阻断。

- [ ] 冻结最终源码与环境，审计每个适用行的actualMode为retained且K；R不执行、不计通过，legacy只按兼容范围回归。
- [ ] 在最终源码重放本轮全部声称通过的真实UI行。原C19条失败逐项映射；未执行/条件未满足/自然未验证均不勾通过。更新只读/异常/跨实例边界而不是重写历史。
- [ ] 原样执行下列四命令，统计实际新增数量，不预填总数；若默认全量失败，保留并转相应片/APP-T，不改时限或删断言。单项补修后按真实改动复验。
- [ ] 对最终范围完成一次独立Standards/Spec复核，重点核对五项Review Focus、公开API/legacy边界、mode命中、首尾故障真的执行、FormManager关闭授权/旧回调隔离/Escape优先级及取消不走重建；亲跑和核读分列。发现Important先RED→GREEN并默认全量；补修不冒充独立再审。
- [ ] 按规格裁定锁定范围：N/T/D/H/M通过不自动豁免OS/native/ERR05未知，不改变B01/B04，不授权工作台。
- [ ] 归档原始负/正文件与Git blob/SHA核验，清理自己启动的浏览器/服务，保留工作树，提交`docs(design): 归档B03最小修复与剩余验收边界`。不推送、不发版。

```sh
pnpm test
pnpm build
pnpm lint
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

**Expected:** 四命令退出0只是本地回归条件；各适用真实行及V01证据满足、维护者确认范围后才解除B03。远端Node22/24须未来另获推送授权后核对，不以本地结果代替。

## APP-T 独立跟踪项与责任

APP-T不属于上述实施步骤，也不因B03方案通过就获得旧App文件修改授权。建议下一次单独任务先定位`App.integration.test.ts:68/:1640`等默认超时，保留原文件和默认5秒，按mount/异步等待/导出/Popper/卸载分段，原生路径与诊断路径对照；没有根因证据不复制字符串兼容或改worker。

验收条件：目标用例多轮、整文件、原样默认全量实际通过；完整业务断言与真实FormCreate不变；描述符、异常、迟到任务及卸载清理复验。若需修复，由代理先出单文件最小方案，维护者确认后另行实施，独立提交/证据，不混入B03业务修复计数。

## 本轮交付与授权

本轮只做源码核读、方案/计划编写和文档自审；没有实现上述组件、方法或测试，没有重跑生产/浏览器功能验证。维护者下一步审阅两份文档及P0/P3门、显式retained范围、FormManager状态转发/关闭授权/Escape差异，确认后再选择本会话逐片或逐片代理方式。原C的748/748仅是历史基线，不当作本提案已实现/已通过的证明。

## 本次复审P2的修订对照

| 复审缺项                                                          | 规格合同                                                    | 计划归属/验收                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 外部宿主拿不到FormManager当前子状态，旧实例晚到回调可能污染新状态 | §4.4.1只读nullable代理、editingStateChange转发与唯一实例key | P1；M01/M06                                                     |
| canSuspend被误当可销毁，Dialog原有关闭路径仍可丢raw               | §4.4.2三种动作、统一一次性关闭授权及父级责任                | P0公开接线门、P1实现；M02/M03/M06/M07                           |
| 拖动/组合Escape可能顺带关闭Dialog                                 | §4.4.3关闭自动Escape、IME/弹层/拖动/空闲优先级              | P1先保护关闭，P3再验证取消；M04/M05                             |
| 仅捕获出口验证不足以证明关闭安全及legacy不变                      | §7新增M01–M08，与H02分工                                    | P1/P2/P3对应真实FormManager轨迹，P4最终重放/复核；M08覆盖legacy |

本次只做文档修订、自审及本地提交，没有执行上述RED/GREEN、真实浏览器/OS或新默认全量；该表是计划覆盖，不是新增通过记录。
