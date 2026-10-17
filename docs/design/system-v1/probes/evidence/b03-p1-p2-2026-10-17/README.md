# B03 P1 三项 P2 补修证据（2026-10-17）

补修基线 `ee0d126`；第一份固定源码 `978e957c8cd4977d71b24a5f036ecf84effd97b4`，独立Spec发现同类数值归一边界后补修为最终生产源码 `78a7a786e5657647104fb35144f44d65ec6759f3`；最后测试为 `0851e17`（包含9aad最小夹具及原双Dialog分阶段准备），运行时96文件与78完全相同。整体P1基线仍是 `develop@56d9e07`，未 rebase、未推送。验收结论见[补修报告](../../b03-p1-p2-followup.md)。

## 目录与来源

- `verification/`：正式RED、定向GREEN、默认全量、build/lint/strict/ESM与App独立复验。`full.log`为978源码的首轮默认全量，843通过、1项App抄送用例默认5秒超时；`full-final.log`为78的新增delete用例5秒超时；`full-after-harness.log`为2bb等待助手试验触发旧字段复用等待断言失败。它们均不可当成通过，后两次停止在form-create，未运行Playground。
- `history/`：未提交中间态与搭建诊断。首次deleteRule不存在只算测试错误；后改为真实删除按钮所得`red-components-final.log`才是正式RED。初轮前置清理时序仍失败、native badInput误放行、原有日期单次默认超时等原始记录均保留。未为每个中间工作树签发Git pin，不冒充最终运行源码。
- `replay/`：978源码完整125行浏览器重放，属于补修前一轮历史。`replay-final/`：78a7a78源码完整125行重放（68数值日期、21候选、21Dialog、6日历/快捷键、9双Dialog/Tab/拖动保护）；均检查pass=true及运行前后源码字节一致。两轮不能累计成250种场景。
- `recovery-78.json`及对应CLI日志：最终源码顶层/列内各3轮，恢复标题原值且input/input/blur无change，以及native number badInput/修正恢复，共12行。`normalize-78.json`：最终源码普通Chrome fill→Tab数值01归一为1并可捕获的正向对照。首次恢复驱动未等字段属性首次回填便读初值，断言失败，但产品捕获和事件轨迹正确；该诊断在history，最终驱动先等实际标题回填，不写DOM恢复值。
- `review/`与`independent-review.md`：独立双轴复核边界；含Spec发现的真实组件归一失败日志及最终14条GREEN。部分独立检查仅有工具输出或报告，无单独stdout，已明确列出，不补造原始日志。
- `runtime-sources.json`：978源码96个.ts/.vue文件快照；`runtime-final-sources.json`：最终78源码同一96文件；`test-final-sources.json`：78阶段2份测试；`test-final-minimal-sources.json`：9aad阶段2份测试。`test-after-harness-sources.json`是已回撤助手试验2bb的历史快照；`test-delivery-sources.json`为最终0851e17测试。SHA256/bytes/Git blob逐项核对，不是浏览器网络资源追踪，也不包含CSS/node_modules。依赖与lockfile未改。
- `scripts/`：新增恢复/badInput/归一驱动及当时的extra编排。extra编排带当时/tmp路径，仅用于审计，迁移需改路径。原5批驱动与可移植replay.py复用10月16日已提交脚本，未复制改写历史。`manifest.json`覆盖本目录全部普通文件（自身除外）；最终提交前逐项核验。

真实浏览器：Chrome155、1440×1000、DPR1、macOS15.6；本地Node24.16.0/pnpm10.26.1。没有远端Node22/24 CI，也不声称其他OS/浏览器通过。

## 复验入口

先启动专用Vite，再在新目录重放；脚本拒绝覆盖已有输出。该脚本只对本轮固定的96源码集合建快照，不自动承诺未来新增模块的覆盖。

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1 --port 5178 --strictPort
python3 docs/design/system-v1/probes/evidence/b03-p1-2026-10-16/scripts/replay.py --output /tmp/b03-new-replay --session b03-new-replay
```

恢复矩阵通过Playwright CLI的run-code/filename运行`scripts/recovery.js.txt`，归一对照紧接其后运行normalize.js.txt。保留第三方beforeunload，每批独立context；不删除提供者hook、不合成OS输入法或native pointercancel、不用setRule重建取消。删除/clear、同步capture重入和模式变更重开主要是模拟DOM下真实组件的公开协议证据，不能改称自然浏览器全链路或OS证据。

## 出口边界

默认5秒、真实FormCreate、App原业务断言均未改。原日期超时与APP-T首轮失败不因后续绿色被抹去；未做时序根因修复。文字显式空串、非重建拖拽取消、OS IME/native pointercancel、ERR05自然失败仍欠验，B03及阶段零出口继续阻断。拖动Escape保护Dialog与原文不等于取消成功；R不采用，D/E和正式工作台未推进。

测试接缝诊断仅位于history：包含单次提前选择失败、画布等待版本、active回执版本的失败。2bb的选择助手修改最终回撤；9aad仅保留delete/clear单数字字段最小夹具，原断言、默认5秒与真实provider不变。前后次数及耗时小样本不能证明整体超时根因或根治。

最终默认`pnpm test`为`verification/full-delivery.log`，退出1、841/845通过：core148/designer184/form-create216全过，Playground293过/4失败。含App68与1640的两项5秒超时、App213非超时审批人断言失败，以及location42的5秒超时。App213单项复验通过，不能据此排除组合回归或认定与前序超时同因。P1验收不恢复，B03继续阻断。

构建体积及Vite sourcemap调试告警原样保留，不能用它们证明ERR05自然业务异常已验证。
