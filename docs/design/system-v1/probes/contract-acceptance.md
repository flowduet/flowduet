# 阶段零 A/B 编辑合同验收

日期：2026-10-15。产品基线`develop@02d3474`，批准输入`e78d56a`；分支`refactor/stage-zero-editing-contract`，保留原探针分支。依据[已批准规格](../../2026-10-15-stage-zero-editing-contract.md)及[薄切片计划](../../plans/2026-10-15-stage-zero-contract-slices.md)。

**当前：四项P2及独立补充问题已闭环，B02候选功能合同通过且本地默认全量已657/657通过，B05锁定入口通过；阶段零整体出口仍未通过。** 最新证据见[默认时限补修验证](formmanager-default-2026-10-15.md)，此前[四项P2补修验收](p2-followup-2026-10-15.md)保留原时限边界。远端CI未经本分支验证。 此前第一轮独立复核发现的三个 Important 已完成失败回归、补修和执行方全量复验，没有延后的 Minor。 本文中“通过”只指所列候选合同与夹具，不是正式工作台、公共控制器发布或任意第三方状态保真声明。B01/B03/B04未解除。

## 1. 实施范围

- designer只改批准的共享属性规则/字段、NodeDrawer兼容包装、DingtalkDesigner外置模式与选择接缝、BlockNodeList身份属性、对应测试及minor changeset。
- 候选身份/缓冲/候选事务/版本控制器仍位于`apps/playground/probes/stage-zero/contracts/`。`ContractProbe`是最小真实集成实验，不是正式工作台。
- 没有改core、form-create生产源码、三包根导出、package.json、lockfile或主Playground入口；默认时限补修仅另改form-create的components.test.ts；没有新增依赖，没有推送、开PR或发包。
- NodeDrawer默认“确定”、旧DingtalkDesigner切换/commitPendingChanges合同与部署守卫保持；只有显式external模式使用外置输入。新模式误调用旧收集方法返回false，避免假收集成功。

本地提交已按严格类型修订、身份、冲突、候选事务、共享字段、选择接缝、集成实验及复核补修分组；此前补修源码为`10b66f4`、`9c8a8f5`，本轮为`83ec03d`及`1506b16`，默认时限测试补修为`c6fa670`。最终源文件与证据身份记录在本目录证据manifest中。

## 2. 验收矩阵

| ID  | 结果与主要证据                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | 所属控制器私有登记拒绝外来/复制引用，kind/facet错误在导航前拒绝；编辑身份不写设计文档。entity-store、contract-location测试                    |
| A02 | 同命令删后同ID重建、文档替换、释放与迟到租约注销；旧引用不作用于新对象。entity-store、controller、host、contract-location测试                 |
| A03 | 受控表单改名续期；未知替换保留快照/原FormDesigner，失败不销毁输入。draft-store与原生表单冲突证据                                              |
| A04 | 基础字段在首次输入前已变也冲突；重新编辑从当前值开始，旧输入留作只读比较；关闭旧比较不注销新租约。controller、contract-location与原生比较证据 |
| A05 | 删除影响集、确认过期/取消/失败与级联清理；界面明确列出删除对象和未应用输入代价。draft-store、controller及原生结构证据                         |
| A06 | 所有对象捕获后才构建隔离候选；第二份失败/新输入/租约更换/最终交付过期均拒绝，不写当前model/session/DI。candidate、versions测试                |
| A07 | 属性提交中段失败恢复原字段、数组/对象引用、default、顺序、DI，无部分成功通知。transaction、controller测试；撤销器不是通用core私有登记表事务   |
| A08 | fork共享default、引用及目录读集；未应用绑定阻止表单删除，已选择的表单被同ID替换会使绑定输入冲突。candidate、controller测试                    |
| A09 | 共享规则供抽屉与外置字段复用；业务缺项与非法格式分开；两对象非法输入、跨阶段返回原对象不自动提交。designer、contract-location及原生切换证据   |
| A10 | 实际selectedId/焦点确认；同名对象、外来实例、迟到ID复用、主动选择/取消/销毁拒绝旧请求。external-editing、contract-location测试                |
| A11 | 原位转换、删首节点、删开头嵌套块后fa身份、条件/default、顺序与未应用输入保留。既有结构回归及原生结构证据                                      |
| A12 | 默认表单是真实配置；内置条明确隐藏，唯一外置入口；失效key显示原值，BPMN仅只读摘要，问题定位回编辑视图。组件测试与原生默认配置证据             |
| A13 | 校验绑定完整候选/目标/规则/租约覆盖；已证明原样应用保持，规范化/未知变化/捕获失败失效；隐藏切换缓存不计业务变化。validation测试与原生等价应用 |
| A14 | 宿主接收冻结快照，真实确认后才标该快照保存；期间新输入仍dirty，旧世代/销毁/迟到请求不确认新上下文。host、versions测试及原生保存竞态           |
| A15 | 副本编译不改变当前DI/引用；额外字段保留或明确拒绝；无私自新增clone/transaction内核API。candidate、transaction、正式往返/编译回归              |
| B05 | 当前锁定版本严格入口已转绿；正向类型和非法placeholder/选项/modelValue拒绝用例在同一入口检查。不是升级依赖、降低strict或替换真实控件           |

