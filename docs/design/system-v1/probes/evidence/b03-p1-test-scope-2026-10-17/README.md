# B03 P1 测试作用域修复证据

结论见[验收报告](../../b03-p1-test-scope-followup.md)。代码固定`1c948c0662f63ac8edfc008b8f690596d2650210`，基线`bec34c2`；产品/探针96源码与`78a7a78`字节一致。真实组件、原断言与时限保留，未推送或推进后续片。

- `commands.json`：正式命令、退出码、执行HEAD与之后提交的测试源码身份分列。`verification/full-default.log`为原样默认851/851；四目标3轮每轮4/4，App45/45、定位9/9、工具6/6；不重复累计为不同业务场景。
- `test-sources.json` / `runtime-sources.json`：4份测试源码的SHA256、字节与Git blob；96份运行时源码与旧产品提交的对应。后续提交只含文档/证据，不改这些字节。
- `assertion-audit.json` / `audit.mjs.txt`：归一化变量归属与无运行时作用的非空断言后，原断言/控件赋值/标题/时限不变。Spec另行亲跑同审计。
- `strict-app-comparison.json`与两个原始strict日志：额外App全目录检查仍退出1，基线17条、当前10条，无新增；不能称全部类型检查绿。正式probe严格检查日志独立。
- `independent-review.md`：两轴复核，Standards仅静态，Spec亲跑6项，其余核读。不冒称独立方重跑默认全量或浏览器矩阵。
- `diagnosis/`：先前获批准的诊断原文、临时插桩、失败/对照日志及trace。按`original-manifest.json`69项原字节复制；代码副本追加`.txt`防止被当成正式测试或lint源码，`path-map.json`映射原路径与存档路径，SHA256/字节未变。临时脚本保留本机绝对路径，不声称开箱跨机器复现；refs仅保留元数据，源码可按Git pin提取。
- `verification/`还保留首轮窗口字符串假设错误、迁移错误、Storage失败及迟到保护反证。`compat-green.log`是早期尝试的历史文件名，实际失败，不能按文件名推断GREEN；最终正式工具结果是`scope-green.log`。`files-corrected.log`60/60为中间版本，不代替最终全量。`commands-before-storage-fix.json`只记录整文件35通过/10失败；Storage RED为受控代理故障及后例污染，均非产品自然故障。
- `verification/lint-evidence-source-first.log`：首次归档诊断.ts被eslint扫描的240项错误，之后只按原字节改存.txt，未改lint规则或正式测试；`lint.log`及收尾lint记录为通过。

`verify.py.txt`是本机命令驱动记录；不作为产品运行代码。`manifest.json`只列自身以外的归档文件，最终SHA256/字节由执行方复核。正常、测试体抛错、真实unmount后注入失败与A/B迟到交错是组件/受控协议证据；不当作ERR05、OS输入法或native pointercancel证据。APP-T单列，历史保存断言的唯一因果仍未追认。
