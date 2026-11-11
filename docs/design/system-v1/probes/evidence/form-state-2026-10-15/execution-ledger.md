# SDD ledger — plan: docs/design/plans/2026-10-15-stage-zero-form-state-slices.md

授权：用户确认7e5b520方案/计划/唯一私有checkPreparedCandidate接缝及本会话C0→C5，末尾一次独立复核。禁止产品源码、D/E、推送。
基线：origin/develop=10b2a136c7a2d75065b2f6155a19a9dc5aa646da；批准文档7e5b520迁入为7e4fd3b。原主检出和其他工作树不动。
Pre-flight C0→C1：八字段/布局/I01夹具 + 只读观察/语义比较，同一typed-default/presence口径。
Pre-flight C0→C2→C4：LiveState/RetentionHost/targetKey及真实EditorLease共享；不能把实例标签当租约。
Pre-flight C2/C3→C4：composition/drag/owner不明须回退K；B openEditor在prepare前；临时实例不得touch/stage/register。
Pre-flight C4→C5：候选gate复用WeakMap+stamp；ERR07移交后不回滚旧租约；天然/OS/原生拖拽未验证不通过。
Ruling: 工具任务1..6映射C0..C5；原计划C标题不匹配task-start提取器，保存同文brief并手工记录BASE，task-done仍使用原plan身份 — 不改已批准计划编号；误判代价为账本映射错误，末尾逐片对账。
Ruling: C的真实产品/上游差异只归档失败证据，不越白名单修复；继续不依赖该失败的实验，不能将受阻的验收项勾通过 — 规格允许负证据交付；误判代价是错误提升B03，最后矩阵强制保留失败/未知。
Task 1: Ruling: 原生设计器属性面板在HappyDOM的新增测试经历未就绪断言/卸载后hidden错误与5秒等待超时；不放宽时限或复制toString补丁。保留源和两次负输出，以原生DOM验证只读观察、真实FormDesigner验证装载，实际面板/焦点业务断言迁到浏览器C0/C2 — 避免模拟DOM时序伪证；误判代价是浏览器未跑会漏覆盖，矩阵与C01禁止以这13项冒充原生通过。
Task 1 evidence: baseline657/657+strict0；C0缺模块RED；语义/原生DOM观察/真实空设计器装载13GREEN。真实Chromium八类属性入口及只读焦点/选区/session/版本不变已验证；blank页批次重新确认URL后复跑，不算产品失败。C0完整盘点见C0-inventory-final.log/json；未据入口声明B03通过。
Task 1: complete (commits 7e4fd3b..0b2d70f, tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state.test.ts --reporter=verbose →    Duration  5.40s (tests 46%, import 40%, environment 10%, transform 3%))
Task 2: Ruling: 当前FieldInput的字段ID实测disabled+readonly，源组件fieldReadonly/disabled支持该状态。编辑该ID按不适用登记，改验ID往返不变；不启用上游配置或去掉disabled — C0允许按实际入口冻结；误判代价为漏掉真正可达入口，保留DOM属性与上游源码供独立复核。
Task 2: Ruling: C1真实选择后aria-expanded=false但退场动画DOM仍在，新观察器误挡捕获；在本片修复自有observer而非生产弹层/主题，新增closed-popover RED→GREEN并复跑真实UI — 它是C0观察前提的实现遗漏；误判代价为漏掉仍未提交输入，已同时断言aria-expanded=true继续保留。
Task 2 evidence: 64加载K行通过；34实际编辑/清空行30通过4失败；24选项增删/值类型行通过。F01/F02清空删除value，与明确空串合同不等，保存真实负记录，不修生产、不提升C02/B03。Field ID只读、选项无排序按钮不适用有DOM/源依据。C2协议代码仍未纳入本片提交。
Task 2: complete (commits 0b2d70f..c501789, tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state.test.ts --reporter=verbose →    Duration  4.58s (tests 43%, import 32%, transform 17%, environment 8%))
Task 3: Ruling: 私有LiveState补badInput布尔及input-boundary辅助文件 — number原生中间串`-`的value为空，必须在导出前拒绝；Alt+O拦截穿透以保证观察只读 — 误判代价为漏采合法输入，保留ready/非法两端回归和真实DOM轨迹。
Task 3 evidence: 47定向GREEN、strict退出0；3轮真实双表单/阶段/shortcut无session写入；3轮CompositionEvent协议拒绝中间态/nextTick后恢复。OS IME工具阻断，foreign popup为DOM协议证据。C2-navigation.json及focus-after.json保留。
Task 3: complete (commits c501789..48d890e, tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state.test.ts probes/stage-zero/form-state/retention-policy.test.ts probes/stage-zero/form-state/input-boundary.test.ts --reporter=verbose →    Duration  4.77s (import 41%, tests 30%, environment 15%, transform 14%, worker 1%))
Task 4: Ruling: 原生dragstart/dragend观察拆入drag-boundary，pointercancel未观测结束不解除保护 — 不使用draftChange或拖影猜稳定，不改上游 — 误判代价是未结束轨迹需重置，保留不确定证据。
Task 4 evidence: RED缺模块→2GREEN；16原生菜单drop通过，L01手柄跨列/排序/建行/禁嵌套通过，拖出有效区3轮恢复；Escape3轮仍添加字段为失败。pointercancel只有协议未有OS/native证据。C3-drag.json/C3-layout-confirmed.json；工具错入口历史保留。
Task 4: complete (commits 48d890e..eb3773b, tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/form-state/drag-boundary.test.ts probes/stage-zero/form-state/retention-policy.test.ts →    Duration  2.90s (import 47%, transform 27%, environment 24%, tests 1%, worker 1%))
Task 5: Ruling: R测试宿主拆test-host/rebuild-policy，真实组件卸载测试放editor-recovery；全对象候选故障不假装FormCreate异常 — 隔离协议与真实库证据 — 误判代价是遗漏真实状态，最终原生逐行复放并保留ERR05未验。
Task 5: Ruling: HappyDOM真实配对导出默认5秒超时，不加shim或时限；保留负源/日志，真实导出和R对照迁Chromium，单元验真实卸载null — 延续C0批准边界 — 误判代价是浏览器覆盖不足，R实际均拒绝不宣告通过。
Task 5: Ruling: 复用rulesSemantics之外加info/额外属性投影并RED→GREEN — 既有辅助只投影常用字段不足以授权销毁源实例 — 误判代价是保守拒绝更多R，优先保留输入，不改生产。
Task 5 evidence: gate RED→36GREEN；R协议RED28→32GREEN、最终9文件119GREEN+strict0。真实32选中K/R行（16K/16fallback）、16无选中R fallback、3纠错通过；ERR05未复现。R没有真实通过行，不能推荐采用。前置结构/宿主持久化边界未动。
Task 5: complete (commits eb3773b..a75dca7, tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts probes/stage-zero/contracts/validation.test.ts probes/stage-zero/contracts/error-boundary.test.ts probes/stage-zero/form-state/retention-policy.test.ts probes/stage-zero/form-state/rebuild-policy.test.ts probes/stage-zero/editor-recovery.test.ts probes/stage-zero/form-state.test.ts probes/stage-zero/form-state/input-boundary.test.ts probes/stage-zero/form-state/drag-boundary.test.ts →    Duration  8.30s (import 43%, tests 23%, environment 19%, transform 14%))
Task 6: Ruling: 最终浏览器显式固定1440x1000/DPR1重跑；前次headed viewport为null，仅作为历史 — 避免把未锁定窗口当规格环境 — 误判代价为需重复矩阵，保留两轮而不覆盖历史。
Task 6: Ruling: pending F08首次定位跨两个已挂载面板导致strict错误，改限当前可见view重跑；load等待改resultSequence — 探针脚本修正不是产品修复 — 误判代价是漏查隐藏输入，仍独立核对A/B保留及全部活编辑器捕获。
Task 6 evidence: runtime pin c82aed5；此后仅补3条恢复竞态/同步无回调覆盖（35GREEN），运行时文件不变。最终以final-v1440目录为有效原生矩阵，旧final目录仅历史。K发现number中间badInput丢失/date中间串被归一；不越生产白名单修复。
Task 6: Ruling: C5依据默认全量两个新增真实装载超时，改为仅两个用例作用域的浏览器Element.toString语义，finally卸载后恢复完整描述符/继承状态；不改库/序列化/全局setup/默认5秒 — 实测Popper4694次调用1603ms→2.3ms，卸载约20ms — 误判代价是模拟DOM语义掩盖浏览器差异，仍以Chromium验证且三种恢复回归独立覆盖；该决定取代早期C0/C4“不增兼容”的当时策略。
Task 6: Ruling: 新增纯协议/DOM用例归并为既有C测试入口的.cases.ts，不删断言；原始脚本以.js.txt存档避免根lint把证据当代码 — 全量第二次仍有3既有用例近5秒超时，减少新增worker及重复装载，不修改旧测试或全局配置 — 误判代价是并发隔离覆盖变窄，关键双控制器/异步竞态断言不删，重新执行默认全量。
Task 6 evidence: 排除新增C三入口的诊断190/190通过（不是默认全量）；最终归为一个form-state.test.ts入口，89条原断言均保留且定向GREEN。关闭自建flowduet-c浏览器；核对5173进程11978的Vite参数及cwd为本工作树后仅TERM该进程，不动其他服务。随后原样默认全量复跑，不能把排除诊断当通过。
Task 6: Ruling: 默认全量仅既有App用例仍约5.27秒；最终将89条C用例由既有contracts/candidate.test.ts导入，保持与190项对照相同worker数量，不加worker或修改既有App测试 — 125项候选/验证/边界+C定向GREEN；新的原样全量运行中 — 误判代价是C的独立文件执行隔离减少，保留全部跨实例/版本/清理断言，真实浏览器矩阵不受影响。
Task 6: Ruling: C5所列独立复核与执行技能要求的末尾整分支复核合并为一次，源实现/测试冻结65aef38后调度；当前最终命令运行完再补证据，不做重复整分支review — 用户明确只要末尾一次 — 误判代价是后续补修没有独立再审，按RED→GREEN+默认全量覆盖并明确由作者验证。
Final: fixed Important首对象七类捕获假覆盖 — faultCaptures计数7RED（首对象）/7GREEN（尾对象）→保留原adapter与租约注入、两份活输入/调用顺序/错误原因/重试14GREEN；默认全量在c53004e重新运行，尚不宣告全绿。
Final: Ruling: 审阅者不代判的生产差异/R采用/OS和native环境，保留已批准白名单与B03阻断，下一轮先提案；默认全量超时单列C08，不因排除对照通过而抹绿 — 无生产修复授权且根因未完 — 误判代价是验收不能解除，给出精确日志与待做对象。
Final: fixed Important首对象假覆盖 — final-review-P2-red.log 7失败/7通过→final-review-P2-green.log首尾14/14通过；c53004e原样pnpm test 748/748（正式513/探针235），build/lint/strict均0。独立报告只审65aef38，作者补修无第二次review；历史App默认超时保留，最终通过不等于其计时根因已证明闭环。
Task 6: Ruling: C5完成门用原样四命令实际输出、源码/文件哈希及Git blob审计，不为填写账本再无理由重复全量 — 最新c53004e已全绿，此后仅文档/证据归档 — 误判代价为文档后夹带源码；审计强制对c53004e源码逐文件字节一致、工作树范围和最终lint。
Task 6: complete (commits a75dca7..c53004e, tests: python3 .superpowers/sdd/2026-10-15-stage-zero-form-state-slices/audit.py → audit passed: 294 evidence files, 20 pinned source files; 748/748 and four checks exit0; B03 blocked)
