# B03 P1 用例生命期P2补修证据

[当前验收报告](../../b03-p1-scope-lifetime-followup.md)。基线3333e00，代码2ef03ef；本轮只改两份私有测试源码。正式默认854/854，工具原6+新3=9；不覆盖旧归档、不推送或推进后片。

- `commands.json`：正式命令/退出码、执行HEAD与验证后代码提交身份分列。新3/旧4目标各三轮、工具9/App45/定位9、全量854、lint/build/probe严格/ESM均通过。App额外目录严格检查两组均退出1，基线3333e00=10、当前10，无新增；历史bec基线17不冒称本轮新跑。
- `test-sources.json`与`runtime-sources.json`：两份测试源码及96份产品/探针运行时的SHA256、字节、Git blob；测试在提交前执行，最终字节与代码提交相同，运行时与78a7a78相同。
- `assertion-audit.json`、`audit.mjs.txt`：原工具32处expect表达式和原标题/时限保留；App/定位文件、原scope辅助实现字节不变。原252处业务断言仍沿用。
- `rereview/`：前次P2受控复现的源码文本、日志/trace。原A真实5秒timeout后，旧finally清B；对照提前close不污染B。最初单次flush没命中交错的日志亦保留；不将控制门当自然时序证据。
- `real-timeout-control/`：本轮真正使用修复后的登记/hook/续体的临时副本，A保留默认5秒超时后释放旧finally，B连接/spy保持。结果仍是**1项预期失败、B通过**，不是CI正式全绿，也不计入854；源文本含本机路径，不声称可直接跨机运行。
- `verification/late-finally-red.log`：case空实现下新增交错失败；`close-all-red.log`：去掉逐scope错误恢复后只关闭B而漏A，原期望拦截。两个反证仅在临时修改后运行并即刻恢复，不作为最终源码。初次`late-finally-green.log`和`helper-file-first/green.log`是中间通过；正式最终结果看`helper-file.log`及默认全量。
- `verification/lint-code.log`保留首轮prefer-const三项，最后只调整清理引用声明，正式lint与收尾lint通过；未删业务assert、改timeout或运行器配置。
- `independent-review.md`：Standards0硬违反/1非阻断复用建议，Spec0缺失/错误/越界且亲跑9/9，未替代执行方默认全量或旧产品浏览器矩阵。

诊断与驱动脚本均按原字节加.txt归档，避免作为正式源码收集。`manifest.json`只排除自身；执行方复核归档、运行时与测试源码的哈希/Git身份。卸载故障是“真实unmount完成后人工抛错”，不是ERR05自然失败；OS/native证据仍未补齐。APP-T独立列项，未承诺所有负载永不超时。
