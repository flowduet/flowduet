# FormManager 默认时限回归与清理验证

日期：2026-10-15。施工基线`f139036`，单文件修复提交`c6fa670`，沿用`refactor/stage-zero-editing-contract`。本轮仅实施已批准的单文件方案；未推进C/D/E、正式工作台或推送。

**默认`pnpm test`已657/657通过，解除此前B02验收附带的本地20秒运行条件。** B02仍只代表候选编辑/定位及冲突恢复合同，B05仍只覆盖锁定版本的严格入口；B01/B03/B04和阶段零整体出口不变。此前独立复核的范围不扩大，本轮没有新增独立全审或远端CI结论。

## 1. 根因与处理边界

前轮只读诊断确认：真实FormCreate/Element Plus初始化进入Popper窗口判别，调用元素`toString()`；Happy DOM 20.14.5返回`outerHTML`，导致重复整树序列化。Chromium同类调用返回元素类型标识。CPU采样中`serializeToString`约1969ms、属性编码约488ms，已归档[依赖源码摘录](evidence/formmanager-default-2026-10-15/diagnosis/dependency-excerpts.json)、[调用栈摘录](evidence/formmanager-default-2026-10-15/diagnosis/popper-serialization-stacks.json)、[浏览器对照](evidence/formmanager-default-2026-10-15/diagnosis/dom-chromium.txt)与[诊断记录](evidence/formmanager-default-2026-10-15/diagnosis/diagnosis.txt)。原始17MB CPU profile保留在本地临时路径；仓库仅归档摘要、关键栈与其SHA256，不将该原始文件视为可携带成果。

诊断分段显示：FormManager空壳初始化5–35ms，真实编辑器打开1.25–1.99s、首次异步刷新0.65–1.03s且CPU接近墙钟时间；业务守卫小于3ms，正常卸载13–22ms。`flushPromises`等待的是排队的DOM/Popper计算，不是业务守卫长期空等。第一项原用局部manager且仅在测试尾部卸载，失败时公共afterEach无法清理，另有独立的异常清理缺口。

这能证明可移除的模拟DOM开销与清理缺陷；不能证明每次历史5秒尖峰只有同一个原因，也不能把第二项的历史超时全部归因于首项泄漏。前轮原版也曾默认通过，负证据和这种不稳定性都保留。

补丁只改`packages/form-create/src/components.test.ts`，28行增加、6行删除：

- beforeEach保存`Element.prototype.toString`原描述符，临时采用`Object.prototype.toString`，对齐浏览器的元素字符串语义；afterEach恢复原描述符，原来无自有属性时删除临时属性。范围只在本测试文件，不改仓库全局配置。
- 首项FormManager交给公共wrapper管理，afterEach使用finally清空wrapper、DOM并恢复兼容处理；不依赖测试尾部手动卸载。
- 保留真实FormManager/FormDesigner/FcDesigner和原有全部业务断言；137条原expect语句均保留，只增加两条真实FormCreate菜单在场断言。没有组件桩、伪造序列化结果、依赖升级、产品代码改动或测试时限调整。精确批准补丁和[范围核对](evidence/formmanager-default-2026-10-15/scope-check.json)已归档。

## 2. 默认5秒回归

命令使用仓库原配置，无`--testTimeout`参数；计时轮次顺序运行，不同时跑构建或浏览器实验。时长为Vitest报告的单用例耗时，不是进程总耗时。

| 轮次 | 超范围字段守卫 | 重复字段标识 | 结果    |
| ---- | -------------- | ------------ | ------- |
| 1    | 809ms          | 636ms        | 2/2通过 |
| 2    | 845ms          | 544ms        | 2/2通过 |
| 3    | 906ms          | 543ms        | 2/2通过 |
| 4    | 818ms          | 554ms        | 2/2通过 |
| 5    | 843ms          | 580ms        | 2/2通过 |

