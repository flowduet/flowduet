# P1独立复核（只读）

固定范围：`56d9e07841f11b50aef4f0fcccc3c6c3b9ce132f...23fb826`，共17个实现/测试/包说明/changeset文件；两位fresh-context复核员，未共享执行者历史。另核读P1验收草稿及125行final证据。最终归档/状态文字由执行方在复核后整理，未声称是另一次独立复审。

## Standards

0项硬违规，0项可操作启发式smell。核读AGENTS、docs/agents全部、CONTEXT、ADR-0006/0009/0010/0011、CONTRIBUTING、eslint.config.mjs、tsconfig.base.json、.prettierignore和完整17文件diff；按12项smell基线评估，未把工具已覆盖的格式/类型重复报告。

亲跑：`pnpm --filter @flowduet/form-create exec vitest run src/editor-input-state.test.ts`，退出0，20/20。亲核96个运行时源码SHA256匹配工作树与Git固定提交。浏览器125、全量824、build/lint/strict仅核读，不作为复核员复跑结果。

## Spec

0项可执行偏差；核对已授权Task2、retained/legacy、字段生命期/复用、prop+原规则双确认、同步捕获、I01/格式、状态与旧key隔离、未知替换、明确放弃、Tab/pointerdown/Escape/closed、候选隔离及未实施边界。

亲跑（相同工作树）：

```sh
pnpm --filter @flowduet/form-create exec vitest run src/editor-input-state.test.ts src/components.test.ts -t 'retained|确认期间宿主替换|授权关闭的真实Dialog|同一表单对象|缓存原文'
pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts -t 'P1 同步候选隔离'
```

均退出0；前者54通过/38筛选跳过，48.94秒，后者10通过/110筛选跳过，2.97秒。未单独存stdout文件，原始输出在子代理工具记录；此处是其报告与审计元数据，不伪造原始日志。未亲跑浏览器/全量；核读故障目标调用次数、实际顺序、原adapter/lease、两份输入、候选零live写入、修正重试与正向persist。

两轴均只支持P1限定验收；P3取消、V01、APP-T不由此闭环，B03继续阻断。两位复核员均未改文件、提交或远端。

## 收尾自审遗漏与限定补核

初轮0发现并非没有遗漏：执行方收尾发现两项P2级缺陷，原v-model的model更新未绑定来源会话、新会话未挂载仍可读取共享旧ref。三项正式回归均有实际失败；旧事件已强化为旧组件仍挂载时执行并核emit次数，避免卸载后框架不再派发的假覆盖。

修复固定为`46f720b`；Spec对`23fb826`之后唯一两文件补修patch（`patch.diff.txt`，SHA256 `a488710c1360ceb1610bf726a85bb782be63e2314c8c2fe65ee3854c5370f4d9`）按M01/M03/M06首次限定独立核对，0发现。确认受控model回调归属、按会话查询/收集子ref、旧null仅清原指针与legacy直传路径。

此次补核仅静态阅读，未亲跑测试或浏览器，也未重复全分支或完整Standards评审。执行方另亲跑最终默认827/827、build/lint/strict/ESM与受影响30条UI轨迹；完整初轮125保持历史，不宣传为最后head再跑。记录见[补修目录](followup/README.md)。

## 同类页头来源补核

执行方在46f720b之后发现旧页头DOM的迟到click仍通过动态表达式读取新会话，已用真实组件反例RED证明。修复d9617b0仅把页头onClick绑定为渲染时的requestClose闭包，补1项回归；旧会话由既有current(session)拒绝。补修patch SHA256为f8d2178ddca64e5be065bf6c201413257a20a1a3db5532f1b09fbce2e9edc259。

Spec对此一行绑定及新增测试首次限定静态核对，符合M06，0新增偏差；未亲跑测试/浏览器或全分支。执行方亲跑最终默认828/828、build/lint/strict/ESM和同一30条受影响UI轨迹。详见[页头补修归档](header-followup/README.md)。
