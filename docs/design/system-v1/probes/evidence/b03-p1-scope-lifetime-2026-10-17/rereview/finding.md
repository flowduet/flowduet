# 3333e00 两轴复审发现

Standards与Spec均确认同一P2：`apps/playground/src/test-utils/browser-test-scope.test.ts:17–27`的afterEach未关闭局部scope，旧async finally（99–110、186–199）会在用例超时后首次close并清理后例。上轮851/851与17→10类型错误对照准确，但不覆盖此交错，暂停据此判断P1限定验收恢复。

此处记录执行方从会话审查结论整理的事实，不冒称独立代理新跑默认全量。root在临时副本中控制A等待真实默认5秒timeout，运行原afterEach，再让真实B挂载并创建URL spy，释放A并等待其原finally结束：`timeout-overlap-trace.jsonl`显示B的connected与spy均true→false；`scope-timeout-overlap.log`为A预期timeout+B断言失败两项。临时提前关闭scope的对照为1项预期timeout+B通过，见control日志与trace。

最初只等一次flush的尝试B先于A清理结束，没有命中；两组原始日志均保留。全部为受控时序证据，不追认此前App保存断言失败的唯一自然原因。代码副本按原字节另加.txt后缀，不执行、不参与lint或正式测试；脚本中临时绝对路径仅反映本机诊断环境。