- 整文件两轮均34/34通过，Vitest总时长13.42s、14.09s；每个用例仍为默认5秒，未把整文件时长当单用例时限。
- 原样`pnpm test`退出0：core148、designer184、form-create137、Playground188，共657项；正式513、探针144，计数没有增加。前置结构、保存重开三档转单签、错误方向引用拒绝及A/B补修回归都随该命令执行。
- Playground既有真实FormCreate集成用例仍有原先批准的单例60秒时限；它不属于本文件，也未修改。默认全量通过不等于所有仓库用例都统一5秒。
- 完整日志见[全量](evidence/formmanager-default-2026-10-15/full-default.log)、[多轮命令与退出码](evidence/formmanager-default-2026-10-15/target-file-runs.json)。本地Node24.16.0、pnpm10.26.1；未运行远端Node22/24 CI。

```sh
pnpm --filter @flowduet/form-create exec vitest run src/components.test.ts -t '内容守卫前置|重复字段标识不能' --reporter=verbose
pnpm --filter @flowduet/form-create exec vitest run src/components.test.ts --reporter=verbose
pnpm test
```

## 3. 描述符恢复与异常清理

从本轮实际源码生成临时副本，仅插入观察与故障点，仍挂载真实组件；原测试文件没有保留故障注入。每次afterEach核对原描述符全部字段及函数引用、wrapper为空、DOM为空、真实Vue实例已卸载；下一项beforeEach再次核对无残留实例和原描述符。另测原来没有自有toString的分支。

| 路径                             | 预期/实际进程退出 | 清理结果                                     |
| -------------------------------- | ----------------- | -------------------------------------------- |
| 正常结束                         | 0/0               | 两项清理完成，下一项alive=0，描述符恢复      |
| 第一项编辑器就绪后断言失败       | 1/1               | 首项失败仍清理完成，第二项继续通过           |
| 第一项主动挂起触发默认5000ms超时 | 1/1               | 超时后仍清理完成，第二项继续通过             |
| 第一项真实卸载完成后主动抛错     | 1/1               | finally仍清理DOM并恢复描述符，第二项继续通过 |
| 原来没有自有toString             | 0/0               | 删除临时属性，未遗留自有覆盖；两项通过       |

[故障运行结果](evidence/formmanager-default-2026-10-15/cleanup-runs.json)单独记录预期失败，**不计入657项通过**。对应生成脚本、临时副本及config一并归档，可检查注入位置；运行时限仍为默认5秒。卸载抛错是在真实卸载完成后注入，用于验证finally边界；未据此宣称任意第三方在卸载中途失败时所有内部资源也必定释放。

## 4. 验证范围与验收更新

`pnpm build`、`pnpm lint`和独立入口的严格probe类型检查均退出0；[构建日志](evidence/formmanager-default-2026-10-15/build.log)、[严格类型日志](evidence/formmanager-default-2026-10-15/strict-probe.log)、[命令与退出状态](evidence/formmanager-default-2026-10-15/verification-runs.json)已归档。严格类型成功时无诊断输出，空日志配合退出码判定；构建保留既有chunk体积告警。文档同步后再次运行lint，结果另记在新manifest。

```sh
pnpm build
pnpm lint
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

本轮只改变测试环境兼容及测试清理，不新增公共API、改变编辑合同或覆盖工作台产品性能预算。真实组件仍有原来的Vue/第三方告警；未将告警消除列为本轮结果。

前轮20秒全量通过及默认超时保留在[原补修证据](evidence/p2-followup-2026-10-15/manifest.json)，本轮新增[manifest](evidence/formmanager-default-2026-10-15/manifest.json)固定当前测试源码和证据字节，不覆盖历史记录。旧浏览器矩阵、本分支远端CI、Node22消费者下限和第三方天然异常未重跑，不能由本地657项推导通过。

B02改为“候选功能合同通过，本地默认全量已验证”，B05保持“当前锁定入口通过”。B01主题/弹层隔离、B03全部内部状态及天然异常、B04资源预算/容器任务仍阻断阶段零整体出口。下一步由维护者决定是否授权推送/PR或后续组；agent本轮不自行推进。你现在无需操作。