补充边界：还原后立即锁定干净基线、flush模型变更阻断、放弃同生命期冲突后重建编辑器均已有真实组件回归；同轮两个字段事件不丢前值；自定义elementVariable省略时保持；相同内容的对象替换也换生命期/渲染版本；只读惰性空数组不制造dirty；特殊属性名不漏版本投影或失败撤销。

## 3. 真实浏览器证据

Playwright CLI驱动真实Chromium；三包别名指向源码。完整原始结果位于[evidence/contract-2026-10-15](evidence/contract-2026-10-15/)。

| 案例                                 | 观察                                                                                            | 证据                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 两个非法审批缓冲跨对象切换           | 返回仍是原输入；收集拒绝；当前模型名称未改，实例B未被编辑                                       | [invalid-switch](evidence/contract-2026-10-15/browser-invalid-switch.txt)       |
| 显式校验后原样应用                   | 候选通过，模型名称随后改变；校验保持，仍未持久化                                                | [equivalent-apply](evidence/contract-2026-10-15/browser-equivalent-apply.txt)   |
| 保存期间继续输入                     | 只确认捕获版本；新输入仍dirty且编辑版本较新                                                     | [save-race](evidence/contract-2026-10-15/browser-save-race.txt)                 |
| 同生命期冲突与恢复                   | 普通还原拒绝；新编辑从外部当前值开始；旧输入只读，应用/还原禁用；关闭比较后新输入仍可收集       | [conflict-recovery](evidence/contract-2026-10-15/browser-conflict-recovery.txt) |
| 两张真实表单及无法序列化时的未知替换 | 两份候选均保留；失败零写session；旧实例仍显示比上次快照更新的输入；明确放弃后新实例只显示外部值 | [form-conflict](evidence/contract-2026-10-15/browser-form-conflict.txt)         |
| 转换/首节点删除/嵌套块删除及默认配置 | 同一fa及未应用条件存续；BPMN不显示旧编辑字段；默认失效key可见，选择未自动提交，显式应用才改模型 | [structure-default](evidence/contract-2026-10-15/browser-structure-default.txt) |

B05另在原HostProtocolProbe中打开真实EP下拉并选择，检查选择值和第二实例不变；见[browser-real-ep](evidence/contract-2026-10-15/browser-real-ep.txt)。该项不把旧入口的“模拟校验”计作新控制器的校验通过。

补修浏览器[还原/放弃](evidence/contract-2026-10-15/review-final-restore-discard.txt)确认外部值不被覆盖且放弃后新输入可应用；[失焦竞态](evidence/contract-2026-10-15/review-final-flush-conflict.txt)确认flush中出现模型变化时拒绝，保留本地及外部值。后者用既有实验按钮注入外部更新，以DOM click保持焦点直到适配器flush，不是普通鼠标交互时序或OS输入法证据。审批人字段的精确复现另由真实Vue回归覆盖。

原生脚本结果必须同时核对实际模型、字段值、目标身份和操作返回，不以成功文案或派发click判通过。默认配置使用固定过程引用；未知文档替换后旧控件禁用，不能猜同名新对象。

### 保留的负证据及取证边界

- `browser-initial-negative.txt`记录过只读惰性数组造成初始dirty的缺陷，已有失败回归后修复；新的初始状态记录与最终断言分开。
- `browser-form-inventory.txt`/`browser-form-inventory-now.txt`记录过Boolean可选props被Vue转为false，默认夹具缺表单；已明确默认true并回归。`browser-form-inventory-positive.txt`及form-conflict才是实际表单证据，不能从无表单夹具推断FormCreate保真。
- `browser-structure-hover-negative.txt`记录删除按钮尚未按既有hover路径显示时的原生超时；重走hover后验证，不用force click。
- 导出失败为人工注入。输入法检查是组件层CompositionEvent用例，不是操作系统输入法全矩阵。全部第三方内部状态及天然序列化异常仍归B03。
- 部分原生证据在开发过程中采集；manifest固定最终可复现源码和证据字节，并说明哪些检查在最终树重新执行。不把旧截图冒充全部最终原生矩阵。
- 未执行真实路由卸载、业务存储、下载文件或新引擎部署；保存适配器是人工控制的内存门。未发起本分支远端CI。

## 4. 验证记录

当前全包 **657/657通过**：core148、designer184、form-create137、Playground188（正式测试513项、探针144项），命令为原样`pnpm test`，无超时覆盖。两项目标5轮、整文件34项2轮均默认5秒通过，兼容处理恢复及异常清理已另验；见[默认时限补修验证](formmanager-default-2026-10-15.md)。此前本地20秒通过、默认超时及独立复跑记录作为历史保留。正式build、lint及严格probe类型检查均退出0；正式build不覆盖probe入口，严格vue-tsc单独执行。较早620/621/634/638/655轮次仅作历史过程，不替代最终结果。原正式结构及保存重开三档转换、错误方向拒绝用例随全套回归再次通过。

