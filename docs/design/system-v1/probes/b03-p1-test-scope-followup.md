# B03 P1：测试作用域补修与默认验收

日期：2026-10-17。批准基线 `bec34c2e833d53d46bb82c1361b987e7fd23373f`，沿用 `refactor/b03-retained-number-date`。仅实施已确认四文件测试方案；整轮P1产品仍以 `develop@56d9e07` 为基线，生产源码保持 `78a7a78`，legacy默认不变。未进入后续切片、D/E或工作台，未推送。

**结论：P1限定验收恢复通过，B03与阶段零出口仍阻断。** 依据前期P1功能复核、本轮四文件独立复核及正式默认全量851/851；不将本轮测试侧复核冒称整条P1生产分支的新一轮全面复审。

## 诊断与修复范围

此前默认841/845的四项失败按[独立诊断](evidence/b03-p1-test-scope-2026-10-17/diagnosis/report.md)处理，不覆盖原始失败归档。三个超时共有Element Plus/Popper调用Element.toString、happy-dom却序列化outerHTML的成本；旧版本也有同调用链。自然跟踪证明已结束用例仍读取下一例的module wrapper；受控交错可以得到同样的审批人为空保存断言，但历史那一次没有唯一因果trace，仍不倒推唯一根因。

四文件改动均在私有Playground测试侧：

- `src/test-utils/browser-test-scope.ts`：每次安装捕获当时DOM的Element原型/完整自有描述符，以Object.prototype.toString恢复Element的浏览器语义，关闭后精确还原；原本继承的属性删除覆盖，重复关闭无操作。只影响这两份测试及工具自身回归，不改Object.prototype、Window、显式HTML序列化、全局setup或第三方hook。
- `src/App.integration.test.ts`：module wrapper仅供清理；每例局部target、共享助手显式传target、await后核验本例仍活动且连接。保留teleport菜单通道；清理先失效，再卸载，finally清DOM/storage/spy/描述符，不吞unmount异常。原45例与全部业务断言、输入及原时限保留。
- `probes/stage-zero/location.test.ts`：setup/click/selected与跨await断言使用本例target；原9例、身份/条件/default/顺序/生命期断言不变。
- 对应工具测试：6项正式回归，含描述符与继承恢复、重复关闭、正常结束、测试体抛错、真实unmount后注入抛错，以及同例内A清理→B挂载→释放A旧动作。断言B抽屉/空审批人、spy身份/次数不变，B填入审批人后实际保存模型正常。

整文件进一步发现happy-dom Storage代理隐藏方法描述符并拒绝删除，Vitest restoreAllMocks不能恢复setItem实例spy；原手动mockRestore会重置实现，单靠批量restore则使quota故障串入后例。作用域安装时捕获已绑定原方法，finally在发生变化时显式恢复；正常/体失败/卸载后失败均核对方法身份及恢复后的真实写读。普通对象spy仍由restoreAllMocks恢复；旧finally只释放本例gate，避免旧restorer晚到撤掉新例spy。

本轮无产品包、App.vue、公开导出、依赖/lockfile或测试运行器配置变更。保留默认5秒与原有15秒选项；没有调worker或跳过业务断言。AST核对在只归一化wrapper→target、无运行时影响的非空断言及selected(target)后，App227处断言/20处控件赋值/原时限、定位25处断言/1处赋值相同；它是机械审计，不替代实跑。

## 正式验证与证据边界

代码固定提交 `1c948c0662f63ac8edfc008b8f690596d2650210`。命令在提交前运行，四份最终文件SHA256/字节与该提交的Git对象完全一致；96个产品/探针运行时源码与78a7a78逐字相同。完整[命令与退出码](evidence/b03-p1-test-scope-2026-10-17/commands.json)、[源码身份](evidence/b03-p1-test-scope-2026-10-17/test-sources.json)及原始日志独立归档。

| 验证                                     | 正式结果                             | 边界                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 四个失败目标连续三轮                     | 每轮4/4，50项筛选跳过                | 三轮不累计为12种场景                                                                                                                                    |
| App整文件 / 定位整文件                   | 45/45、9/9                           | 全部原业务断言及原时限                                                                                                                                  |
| 作用域回归                               | 6/6                                  | 真实App；错误与A/B交错为受控协议                                                                                                                        |
| 原样 `pnpm test`                         | **851/851，退出0**                   | core148、designer184、form-create216、Playground303；原845+新增6，不重复加原P1的17项                                                                    |
| `pnpm lint` / `pnpm build`               | 均退出0                              | 构建保留既有体积告警                                                                                                                                    |
| 探针严格 `vue-tsc` / core构建产物原生ESM | 均退出0                              | 不等于全App目录类型检查通过                                                                                                                             |
| 额外App全目录严格检查                    | 当前10条，基线bec34c2为17条，均退出1 | 当前各错误均已存在于原基线；[逐文件/TS诊断对照](evidence/b03-p1-test-scope-2026-10-17/strict-app-comparison.json)无新增，未扩大四文件范围去修旧类型问题 |

本机Node24.16.0/pnpm10.26.1。未执行新的远端Node22/24 CI；没有推送授权。本次最终默认全量仅跑一轮，不能以它宣称任意平台/负载永不超时。

[独立复核](evidence/b03-p1-test-scope-2026-10-17/independent-review.md)：Standards 0硬违反/0整改建议，仅静态；Spec 0遗漏/错实现/越界，亲跑helper6/6及断言审计，其他日志核读。两轴固定bec34c2..1c948c0四文件，不声称复跑整条P1、完整默认全量或浏览器矩阵。原功能补修独立证据仍见[上轮报告](b03-p1-p2-followup.md)。

本轮不重放旧真实Chromium125/12/1矩阵：生产源码字节未变，仍引用原78a7a78证据，不累计为新跑结果。测试体/卸载注入和迟到A/B是受控组件协议，不是ERR05自然第三方失败、OS输入法或native pointercancel。

## 失败与修正记录

保留全部失败：首轮Element字符串RED；撤掉active guard的迟到动作反证；Storage恢复RED与随后quota污染；迁移时误给VTU成员setValue加target的12项失败，原断言拦住后修正。另有一次把happy-dom的window字符串误断言为裸浏览器Window字面量，已改为精确比较安装前后结果，未修改Window。审计工具初次没有处理零参数与TS非空断言，仅算工具搭建错误，不算产品RED。没有用这些失败次数代表新增业务缺陷数。归档诊断副本的.ts首次触发eslint的240项错误，之后仅将这些非执行原始脚本按原字节存为.txt，增加原路径映射，原始SHA256不变；不改lint配置、诊断内容或正式四文件来绕过检查，重新lint通过。

APP-T仍单列：本次只定位并修正两个既有App目标的测试接缝，保留此前5秒失败，不承诺所有平台/负载的计时稳定。定位探针超时另记；历史保存业务断言不并入APP-T。

B03仍受文字空串、公开非重建拖拽取消、OS/native/ERR05未知阻断；B01/B04仍待D/E。R不采用，正式工作台与后续切片未启动。
