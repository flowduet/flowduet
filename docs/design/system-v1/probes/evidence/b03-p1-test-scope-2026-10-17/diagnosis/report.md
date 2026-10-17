# bec34c2 四项失败：独立诊断与最小处理方案

日期：2026-10-17。正式工作树 `/Users/l/.codex/worktrees/design-system-stage-zero/flowduet` 固定于 `bec34c2e833d53d46bb82c1361b987e7fd23373f`，本轮未修改、提交或推送仓库文件。全部插桩、候选兼容与故障交错仅在本临时目录执行。保留真实 Vue/Element Plus/FormCreate/VueFlow、全部原业务断言及原默认时限；既有某些非目标用例自带的15秒选项也原样保留，不伪称所有原用例都是5秒。

**结论：三项超时有共同的模拟DOM兼容成本；保存断言失败有已证实的超时后跨用例污染机制和失败路径spy泄漏。没有证据支持将这些机制判为本轮P1补修新引入的业务回归，但历史213那一次的唯一交错没有原始逐步trace，不能倒推唯一因果。建议只修测试环境语义、用例归属与清理，不改产品保存/审批人校验合同。**

## 1. 反馈回路与结果

以下均为实际执行，完整命令、原始日志在本目录；诊断文件包含本机绝对路径，不声称是可直接跨机器运行的正式测试。

| 回路 | 结果 | 能证明什么 |
| --- | --- | --- |
| 正式源码、原测试，筛选四目标 | 3通过/1失败，E16默认5秒超时；`original-four.log` | 未改测试可复现本次超时，不能把单跑通过当全量稳定 |
| 原E16单跑 | 1通过/44筛选跳过；`e16-alone.log` | 有负载/组合敏感性，不能据此排除问题 |
| 当前版原语义插桩，全App45例 | 45通过；`trace-full-original.log` | 插桩与原组件可运行；不是默认全包通过 |
| 当前版原语义插桩，全Playground | 296通过/1抄送超时；`full-play-original-v2.log` | 自然组合下复现，并记录旧用例在后例中的继续执行 |
| 同一临时副本，仅切换Element字符串语义 | 全包297/297；`full-play-compatible.log` | 原业务断言不变的一变量对照，不是正式仓库验收恢复 |
| 兼容副本四目标三轮 | 每轮4/4；`trace-compatible.log`、`-2.log`、`-3.log` | 默认时限内可重复，仍不等于整仓845项或远端CI通过 |
| 正常/测试体抛错/真实unmount后抛错/原描述符不存在 | 临时验证4/4；`restore-faults.log` | 候选finally恢复可覆盖错误路径；不是第三方自然故障证据 |

原四目标命令（正式文件、默认时限）：

```sh
pnpm --filter @flowduet/playground exec vitest run src/App.integration.test.ts probes/stage-zero/location.test.ts -t '插入抄送草稿后自动与手动导出|新建草稿可保存并报告待修复项|读取期间新打开表单编辑器|单↔多转换后原分支诊断'
```

## 2. 初始化、等待、卸载分别耗在哪里

主调用链已由栈定位：`Element Plus use-popper` → `@sxzz/popperjs-es@2.11.8` 的 `B(e)`（getWindow）→ `e.toString()`。它只想判断是否为 `[object Window]`；happy-dom@20.14.5 的 `Element.prototype.toString()` 却直接返回 `outerHTML`。祖先遍历对BODY/MAIN/DIV反复调用，带来整树序列化。

原语义/兼容语义对照的一轮诊断记录（总时长含清理，不拿小样本当性能SLA）：

| 用例 | 原记录总时长 | 其中toString耗时/累计字符 | 同调用次数、兼容后总时长/toString耗时 | 原清理耗时 |
| --- | --- | --- | --- | --- |
| 抄送导出（App:68） | 2536ms | 1172ms /106,371,971字符，4703次 | 1459ms /8ms | 14ms |
| 保存断言（App:213所在例） | 1099ms | 271ms /66,381,976字符，3509次 | 971ms /4ms | 3ms |
| E16打开表单（App:1640） | 4404ms | 3272ms /216,633,701字符，6528次 | 1404ms /8ms | 29ms |
| 分支定位（location:42） | 2710ms | 1380ms /130,893,014字符，6312次 | 1306ms /8ms | 20ms |

