# B03 P1独立证据

基线`develop@56d9e07`，主实现`23fb826`，收尾补修`46f720b`/`d9617b0`。只验收显式retained数值/日期及对应状态/捕获/关闭保护，不解除B03；legacy默认、设计文档、A/B合同、依赖与lockfile保持。

- `header-followup/`：页头旧DOM迟到click的同类来源补修；最终默认828/828、build/lint/strict/ESM通过，受影响同一30条UI再次重放、96源码pin与Spec一行绑定/测试的静态核对。
- `followup/`：两项关闭接缝P2级缺陷与3项新回归；最终默认827/827、build/lint/strict/ESM，受影响30条UI重放及最终96源码pin。Spec限定静态补核0，不冒称完整125在最终head再跑。
- `final/`（初轮23fb826）：5个冻结源码批次共125条通过（68+21+21+6+9）；每批独立Chromium context、1440×1000/DPR1。`*.cli.log`是原始CLI输出，JSON仅提取Result；open/resize/close及环境记录另存。协议组合/故障/双开/确认期间新输入有明确来源，不称OS或ERR05。
- `runtime-sources.json`：96个运行时源码的保守超集，排除test/cases；SHA256/字节及Git blob与23fb826匹配；FormManager随后有补修，最终版本见header-followup，不把初轮快照称为当前工作树。并非逐请求模块追踪。`test-sources.json`另列4个变更测试文件。
- `coverage.json`：125条目录与原C F03/F07共12条失败的数组索引映射。仅retained修复，不改旧legacy记录；4条文字、3条取消与V01继续欠验。
- `verification/`：初轮原样默认824/824、build/lint/strict日志与命令（最终828见header-followup）；Node24.16.0、pnpm10.26.1、macOS15.6。ESM成功结果来自执行工具返回，未另存stdout。基线756/756为开工原样结果。历史三套归档453列项SHA256及基线Git字节匹配。
- `history/`：API/行为RED与迭代诊断，包括尚未就绪选中、错误选择器、日历早于show、旧field误读、暂时类型/测试断言问题。不是全部产品失败，也不把所有后补断言称先RED；中间工作树未逐个签Git pin。原生beforeunload造成的部分CLI中断仅有工具记录摘要，未计通过。
- `independent-review.md`：初轮Standards/Spec各0发现，收尾自审另发现两项并已补修；原评审与限定补核边界分列，不把复核员定向验证计成独立全量或浏览器重放。
- `manifest.json`：本目录全部文件SHA256/字节（自身除外），便于检查完整性；源码Git pin和文档提交分开。

驱动没有清除第三方window.onbeforeunload，也不通过写DOM恢复值、setRule重建或私有接口保真。拖后提供者可能新建并自动选中另一字段，最终脚本等待原字段data-field再核raw；只验P1拖动保护，不称取消成功。

复跑须有现有pnpm/Playwright CLI和浏览器。先在仓库根启动独立入口：

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --port 5178
python3 docs/design/system-v1/probes/evidence/b03-p1-2026-10-16/scripts/replay.py --output /tmp/flowduet-b03-p1-new-replay
```

`--output`必须是新目录，拒绝覆盖历史归档。`scripts/*.js.txt`为实际执行代码；`runner-used.py.txt`保留本轮编排原样，使用临时output路径，不能直接视为可移植入口；`replay.py`提供新目录重放入口，本轮只做语法/只读检查，未再用它重复整套125轨迹。复跑后自行停止本次Vite服务。未验证其他浏览器/OS、原生离页、OS输入法、native pointercancel、ERR05；R不采用，App默认超时未做根因修复，未推送/运行远端CI。
