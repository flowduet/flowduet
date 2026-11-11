# 新增测试自身生命期P2补修独立复核

固定基线`3333e005ea97b9624fee8523d7f2c4e94b7c8811` → head`2ef03ef5cfbfa8be45040f2ec648cc609adfb1e2`。两个不继承实施对话历史的子代理分别执行Standards/Spec，以下保留报告。范围是两文件测试补丁，不是整条P1产品分支全面复审；未授权推送。

## Standards

Standards：硬违反0项；非阻断建议1项。

- 启发式 Duplicated Code：`browser-test-scope.test.ts:281、297、311` 重复清空DOM、存储及恢复spy，可复用`:25`的`cleanupGlobals`。依据AGENTS.md“复用优先”及smell基线；这是维护性建议，不构成阻断。

静态复核确认：`:48`的hook登记并关闭全部case；工具`:75`先失效、逆序关闭全部scope并收集异常；旧finally重复close无副作用，失效case拒绝openScope。异步测试捕获局部owner，未发现改绑后例case的路径。

亲跑仅`git diff --check`通过；核读默认测试、断言审计、strict对照及真实timeout日志，未重跑测试。真实timeout对照为1项预期失败、B通过；App额外strict仍有10项基线错误。未验证并发执行或任意异常组合；保留原scope底层finally异常覆盖语义。

## Spec

Spec：0 项缺失、错误或越界。

核对用户要求“登记、hook关闭、迟到保护”：`.test.ts:20–23、45–69`登记全部 owner，afterEach 逆序关闭；各异步测试捕获本例 owner，await 后校验。`.ts:69–89`拒绝过期 openScope，先失效再关闭全部 scope，保留关闭异常。

`.test.ts:269–365`正式交错等待旧 finally 结束，检查真实 B 的挂载、抽屉、存储、spy、描述符并继续保存；368–402 验证卸载异常仍关闭其他实例。原业务断言及时限未削弱，产品文件未改。

亲跑工具 9/9，退出0，日志`verification/independent-spec.log`。核读执行方多轮、整文件及默认全量854/854证据，未重跑全量；App严格类型仍为基线10→10，不能称全目录绿。交错及异常均为受控协议，不能归为自然故障。

## 执行方处理

无阻断发现，P2可闭环；1条清理复用建议保留为非阻断维护性建议，未为此改变已验证的补丁。原6项与新增3项同跑通过，不以本报告宣称任意异常组合或并发环境都已验证。