E16大部分成本发生在原1650行“打开真实表单编辑器”的trigger及随后1651行的Vue刷新，约2574ms+1465ms。不是待读取文件Promise不resolve，读取结果在编辑器打开之后才按原流程释放。抄送与定位的耗时也分布在挂载、弹层初始化及动作触发的刷新中；看到`await flushPromises`耗时高，不等于要再加sleep或无限轮询。

三轮及全包负载会改变墙钟时间；归因依据是调用栈、数千次调用/数百MB序列化和一变量对照，不仅是相关性。卸载耗时仅数毫秒至数十毫秒，**不是三个超时的主要耗时点**。

HeadlessChrome155裸页面另外验证了BODY/DIV/SVG的原生toString均与`Object.prototype.toString.call(element)`相同，Window仍为`[object Window]`，显式outerHTML正常。见`browser-element-string.log`。因此候选兼容恢复浏览器语义；没有stub Popper、改几何、删组件或重建表单来取得通过。

## 3. 保存断言失败与跨用例污染

### 自然观察

`full-play-original-v2/app.jsonl`记录到：抄送用例在超时并执行afterEach之后，仍从原81/108行附近的等待回调读取module级`wrapper`。13条late记录中，原用例所有者不变，但实际wrapper已属于下一、再下及后续用例。这证明unmount/清空DOM**不会取消测试函数及其已启动的Promise**。

本次自然跟踪没有再现App213断言失败，不能把旧异步读取直接当成已证明的历史数据写坏原因。

### 受控同症状复现

用固定的公开动作交错：前一抄送用例在原104行“点击确定”之前等待，保留其原5秒deadline；超时清理之后，后一保存用例打开空审批人抽屉，在原203行刷新前释放旧动作。

- 无归属保护：旧已结束用例查询并点到新用例的审批抽屉确定按钮。trace显示旧owner已closed、active是新owner、目标nodeId=approval_1、draft.assignee为空。随后新用例填写隐藏抽屉但模型仍未写入，**原App213业务断言原样失败**：仍报告审批人为空。`pollution-unsafe-v2.log`为前例预期超时+后例同症状断言失败，2失败。
- 仅改为固定本例target并拒绝清理后的全局交互：前例仍按原5秒超时，后例原业务断言通过；1预期超时/1通过。见`pollution-owned-guard.log`。没有把前例超时伪装成通过。
- 完全相同受控交错在修前ee0d126也得到相同的审批人为空断言失败，见`pollution-ee-unsafe.log`。机制并非本轮三项P2新增。

这组属于**受控协议证据**，不能标成历史那一次自然交错的回放。它证明该错误由纯测试生命周期污染即可造成，不能因此放宽产品审批人校验或保存断言。

### 错误清理

失败的保存用例在213行断言之前设置了URL.createObjectURL及HTMLAnchorElement.click spy，但恢复语句在214行之后。受控失败后的afterEach记录两者仍为mock。现有afterEach只unmount、清DOM和storage，缺少finally兜底restoreAllMocks。

不能把所有全局query机械改成`target.find`：插入菜单是teleport，受控试验已因找不到菜单失败。正确边界是稳定的用例target/活跃性检查，抽屉控件尽量限定实例，合法overlay保留其查询通道但须先验证发起者归属。

## 4. 与本轮补修的关系

| 固定版本 | 四目标结果 | E16 toString | 定位toString |
| --- | --- | --- | --- |
| develop@56d9e07，P1之前 | 4通过 | 6528次，216,414,701字符，3337ms | 6312次，130,893,014字符，1354ms |
| ee0d126，本次三P2补修之前 | 4通过 | 6528次，216,633,701字符，3666ms | 6312次，130,893,014字符，1280ms |
| bec34c2，本轮之后 | 插桩4通过；原文件四目标另一次E16超时 | 6528次，216,633,701字符，3272ms | 6312次，130,893,014字符，1380ms |

