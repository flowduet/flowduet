# P1收尾关闭接缝补修

基线`23fb826`，修复`46f720b`。两项P2为评审优先级，不是未启动的文字空串P2切片。

- model：原v-model直接写共享editVisible，当前model=false可绕过明确放弃；旧组件未卸载时的迟到回调可关新会话。改为受控modelValue与来源会话闭包，retained请求统一关闭，legacy原样直接更新。
- ref：新会话尚未挂载不能读旧designerRef。按会话保有子引用与绑定回调，新会话not-ready，旧null只清匹配原指针，不清新ref、不留旧ref。

3项新增正式回归：旧组件仍挂载（isConnected与实际emit次数）时派发旧state/save/cancel/model/closed；当前model=false仍需放弃；同步重开未挂载拒绝旧ref捕获。初次旧model测试曾在旧组件已卸载后emit而无法暴露缺陷，最终用例纠正，且临时回23fb826明确RED，再恢复修复GREEN。此补修增强原M01/M03/M06覆盖，不以不可达旧回调计通过。

`verification/`保留model/ref RED、强旧回调基线RED、5项定向GREEN（含legacy）、原样默认827/827（148+184+198+297）、build/lint/strict与ESM退出0。默认5秒、App源码与旧App测试未改。

`final/`为同一最终工作树下21条Dialog和9条双Dialog/Tab/原生拖动保护，合计30通过；沿用上层scripts的原驱动，未重跑其他95条，亦不把重复子集累加成155种不同场景。`runtime-sources.json`另存96源码SHA256/字节/Git blob并匹配46f720b；`test-sources.json`记录变更测试文件。`patch.diff.txt`与Spec限定补核的patch SHA256一致。

Spec限定独立静态补核0发现；此次不声称再次亲跑测试/浏览器或完整Standards复审。上层初轮评审与当前补核边界分列。补充Vite记录出现提供者source-map解析告警，UI轨迹通过；不将开发工具调试元数据告警记为ERR05自然业务失败。

B03仍阻断，P2/P3/P4、D/E与工作台未启动；APP-T历史超时单列，未推送或运行远端CI。