最新默认全包日志及源码身份见[新manifest](evidence/formmanager-default-2026-10-15/manifest.json)。此前补修日志：[20秒全包](evidence/p2-followup-2026-10-15/full-tests.log)、[构建](evidence/p2-followup-2026-10-15/build-final.log)、[lint](evidence/p2-followup-2026-10-15/lint-final.log)、[严格类型](evidence/p2-followup-2026-10-15/types-final.log)。严格类型成功无诊断输出，退出状态另记在manifest，空日志不是未执行。

- 当前全包：`pnpm test`；此前20秒命令仅为历史对照。
- 正式构建：`pnpm build`，保留既有大chunk提示，不当作类型/天然异常通过。
- 源码/格式：`pnpm lint`与源码diff检查；原始证据目录保留字节。
- 严格探针：`pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json`。

本地Node24；当前默认全量无20秒覆盖，Playground既有真实FormCreate单例60秒预算未改。本轮兼容处理仅作用于components.test.ts，不改生产默认。Node22/24远端CI及消费者安装下限未经本分支验证，不能引用PR #92的旧CI替代。

## 5. 实现裁定与代价

1. 沿用批准输入和专属执行账本，数字任务标题只适配工具，不改变A/B验收编号；避免混用历史结果。
2. EP局部绑定只从实际描述属性提取准确值类型，运行时仍是原组件；unknown仅桥接不兼容声明，不放宽props。若库版本变更需重验，不能宣称所有peer版本通过。
3. 历史ProbeDesignState保留原结论，新合同走独立入口；旧负向测试不能被改成新策略成功来掩盖差异。
4. 属性撤销记录不覆盖core私有结构登记；结构操作先副本核验并沿用已修复守卫，不承诺任意篡改core方法后的通用事务。若遇该类真实失败需停止并审阅内核接缝。
5. 图投影包含不可枚举引用与特殊属性名，忽略只读创建的空数组；不是任意BPMN语义规范化。保持校验还需要完整候选字节等价及身份稳定的证明。
6. 开始显示字段时即锁定基础；受控操作只可刷新clean且无未捕获输入的上下文。未知外部变化可能保守要求重确认，不能把它们当新基础静默覆盖。
7. 解析成功的表单选择绑定生命期依赖；失效文本保持既有引用修复语义，不签发假旧引用。当次候选仍锁住全部实际对象及读集。
8. 只读比较材料与原实例保持挂载；所有stage/touch/save回调核对租约。资源代价未定，不能选定单例重建默认策略。
9. 新租约改变覆盖范围，未证明等价时重验但不等于文档编辑；候选后发覆盖先发，最终消费再验签发凭据，旧失败不清新通过。
10. 捕获失败标为输入待确认，不能沿用“当前校验通过/当前已保存”；宿主旧记录存在与当前dirty分开。
11. dispose是宿主通过离开保护后的终止动作，立即失效引用/租约/请求；正式宿主卸载保护仍需接入。探针切换是可丢弃实验，不代表正式产品离开体验。
12. A4增加modelRevision重投影及字段flush/capture接缝，根导出/分包不变；准确发布名称、迁移和最低版本支持仍须发布前审阅。

## 6. 剩余阻断与下一步

A/B本轮仅解除B02/B05的阶段零可行性门槛，不直接发布接口或进入正式工作台。B01主题/弹层隔离、B03全部内部状态/天然异常、B04资源预算/容器任务仍需独立补充方案、实施及复审。未自动降低双主题、密度、隔离或保真范围。

下一步由agent先整理C/D补充方案与E测量协议，维护者审阅后再执行；本轮不自动开工后续组，也不推送。

## 7. 独立复核

本轮固定`247acb4..83ec03d`独立复核Critical 0、Important 1、Minor 0，原四项已符合规格，新增定位/结构入口捕获失败的覆盖失效遗漏。执行方在`1506b16`用两条失败回归补修，最终657项及严格类型/构建/lint通过；最终head没有二次独立全审。独立亲跑95项与五条补充测试（3通过/2失败）、严格类型；655全量/浏览器只核读。详见补修验收及独立复核记录。以下为此前历史阶段。

新上下文审阅者只读核对`e78d56a..f2e8f4c`，确认B05，发现A04/A06三个Important；无Critical/Minor。独立重跑A/B 74项、designer 184项及严格类型，另写三项真实Vue复现并全部观察到失败。没有冒充独立重跑全包或浏览器。

执行方将三项纳入`contract-location.test.ts`并观察失败，修复后A/B 78/78、原复现3/3、全包638/638、build/lint/严格类型和浏览器补验通过。`10b66f4`、`9c8a8f5`修改仅限probe的基线、flush检查与恢复重绑，没有扩大生产白名单。按已选执行方式完成一次补修，没有派第二次复审；因此结论是“独立复核发现项已由失败回归与执行方全量验证闭环”，不是“修订head再次独立审阅零问题”。

逐项问题、未判定范围与处置见[独立复核](independent-review.md)；全部施工裁定及误判代价见[裁定归档](contract-rulings.md)。原始红灯、补修绿灯及修前manifest均保留，不重写旧证据。