每个版本独立提取到临时目录，共用当前锁定依赖；两份原测试的Git blob在三个版本完全相同，见`refs/metadata.json`。配置缺失导致的首轮14个suite加载错误只算诊断搭建失败，修正配置后才记录297项有效对照；代理it重载和初次交错行号错误也未计为业务证据。

结合旧版本也有同调用链/字节量、ee也能复现污染、当前原断言在兼容副本全包通过，**没有证据支持把四项判为本轮retained/legacy业务逻辑修坏**。这不是对所有组合、所有时序的无回归承诺；历史213的唯一根因仍保留不确定性，正式验收继续阻断。

## 5. 推荐最小实施范围（等待确认）

仅改测试侧四个文件，不改产品、依赖、lockfile、公开导出或Vitest全局配置：

1. 新增 `apps/playground/src/test-utils/browser-test-scope.ts`：只供这两份测试使用的短生命周期工具，提供浏览器式Element字符串兼容与用例target活跃检查。安装时捕获本DOM的prototype和完整原描述符；返回幂等restorer，原先无自有属性时删除覆盖。不能缓存模块加载时的全局Element供后续不同DOM使用，不改变Object.prototype或显式innerHTML/outerHTML。
2. 新增对应 `.test.ts`：验证原描述符/继承属性、重复恢复、测试体抛错、实际unmount后抛错，以及A结束后迟到动作不能作用于B。使用真实组件；故障注入清楚标记，不把它称为自然第三方失败。
3. `apps/playground/src/App.integration.test.ts`：每例安装/最终恢复兼容；afterEach以finally保证DOM/storage、spy及描述符恢复，且unmount异常不被吞掉。module wrapper只承担清理引用；跨await业务路径保留本例局部target，沿已有insertViaMenu(target)/openApprovalDrawer(target)风格补齐共用helper的显式target参数。执行交互前验证该target仍属于活动用例且仍挂载；不要通过晚到时读取当前全局wrapper来冒充所有者。原45例、原输入步骤和业务断言保留，teleport查询保留但必须有活跃发起者。
4. `apps/playground/probes/stage-zero/location.test.ts`：相同文件级兼容与finally恢复；setup/click/selected及跨await断言使用调用方捕获的target。保持全部9例及条件、default、顺序、生命期等原断言，不修改定位实现或结构操作。

不将诊断使用的AsyncLocalStorage、AST插桩、强制超时门或弱引用追踪带进正式实现；不换组件、不mock FormCreate/Popper、不改默认5秒/既有时限、不调低并发、不清空第三方全局hook来冒充修复。

### 按片执行及验收

A. 先写兼容恢复与错误清理失败回归，落实局部helper及两文件hook；四目标连续3轮，再跑原App全文件和location全文件。先以实测确认String链下降及全部原断言保留。

B. 把“旧实例清理→新实例挂载→释放旧动作”的受控复现转为**同一个正式测试中的生命周期回归**，断言B的模型/抽屉/spy未被A改变；不将真的超时失败用例留作CI成功条件。完成局部target/活跃检查和finally清理，覆盖失败、正常、unmount异常、迟到动作。

C. 完整正式 `pnpm test`、lint/build、相关严格类型与独立复核；原用例名/业务expect不删不弱化，新增数量以实际执行为准。只有正式默认全量退出0且复核通过才更新P1验收，临时297通过不代替它；远端Node22/24 CI需之后另获推送授权。

停止条件：若作用域检查误拦正常overlay、影响浏览器式Window判断或描述符不能可靠恢复，停止该切片；若同例正确归属下仍出现保存断言差异，保留输入/草稿/模型前后证据，另提产品修复边界，不能跳过assert、加sleep或升timeout。若需要扩大到全局测试运行策略、生产取消协议或依赖升级，先重新确认。

当前停在诊断与方案完成。工作树保持bec34c2；未正式实施上述四文件方案、未提交、未推送、未推进后续切片/D/E或工作台。确认此范围后再实施和正式验收。
