# C组状态矩阵与执行记录

基线`develop@10b2a13`；批准文档`7e5b520`迁入`7e4fd3b`。本表是逐片账本，不把入口盘点当成保真通过，B03仍阻断。

## C0 已实际盘点入口

真实Chromium、虚构两表单及同ID双控制器，正常点击所属DragTool选中字段。只读观察已确认保留焦点/文字/选区，不改session和版本。

| 字段 | 实际属性入口（含默认控件）                                                                                                                                                                                                            | 静态选项表数 | 状态           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------- |
| F01  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |
| F02  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: TEXTAREA/; 是否必填: INPUT/checkbox                                                                                                                                                | 0            | inventory only |
| F03  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/number; 是否必填: INPUT/checkbox                                                                                                                                             | 0            | inventory only |
| F04  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 1            | inventory only |
| F05  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 设置默认值: INPUT/checkbox; 默认选项: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                 | 1            | inventory only |
| F06  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 是否可以清空选项: INPUT/checkbox; 选项为空时显示的文字: INPUT/text; 多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词: INPUT/checkbox; 默认值: INPUT/text; 是否必填: INPUT/checkbox | 1            | inventory only |
| F07  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |
| F08  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |

字段ID/字段名称/必填配置均实际在场。F04/F05/F06静态选项表经真实DOM盘点，TableOptions源码确认cell blur/change-type提交；数值/日期中间串、真实drop/cancel与OS输入法仍待相应片验证。L01/I01另验，不能用普通日期代替全部导入形态。

## 执行与证据口径

F01–F08 × 顶层/列内 × 已批准值/清空/选项状态 × K/R，加X01–X09、ERR01–ERR07、L01/I01逐项登记。两策略独立新会话，回退只记kept-fallback。未执行、失败、工具阻断、天然失败未验证均不计通过。

C0基线默认全量657/657、strict退出0；新增语义、原生DOM只读观察及真实空设计器装载13项通过。复杂属性面板的新增HappyDOM测试出现未就绪断言、卸载后hidden错误、默认5秒超时；未改时限或扩大toString兼容，原生焦点业务断言已用Chromium另验，不把13项当全字段浏览器通过。

一次CLI批次的实际page变为about:blank，记工具上下文失败；重新核对URL进入C后重跑通过，不当产品缺陷。当前浏览器仅favicon404，未发现可计ERR05的天然失败。

后续各片结果和缺口逐行补充；完整原始负证据与源码身份在C5归档。

## C1 字段、布局与选项结果

| 类别                                        | 实际执行                     | 结果                                                     |
| ------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| 顶层/列内装载→真实导出                      | 64行，含六种既有日期导入形态 | 64通过；类型、默认值存在性、选项/布局及session不变均核对 |
| 标题/必填/默认值实际编辑与清空              | 34行，含checkbox关闭默认值   | 30通过、4失败                                            |
| 静态选项label、number value、增加、删除首项 | 24行                         | 24通过；number2与string0区分，追加/删除后顺序保持        |

**未修复的合同差异：** F01/F02各在顶层/列内清空文字默认值，导出均删除value而非保留显式空串，4行失败。对应装载显式空串的4行可以保留；差异来自真实界面编辑路径，不能据装载通过推断清空通过。原始期望与输出保留，未改生产FormDesigner，C02/B03继续阻断。

不适用入口：字段ID实际disabled+readonly，按源码FieldInput.fieldReadonly及真实DOM属性记录，不通过去掉disabled操作；本轮改验ID不变。TableOptions只有增删/单元格编辑，没有选项排序控件；排序按钮不适用，已有选项顺序、追加末尾及删除后顺序已验，不伪造排序操作。

探针观察器曾将aria-expanded=false的退场动画弹层算未确认，造成合法选择被错误拒绝；已用失败单元回归证明，再按逻辑展开状态修正，真实选择/日期编辑复跑通过。先前定位错误、只读ID填写超时及旧观察器负输出作诊断历史，不混入上表真实合同失败。

上表共122行，118通过、4失败，仅K；R及焦点/拖拽/完整恢复仍待后续片。实际浏览器脚本/逐行JSON在C5按最终源码重放后归档；本节不将普通字段导出当作单实例恢复或天然异常证据。

## C2 焦点与导航

47项定向回归通过。真实Chromium独立重置3轮：A/B各改默认值，A→B→A及表单→流程→表单，实例/生命期/租约保持、两份输入都保留，session/forms/图不变、persist=0；局部Alt+O不制造编辑，Alt+S取得最新候选。正常按钮与快捷键分别执行。CompositionEvent协议3轮：组合中拒绝捕获，end事件同一轮Vue刷新前拒绝，刷新后取得最新值；这不是OS输入法证据。

原生number输入`-`的DOM value为空但badInput=true，不能当合法空值收集；探针现拒绝且保留原实例。日期`2026-`弹层未确认时同样拒绝。只读快捷键曾穿透第三方keydown监听导致版本增加，现局部拦截Alt+O/S，其他键路由不变；未更改生产组件。真实OS输入法仍工具阻断，C03/C07未通过。外来弹层不抢焦点由原生DOM协议验证，不冒充跨实例原生操作通过。

## C3 拖拽

原生Chromium：F01–F08菜单→顶层/列内16行均实际增添一个唯一字段，并核对列内归属；L01建行、拖动手柄跨列、排序和禁嵌套均核对实际导出树。首次用节点本体未触发移动及遮罩拦截的输出作工具诊断，改用公开UI拖动手柄后重跑，未强制点击。

三轮原生拖动中观察dragging=true，收集拒绝；拖出有效区释放三轮规则原样。三轮Escape后释放仍添加新字段：取消不成立，明确为失败，不能计C04通过。真实pointercancel无法通过当前工具产生，协议派发只证明取消后不擅自解除保护；OS/native pointercancel仍未验证。新增2项拖动边界回归不写规则、结束Vue刷新前拒绝，卸载移除监听；这不替代真实上游回滚证据。
