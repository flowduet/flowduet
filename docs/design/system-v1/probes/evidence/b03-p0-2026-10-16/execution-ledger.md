# SDD ledger — plan: docs/design/plans/2026-10-16-b03-minimal-production-fixes.md

Scope: 本次仅Task 1/P0；P1–P4未授权，不自动推进。
BASE: aaf7da69ca8d9ac63d0ef943cdb4f682a4b23aca
Branch: refactor/b03-default-editor-seams
Ruling: 最新origin/develop=10b2a13，C依赖未合入；用户问题卡已明确授权从aaf7da6切独立P0分支，不默默cherry-pick，也不推送。代价：P0证据适用含C的此基线，不能声称最新develop单独可复现。
Pre-flight: P0产出owner/字段token/删除/回显/日历/Dialog公开接缝证据，P1消费；P0任一必要门不满足即停止，不实现生产缓存或API。P3原位拖动取消不在P0实现，但drag忙碌可识别性须记录。
Task 1: in_progress; baseline pnpm test running.

Task 1: baseline pnpm test → exit 1，App.integration.test.ts:68“插入抄送草稿后自动与手动导出均报错，配置收件人后自动恢复 XML”默认5秒超时；core148/designer184/form-create137通过，Playground278通过1失败。APP-T独立，用户方案已规定保留并继续采证，不修旧测试。
Task 1: RED生产legacy数字/日期×顶层/列内×3轮=12/12反例，原始日志已归档。没有生产修复，RED不要求转绿。
Task 1: 公开注入/切字段sourceRef/跨实例/clone/同步回显/卸载13条通过；日期I01六形态×两布局12条及日历两格式×3轮6条通过。
Task 1: 观察器修正：最初按field索引会误读改名后的source；改成Set<sourceRef>、事件时即时释放观察引用，保留失败日志。不是产品生命期实现。
Task 1: 样稿UI早选triggerActive/ElSelect占位点击造成工具错误，保留原始日志，采用真实卡片/可点击占位重新操作；不能用这些日志声称能力失败或通过。

Task 1: complete (source commits aaf7da6..dbb011a; tests: pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts →104/104; pnpm test →750/750; build/lint/strict exit0)。测试后源码与dbb011a逐字一致，无为记账额外重跑同命令。
Task 1: final browser 102目录行=88通过/12生产负例/2未知；原始证据与源码hash核验。busy和Composition来源单列；B03保持阻断。
Final review: fresh-context reviewer 可报告问题0，独立亲跑映射/哈希，不声称亲跑浏览器/测试。
Final: Ruling: P1 raw/capture/双对象故障/租约未实现 — 仅接缝可行性 — 代价为P1真实回归仍须完整RED→GREEN。
Final: Ruling: FormManager实例key/异步确认/旧回调属P1 — 样稿不冒称产品保护 — 代价为M01–M08仍待完整实现验证。
Final: Ruling: 键盘Enter与指针早于blur证据不推广到Tab/OS组合 — 保留真实焦点路径边界 — 代价为P1须补验证而不能降低输入合同。
Final: Ruling: 原位拖动取消/迟到drop属P3 — busy可识别不代表取消成功 — 代价为P3必须另过门。
Final: Ruling: OS/native/ERR05/APP-T未闭环 — 不以协议与末次绿色推导解决 — 代价为B03保持阻断且APP-T独立。
Deferred minors: none.
P1–P4未执行；保留本计划账本供以后明确授权后续片，不宣称整份计划完成。
