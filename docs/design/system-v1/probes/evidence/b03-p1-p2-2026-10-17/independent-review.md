# P1 三项 P2 补修的独立复核

两名独立复核员从无会话历史的新上下文分别执行 Standards/Spec，未修改仓库或推送。初轮固定范围 `ee0d126d7a1bc70dbd95a130ec06cdd2f3aeadb9...978e957c8cd4977d71b24a5f036ecf84effd97b4`（6 文件），补核固定 `978e957...78a7a786e5657647104fb35144f44d65ec6759f3`（2 文件）。旧问题与本轮新发现不因通过而删改。

## Standards

初轮0硬违规、0可执行smell；阅读AGENTS、docs/agents、CONTEXT、CONTRIBUTING、ADR0006/0009/0010/0011及12项Fowler启发式。核对事件token、badInput、公开beforeRemoveRule、两种delete时序、同步输入等待门、manager固定模式与legacy路径。

亲跑临时真实组件路径：原生change、恢复聚焦原值后，在editingStateChange中同步重入capture。两次分别1通过/89筛选跳过，退出0，9.12s/7.66s；断言可捕获观测非空并逐条核对标题新值。命令均为：

```sh
pnpm --filter @flowduet/form-create exec vitest run --config /private/tmp/flowduet-standards-review/vitest.config.ts -t '__review'
```

未单独保存stdout，仅有复核工具记录；临时测试在两次之间原位改写，最后是恢复原值版本，没有把当前快照冒充两个历史版本。未亲跑正式新增回归/全量/浏览器/build。

归一化两文件补核仅静态阅读与git diff --check，退出0、0新增违规/smell；不声称又跑一轮测试。Standards初轮未检出Spec后来发现的归一化缺陷，0发现不等于没有该缺陷。

## Spec

初轮亲跑新增16项，16通过/96筛选跳过，退出0、40.11s：

```sh
pnpm --filter @flowduet/form-create exec vitest run src/components.test.ts src/editor-input-state.test.ts -t 'P1复审P2|等价.*输入也先建立等待门|同步订阅者重入输入后不发布旧原文'
```

初轮stdout未独立保存，来源为复核工具会话98667及复核员报告，未伪造日志。

**初轮发现1项P2：** same-token的合法number `01` 经change/blur归一为 `1`，原规则min=1，但DOM字符串相等门使等待永久残留。外置临时真实FormCreate组件回归失败；为happy-dom原生事件协议，不是自然浏览器失败。Chrome常规fill→Tab路径在根代理实测中通过，两者同时保留。失败原日志见`review/spec-normalization-red.log`。

执行方将复现纳入正式回归，实际RED后以`78a7a78`修复；Spec对两文件固定增量限定独立补核，0新增发现，确认保留token/badInput/disposed、归一后建立实际基线。亲跑：

```sh
pnpm --filter @flowduet/form-create exec vitest run src/components.test.ts -t 'P1复审P2'
```

14通过/76筛选跳过，退出0、37.54s；原始stdout见`review/spec-final-green.log`。覆盖恢复原值、删除/clear、同tick旧change、新输入、badInput、合法归一、同步capture重入及两种模式重开。未亲跑默认全量或浏览器矩阵，未将根代理结果当复核员亲跑。

最终剩余发现0，仅支持此处限定增量的缺陷闭环；P1整体结论由最终验收报告结合执行方完整验证给出，B03出口仍不通过。

## 最后测试接缝限定核对

`78a7a78...2bb34ee1486838b9568205975d3b29e527b26bdf`仅改components.test.ts，生产运行时字节不变。一次默认全量新增delete用例5秒超时后，执行方先测旧选择回调触发次数、画布就绪时序，再改为只读等待画布并单次触发选择；managerRaw复用；delete/clear去掉无关date夹具，全部断言保留，双字段回归不减。默认5秒/真实provider不变。

两位复核员对该单文件增量仅作限定静态阅读（Standards另亲跑diff --check退出0），均0新增发现，未跑测试。明确未将选择次数下降当成全量计时根因或根治证明。执行方相关15项通过与最终默认全量须由验证日志分别支持，不计为复核员亲跑。

## 最终最小夹具静态核对

2bb的等待助手改动在默认全量中暴露旧独立FcDesigner选择等待失败，后续active回执试验也有旧用例超时，已全部回撤。最终固定差异78a7a78...9aadac43ef3f4ac2950ed84de87cd74bf6ac8c08仅1文件6插入/3删除：可选rules参数及delete/clear的单数字字段夹具；selectRetained/managerRaw与78完全相同。真实provider、全部断言、默认5秒及双字段他删回归保留。

Standards/Spec均限定静态0；Standards另亲跑diff --check退出0，均未再跑测试。此前2bb静态评价未保证运行正确，不用于证明最终接缝可用。根代理相关16项通过与最终默认全量分别另存。

## 原双Dialog准备步骤限定核对

9aadac4...0851e175e81b676492f40a3da6f1010587352e11仅调整原双Dialog用例准备：确认第一实例公开active回执后，在观察回调外刷新，再只读等待input。busy后原本实例拦截/另一实例放行的断言、真实组件及默认时限不变。两轴限定静态0；Standards亲跑diff --check退出0，均未跑测试、未改文件，不保证全量通过或时序根因已闭环。执行方相关15项通过另存。
