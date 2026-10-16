# B03 最小生产修复提案

状态：待维护者审阅；未授权实施。日期：2026-10-16。

本轮只提交书面提案与[薄切片计划](plans/2026-10-16-b03-minimal-production-fixes.md)。沿用本地阶段零分支，以`686ecc0`的C交付为证据基线，不宣称C已合入develop。实施前重新核对develop及C前置提交是否已具备；不自动迁入未合并代码。

## 1. 目标、顺序与出口

保持已确认的“切换保留输入，保存统一收集”合同，按 **数值/日期中间输入 → 文字空串 → 拖拽取消** 推进。交付的是`@flowduet/form-create`中可复用的编辑能力及Playground验收接线，不实现工作台。

- R不采用，不修R恢复、不引入实例淘汰/容量策略，K仅作为当前验收参照。
- 本提案推荐新增显式`editingMode="retained"`；默认`legacy`维持现有独立组件行为。B03未来通过的范围必须写明retained模式，不能宣称默认FormManager或任意宿主已无损。
- 原始未完成输入留在编辑会话，不能塞进流程设计文档冒充合法定义。无法收集时保留输入并返回阻断；不会保存旧值后报成功。
- core、designer、设计文档格式、引擎/部署合同、依赖与lockfile均不改；不新增包、不fork、不启用Pro，不实施D/E、主题、布局、资源预算、正式工作台或推送。
- App默认超时为独立`APP-T`项，见§8；OS输入法、native pointercancel和ERR05自然失败继续独立记账。

**当前不能保证锁定版本能够完成非重建的画布取消。** §5设独立接缝门：没有足够公开能力就停在P3，交回准确的替代提案，不能用`setRule`重建或私有Sortable方法凑通过。P1/P2可以分别交付，不因此宣称B03出口已通过。

## 2. 已证实的事实与尚未证实的能力

本轮仅静态核读仓库与已安装的锁定依赖，未新增运行实验。以下事实与C的[验收记录](system-v1/probes/editor-state-acceptance.md)、[原始目录](system-v1/probes/evidence/form-state-2026-10-15/README.md)交叉核对。

| 事实                                                                            | 定位/证据                                                           | 对方案的约束                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `exportContent()`先blur本实例活动元素再调用第三方成对序列化                     | `packages/form-create/src/components/FormDesigner.vue:72–80`        | 仅拦保存不能防止导航时blur；不能把失焦后的值当成失焦前原文                                     |
| 原生number输入`-`时DOM value为空但badInput=true；K导航后badInput丢失            | C的`final/C2-pending.json`，F03顶层/列内共6行                       | 不能从空value事后还原`-`，需要在浏览器归一化前拥有文本缓冲                                     |
| 日期`2026-`在K导航后变成`2026-01-01`                                            | 同文件F07共6行                                                      | 缓冲必须独立于DatePicker的blur归一化                                                           |
| F01/F02清空导出丢value，显式装载空串可保留                                      | `final/C1-edit-F01.json`、F02，共4行                                | 区分有值、显式空串和未设置；不得给所有缺省value补空串                                          |
| checkbox已用提供者编辑态标记保护`[]`，导出移除标记                              | `components/checkbox-defaults.ts`、`designer-config.ts`             | 复用其思路与递归规则口径，不改变checkbox既有含义                                               |
| FormManager提交成功会关闭编辑器，失败保留；保存前经commitPendingEdit收集        | `components/FormManager.vue`；`apps/playground/src/App.vue:247`附近 | 不把失败映射成成功，不静默关闭；不改变宿主原子保存和竞态合同                                   |
| FormCreate提供componentRule、自定义组件、getRule/getJson/setRule、triggerActive | 锁定`@form-create/designer@3.5.0`的`types/index.d.ts:244, 527–564`  | 可作为扩展候选；尚未证明回调对象身份和每实例注入满足缓存生命周期                               |
| getRule导出的是复制/解析后的树，setRule会clearActiveRule并重建内部规则          | 同版本`dist/index.es.js:20930`附近                                  | 不把getRule结果当活引用；取消不能靠整树setRule回滚                                             |
| 画布Escape后仍加入字段，3次重现；原生拖出区释放可保持树                         | `final/C3-drag.json`、`C3-layout.json`                              | Escape按失败处理；DOM拖影消失不等于取消成功                                                    |
| 包内FcTree有自己的Escape取消实现，通用画布的声明未给出同等取消API               | 同版本`dist/index.es.js:19704`附近及公开类型                        | 不能把大纲树的私有实现推广成画布能力；也不据此声称所有可行路径已被穷尽                         |
| 当前FormManager的Dialog默认允许Escape/遮罩关闭并destroy-on-close，缺少关闭保护  | `FormManager.vue:265–284`及锁定EP的dialog/use-dialog公开配置与实现  | retained必须独立保护关闭；关闭手势还须先于blur检查；before-close不拦所有程序化销毁，legacy不变 |

源依赖使用`@form-create/element-ui@3.3.4`作渲染工厂，Vue3/Element Plus作当前基座，遵循ADR-0006。不得因包名另换提供者。现有公开类型未证明的能力必须在P0/P3门中取得证据。

## 3. 推荐路线与替代方案

| 路线                                                                                 | 取舍                                                                    | 裁定                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------ |
| 所有导航前强制blur并收集                                                             | 改动少，但正是数值/日期原文变化路径，且不能保存非法中间输入             | 不采用                         |
| 改成完整自有属性面板或更换/fork设计器                                                | 控制力强，但涉及更大组件/依赖/交付范围                                  | 本轮不采用                     |
| 显式retained模式：自有默认值输入缓冲，复用FormCreate公开扩展；取消单独验证非重建通道 | 新增小型组件与公开只读/捕获边界，隔离旧消费方式；公开接缝不足时明确停片 | 推荐，需审阅本规格及计划后实施 |

retained只接管F03/F07的默认值文本，以及P2中F01/F02的存在性编辑；不重写八类字段的全部属性区。静态选项、必填、标题等仍用现有提供者控件，保留原生回归，不能把新入口通过推广到其未确认弹层/单元格。

## 4. P1/P2：原始输入、值存在性与捕获合同

### 4.1 拥有原文，保持单一设计定义

新增每个FormDesigner实例独有的编辑状态控制器。数值使用文本承载（如text+inputmode），不能继续依赖原生number控件保存`-`。日期的手工文本与日历确认分开：原文由自有组件持有，日历仅在用户明确选定时提交有效值，不能在blur时把原文归一。保留日历能力，不把它静默降为纯文本输入。

缓冲保存raw文本、存在性、组合状态、待回显状态及最后确认的业务值，归属“组件实例/文档装载世代 + 字段生命期”。它不是第二棵可写规则树，不写FlowDesignSession，不进rules/options。合法输入通过公开v-model/组件事件进入原规则；未完成输入不覆盖旧业务值，但会阻断整份候选，不能让旧业务值继续被当作当前可保存值。

身份接缝先验证：公开componentRule回调的rule参数可以作为不透明对象token候选，但不得假定它在切字段/拖动时保持引用，也不得以getRule的复制对象或仅field字符串作为身份。P0必须证明每实例归属及删除时点失效；若无法识别“删后立即复用同名field”，就停片。只有已授权的销毁/文档替换收尾才清理当前实例状态；未知替换有待处理输入时先保留旧实例/比较并阻断，不先清空，也不自动重用旧缓存。K隐藏不触发清理；具体关闭合同见§4.4。

### 4.2 数值/日期的确切行为

- `-`、`+`、`.`、`1.`、`1e`等未完成数值保持原文；合法有限数值如`0`、`-2`、`1.5`、`.5`、`1e3`进入原规则为number，原文字形仍可在K导航中保留。禁止用`Number("")`或宽松parseFloat把缺项/尾缀变0/有效数。
- 数值空白表示未设置，`0`不是空白；不接受Infinity/NaN。原文不静默trim，输入非法空格时保持并提示。
- 正常date编辑的确认形态为`YYYY-MM-DD`且是真实日历日期；`2026-`、`2026-02-30`不能被自动补齐或滚动为另一日期。
- I01的省略/date/datetime/week/month/year六类既有单值导入继续原样往返，不新增类型切换入口，也不一律改成date。未编辑的原定义（含既有valueFormat）按原守卫处理。编辑非普通date或自定义valueFormat前，P0须明确证明公开控件的解析/确认口径；不能安全处理的编辑保留原文并返回unsupported-input，不偷偷猜格式或扩大文档全局校验。
- 尚未确认的本实例弹层、来源不明输入和组合中间态不能捕获。别的FormDesigner活动元素不得被本实例blur或收集。
- 普通中间输入已经落到自有缓存后，`canSuspend=true`、`canCapture=false`，允许K跨表单/阶段再返回。组合中、拖动中、缓存尚未绑定字段或归属不明时两者均false；宿主在pointerdown/快捷键动作之前检查，保留当前上下文并明确提示，不等click失焦后才检查。
- 合法输入尚未经Vue公开prop回显时返回pending-update；宿主可在UI入口等待一次nextTick后重读。`EditorAdapter.flush/capture`仍为同步签名，不改A/B控制器，不增加定时sleep或无限重试。

### 4.3 拟新增的公开接口

这是审阅中的目标合同，不代表现有组件已经提供。新增`editingMode?: "legacy" | "retained"`，默认legacy；FormManager同名prop透传到当前FormDesigner，同时按§4.4提供状态查询/转发和retained关闭守卫，不引入表单目录缓存或阶段导航。模式只在挂载时读取，运行时prop变化不切换实现并明确报告unsupported-mode；需要改变时由宿主经既有显式放弃/替换确认后另开实例，不做自动重建保真。

```ts
export type FormDesignerBlocker = Readonly<{
  code:
    | "not-ready"
    | "pending-input"
    | "pending-update"
    | "composing"
    | "dragging"
    | "unknown-owner"
    | "unsupported-input"
    | "unsupported-mode"
    | "version-changed"
    | "disposed";
  field?: string;
  message: string;
}>;
export type FormDesignerEditingState = Readonly<{
  mode: "legacy" | "retained";
  revision: number;
  canSuspend: boolean;
  canCapture: boolean;
  blockers: readonly FormDesignerBlocker[];
}>;
export type FormDesignerCaptureResult =
  | { status: "captured"; revision: number; content: { rules: string; options: string } }
  | { status: "blocked"; blockers: readonly FormDesignerBlocker[] }
  | { status: "failed"; message: string };
// FormDesigner实例新增；DTO类型从form-create根入口增量导出。
declare function readEditingState(): FormDesignerEditingState;
declare function captureContent(): FormDesignerCaptureResult;
// 新增Vue事件，载荷为只读快照：editingStateChange(state)。
```

- readEditingState只读，不blur、不序列化、不推进revision或draftChange。revision仅是本实例编辑版本，不替代EntityRef、租约、ValidationStamp或保存世代。
- captureContent仅在retained模式提供新合同；legacy返回unsupported-mode，旧调用方继续用原exportContent。捕获先检查全部本实例未处理输入，再成对序列化，并核对前后本地revision；失败不发save、不确认持久化、不改session。返回值不暴露raw缓存、第三方实例或内部规则引用。
- 未接管的第三方控件若还有公开提交未确认的输入，captureContent返回blocked并引导原生确认，不用getJson里的旧值成功，也不为了收集而强制blur。P0/P1须验证可识别这些状态；若只能永久拒绝既有有效工作路径或无法保留其导航输入，应停片补接缝，不把覆盖范围静默缩小。
- retained中的exportContent保留原`{rules, options} | null`签名：captured返回成对内容，blocked返回null，failed仍抛Error供既有调用方catch；legacy维持原方法，包括本实例blur。旧save/cancel/draftChange签名不改。
- retained工具栏保存和FormManager.commitPendingEdit走同一捕获入口，blocked/failed显示明确原因并保持编辑器打开；成功提交仍按既有守卫与提交路径收尾；retained中的取消先按§4.4取得明确放弃授权，legacy取消维持原行为。FormManager.hasOpenEditor/commitPendingEdit的签名不变。
- editingStateChange与draftChange分工明确：真实输入/结构变化仍上抛draftChange；只读观察、K纯隐藏/显示不伪造编辑或保存。宿主只在控制器校验章有效且所有相关编辑器可捕获时展示当前通过；不另造一套保存/校验状态机。

### 4.4 retained FormManager：状态、隐藏与关闭

本节补齐`3e8425b`复审P2，是目标合同及未来实施范围，不代表当前FormManager已有保护。当前源码的ElDialog允许Escape/遮罩关闭且destroy-on-close；before-close不是程序化赋值和父组件卸载的通用拦截器，不能只给Dialog加一个回调就宣称全部路径安全。

#### 4.4.1 状态查询与转发

FormManager新增只读实例方法`readEditingState(): FormDesignerEditingState | null`，retained下转发`editingStateChange(state: FormDesignerEditingState | null)`。不增加新的DTO，不公开子组件ref、raw缓存或强制关闭方法。

- 当前编辑器已就绪时，方法返回子组件只读快照；调用不blur/捕获、不修改revision、不发draftChange。retained在首次就绪、实际状态变化和授权销毁收尾时转发状态，不把查询本身变成事件。
- 编辑会话已打开但子ref尚未就绪，或正在授权关闭的动画/卸载收尾中，返回mode为retained、canSuspend/canCapture均false、not-ready原因的快照，不能用null假报“没有待处理编辑器”。只有没有活动/收尾中的编辑器时返回null。该占位快照不签发可提交版本，也不替代hasOpenEditor或A/B身份/租约。
- 每次打开编辑器签发内部唯一`editorInstanceKey`，即使formId相同也不复用。retained的子事件、save/cancel和关闭请求回调须绑定这个key，当前实例匹配才转发或处理；旧子实例、旧关闭动画的迟到事件不能清空/覆盖新实例状态。
- legacy不新增自动状态转发或关闭守卫；新增查询只读代理已有子状态（legacy为unsupported-mode，未就绪时同样不可捕获），没有编辑器时null。原方法/事件及原默认交互不改。

#### 4.4.2 K隐藏、销毁与明确放弃

| 动作                       | retained合同                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| K隐藏/阶段切换             | 仅在canSuspend为true时隐藏，保持同一挂载实例、字段生命期、raw/存在性及租约；不清缓存、不提交、不报保存成功                        |
| Dialog关闭/卸载            | 属于销毁，不能依据canSuspend或canCapture直接放行；必须有当前会话的成功提交或明确放弃授权                                          |
| 关闭X、遮罩、表单取消按钮  | 都是“请求关闭”，不是放弃授权；忙碌时拒绝，普通中间输入虽可K隐藏也必须经放弃确认才能销毁                                           |
| 明确放弃并关闭             | 用户肯定选择放弃当前表单全部未提交输入后，复验实例key/版本并只销毁该会话；不发updateContent/save，不改变session、持久化或另一表单 |
| 成功保存/commitPendingEdit | 捕获与既有内容守卫/提交路径成功，且仍为同一活动会话时才关闭；blocked/failed或过期回调均保持打开                                   |

本轮不新增FormManager的K隐藏接口或多表单缓存；K导航实验直接使用保持挂载的FormDesigner。不得用`editVisible=false`模拟K，也不能假定父级v-show会隐藏teleport的Dialog。宿主若要隐藏FormManager中的Dialog，须另有证明保持挂载/原输入的通道，否则不能声称该入口支持K。

retained统一关闭入口必须同时覆盖公开before-close通道、表单cancel回调、成功提交收尾和内部程序化关闭；所有`editing=null`/`editVisible=false`都受同一会话授权约束，不依赖before-close会自动覆盖它们。X/遮罩共用dismiss策略，不假定Element Plus会提供准确的关闭来源参数。

关闭触发也必须做前置保护：对本FormManager的X/遮罩/取消控件，在会转移焦点的pointerdown或键盘激活前读取状态，busy时防止该关闭手势先blur/结束组合；不能只等click/before-close后再检查。被拒绝的手势即使之后还到达click，也不能自动变成新的关闭授权。仅使用公开Dialog配置、slot和自己拥有的事件归属，不依赖第三方私有DOM类；P0须证明该入口不会吞掉IME本身、正常输入或另一实例的事件，公开能力不足则停门。

每个关闭请求从事件所属会话取得editorInstanceKey，不在迟到回调进入时重新读取“当前key”来冒充来源；任何等待（包括nextTick）后都先核对仍是该会话和模式，再继续确认流程。

关闭请求先读取状态：not-ready、组合中（含compositionend同一Vue刷新内）、拖动/取消待确认、unknown-owner或其他canSuspend=false状态均保持原编辑器，不弹出会抢焦点的放弃确认；必要时仅为pending-update在一次nextTick后重读，仍未就绪就拒绝，不循环等待。不能把canCapture=false的普通中间原文误当必须先修正才能放弃：它已安全绑定且canSuspend=true时，可以进入明确放弃确认。

确认文案固定为“放弃本表单全部未提交修改并关闭？”，选项为“继续编辑”/“放弃并关闭”。关闭确认本身的Escape/X/遮罩取消、Promise拒绝或异常都视为未授权，原表单保持打开，不先销毁再试图恢复。明确放弃无需合法序列化中间原文；不能偷偷先调用commitPendingEdit写入旧/部分输入。

打开确认前记录内部editorInstanceKey与子revision；肯定答复后重新查询，若会话、模式、版本或就绪状态已变化，拒绝旧答复并保留新输入，不能将它套给同ID重开的表单。最终复验到授权关闭的同步段无await；授权为内部一次性标记，不新增forceClose/bypass对外参数。开始销毁时即撤销旧会话的回调资格，销毁收尾后的null也只能属于当前关闭key；新实例已打开就不能转发旧null。

父组件强制unmount/路由或设计文档替换不能靠Dialog守卫拦截。宿主必须在破坏性动作前查询状态，并沿既有显式放弃/文档替换确认合同处理；未确认的未知替换保留旧实例/比较并阻断。FormManager不承诺在外部强制销毁之后自动找回raw，亦不因此新增存储协议。

#### 4.4.3 Escape优先级与legacy兼容

retained的Dialog明确关闭`close-on-press-escape`自动关闭，X/遮罩走上述守卫；不能只靠某次stopPropagation保护，因为键事件可能由IME、teleport弹层或原生拖动发出。无全局“Escape即放弃表单”的监听。

按当前实例归属和公开状态依次处理：

1. **IME组合中及结束同一Vue刷新内：** Escape先交输入法处理，不以preventDefault吞掉其原生语义，不触发表单取消或拖动取消，Dialog保持打开。
2. **归属明确的内部弹层：** 先由原控件处理Escape关闭/取消弹层，不升级为放弃表单；归属不明保持阻断，不操作另一实例。
3. **当前活动拖动/取消请求/settling或uncertain：** P3通道通过后只请求本事务取消，重复键和迟到结束不能重复提交；未支持时明确unsupported并保持Dialog/输入，不假报取消，也不退化为关表单。
4. **其他/空闲状态：** Escape不自动关闭retained表单。用户通过X、遮罩或取消按钮进入明确放弃流程；放弃确认框的Escape只取消确认、返回原编辑器。

P1先实现状态转发、关闭守卫和不让Escape销毁编辑器的保护；P3再接入经证明的拖动取消能力。不能为提前通过P1而声明P3已具备。键盘路由、事件消费和归属必须在真实FormManager及双实例中验证；不能只测调用requestDragCancel的方法。

legacy保持原ElDialog的Escape、遮罩、X、表单取消和销毁时序，不增加确认、吞键或新缓存；独立FormDesigner的save/cancel/draftChange签名也不变。retained新增确认及Escape不关闭表单是显式模式的兼容差异，必须进入包README，不能静默变成默认。

### 4.5 文字空串与未设置

P2的TextDefaultEditor持有原文并复用P1状态控制器；retained模式为F01及F02提供明确“设置默认值”开关，沿用checkbox的存在性心智：开启且空白是自有`value: ""`，关闭是没有value。从非空文字清空仍保持开关开启；未设置字段首次装载不因UI空输入自动变成显式空串。多行输入使用同一存在性合同。

复用checkbox既有编辑态标记/成对序列化思路，新内部常量固定为`TEXT_DEFAULT_STATE = "__flowduetTextDefault"`（不进根导出）。文本标记和raw缓存不能进入设计文档：加载时忽略外部注入的文本标记，以实际value存在性初始化；导出时恢复文本空串并递归移除新标记。只对type=input且text/textarea的默认值处理，不把number0、switch false、checkbox[]或其他字段缺省值改为空串。现有checkbox实现和标记清理合同保留。

内部`prepareTextDefaults(rules: FieldRule[]): void`与`restoreTextDefaults(rules: FieldRule[]): void`只原位处理边界新解析的临时数组：装载先经现有prepareCheckboxDefaults取得数组再处理文本，导出先经现有restoreCheckboxDefaults再恢复文本/清标记。不得传live session的规则引用，也不需要为组合两种存在性反复JSON序列化。

本轮不迁移设计文档、不改JSON版本、不扩大form-schema开放范围。外部输入仍经既有守卫，编辑器生成的新标记必须在所有保存/捕获出口被剥离。若需要修改全局解码/校验协议才能实现，停片回审。

## 5. P3：拖拽取消必须是可核验的非重建事务

### 5.1 接缝门与边界

先在锁定依赖、真实菜单/画布/栅格路径验证：能否通过公开事件/钩子取得拖前快照、明确拖动结束、阻止已请求取消的结构提交，并保持原实例与原始输入。不读写`setupState`、`_sortable`、`__rule__`、私有dragState，不调用FcTree私有cancelDrag，不合成native事件冒充OS行为。

公开getRule可用于规则比较；不能用其复制树直接编辑提供者，也不能用setRule、重新挂载、改key、undo私有历史或整份文档替换做取消回滚。它们会把R已拒绝的恢复风险带回本轮，并破坏字段身份/上下文。

门失败的确定结果：P3不通过、保留原生失败证据，输出缺少哪个公开生命周期/提交钩子的准确提案；依赖升级、上游补丁、DragBox替换或自有完整拖拽实现都须另审，不纳入本提案自动授权。

### 5.2 门通过后才实施的目标合同

内部每次拖动带递增transactionId，区分idle/dragging/cancel-requested/settling/uncertain；取消请求不等于已取消。作用域仅为事件来源实例，未确定结束前canSuspend/canCapture=false；迟到mouseup/drop/dragend不能提交已取消事务或影响下一次事务。

拟增加以下接口，只有P3门通过后才实现及增量导出第四个DTO；不提供永远成功的空实现，也不把Escape改成“取消编辑表单”。

```ts
export type FormDesignerDragCancelResult =
  | { status: "requested"; transactionId: number }
  | { status: "not-dragging" }
  | { status: "unsupported"; message: string }
  | { status: "blocked"; message: string };
declare function requestDragCancel(): FormDesignerDragCancelResult;
```

同时在EditingState增量增加只读可选`dragCancellation: { transactionId: number; status: "requested" | "cancelled" | "uncertain"; message?: string }`。新拖动开始清除前一结果；editingStateChange只报告当前事务。调用方须匹配transactionId且看到cancelled才能显示取消完成；回到可捕获状态或仅收到dragend均不构成取消成功。没有结束证据时保持uncertain/阻断，不用超时自动判成功。

仅在真实结束且已核对规则树（类型、字段、顺序、列归属、value存在性、选项）与拖前等价，原焦点/选中字段/待提交原文仍在、候选/session/DI及另一实例未被误改时才显示“已取消”。完整规则及原始输入不能恢复时进入uncertain并保留现有比较，禁止保存/通过标记；不能报取消成功再后台覆盖数据。

正常drop只保留最终布局，禁嵌套继续生效。Escape、拖出有效区、pointercancel分列；真实native pointercancel拿不到时仍未知。拖动取消本身不是持久化成功，既有A/B版本与候选屏障不改。

## 6. 修改文件白名单与责任

下表是**未来获批实施**的候选文件，本轮不创建或修改这些产品文件。

| 文件                                                                                                        | 责任/允许变化                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/form-create/src/editor-state.ts`（新）                                                            | 三个公开DTO；不依赖probe类型                                                                                  |
| `packages/form-create/src/components/editor-input-state.ts`（新）                                           | 每实例raw/存在性/组合/回显与字段生命期；不保存整棵规则树                                                      |
| `packages/form-create/src/components/NumberDefaultEditor.vue`、`DateDefaultEditor.vue`（新）                | 拥有手工原文，公开v-model/日历确认，禁止DOM回写或私有provider状态                                             |
| `packages/form-create/src/components/designer-config.ts`                                                    | 保留DESIGNER_CONFIG作为legacy配置，新增按实例创建的retained配置；只接管批准字段                               |
| `packages/form-create/src/form-create-setup.ts`                                                             | 仅如P0证明必要，幂等注册无实例状态的扩展组件；禁止把缓存挂全局                                                |
| `packages/form-create/src/components/FormDesigner.vue`                                                      | editingMode、只读/捕获入口、状态事件及工具栏失败显示；legacy分支保留                                          |
| `packages/form-create/src/components/FormManager.vue`                                                       | 模式透传、状态查询/转发、统一关闭授权与Escape优先级；retained捕获失败保留，legacy默认不变；不实现多表单工作台 |
| `packages/form-create/src/components/TextDefaultEditor.vue`、`text-defaults.ts`（新）                       | 文本存在性准备/恢复，参考既有checkbox helper；若需共享遍历只作局部提取，不改checkbox语义                      |
| `packages/form-create/src/components/drag-transaction.ts`（条件新）                                         | 仅P3公开接缝门通过后创建；事务状态/结束核验，不含规则重建兜底                                                 |
| `packages/form-create/src/index.ts`、`packages/form-create/README.md`                                       | 三个状态/捕获DTO增量导出及明确mode范围；取消DTO仅P3通过后加                                                   |
| `components.test.ts`、新`editor-input-state.test.ts`/`text-defaults.test.ts`/条件`drag-transaction.test.ts` | 真实提供者 + 纯状态机/存在性回归；保留全部旧断言与默认时限                                                    |
| `apps/playground/probes/stage-zero/form-repair/*`、`ProbeApp.vue`、既有候选测试入口                         | 接缝样稿、K retained接线、矩阵/故障回归；仍使用现有A/B store/controller                                       |
| `docs/design/system-v1/probes/*`及新的独立evidence子目录                                                    | 增量结果、旧失败对照及验收裁定；不覆盖C历史字节                                                               |

不得改`core`、`designer`、session/document/form-schema/binding/export生产合同，不再扩展A/B controller；不得让App.vue、App.integration.test.ts、全局测试配置或依赖变更混入此白名单。若S0证明需要白名单之外的接缝，给出失败样本和准确文件/API，暂停相关片等待审阅。

## 7. 验收矩阵

每行同时记录requestedMode/actualMode、K策略、field/布局、对象生命期/租约、原DOM输入、捕获结果、候选和live session/forms/model/DI、persist次数、来源、head和原始文件。顶层/列内均执行；关键导航、组合结束和取消轨迹各独立重置3轮。表内条件行未满足不得勾通过。

按字段和子能力展开逐片验收：P1先验数值/日期及FormManager关闭保护，M05只验“取消尚未支持也不误关”；P2补文本子项，P3再验M05的真实取消。后续片尚未实现的子项记待执行，不计通过，也不反向阻止前片独立交付；最终B03出口仍要求所有适用项满足。

| ID      | 输入/动作                                                                     | 必须满足的结果                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B03-N01 | `-`、`1.`、`1e`保持焦点；A→B→A/阶段跳转                                       | 原文保持，canSuspend=true，capture blocked，live session与persist零写入                                                                                |
| B03-N02 | `0`、`-2`、`1.5`、`.5`、`1e3`                                                 | 确认后为有限number；0非缺省，K返回保留原文字形                                                                                                         |
| B03-N03 | 空白、非法空格、NaN/Infinity文本                                              | 空白为未设置；非法保留并阻断，不截断/补0                                                                                                               |
| B03-N04 | `2026-`、`2026-02-30`、合法闰日/日历选择                                      | 前两者不补齐、不滚动；用户确认的有效日期按现有格式进入规则                                                                                             |
| B03-N05 | I01六类形态及已有自定义valueFormat，先不编辑再尝试编辑                        | 未编辑原样往返；未证明的编辑明确unsupported且原文保留，不转普通date                                                                                    |
| B03-N06 | 组合中/结束同一Vue刷新前/刷新后                                               | 前两者拒绝捕获和破坏性切换；刷新回显后再判断，不用事件协议替代OS输入法                                                                                 |
| B03-N07 | 同ID双控制器/两表单/本与外来弹层                                              | 缓存、焦点、候选互不串入；不全局blur，正常按钮与局部快捷键分别测                                                                                       |
| B03-N08 | 字段删除、同名ID即时复用、文档替换、卸载、显式还原                            | 旧缓冲不套新对象；只放弃明确确认的对象，不能只做最终ID差集                                                                                             |
| B03-T01 | F01/F02装载`""`、非空→清空、原未设置                                          | 显式空串存在；原缺省保持没有value；顶层/列内均通过                                                                                                     |
| B03-T02 | 开关关闭/再开启；切表单、保存重开                                             | 关闭是未设置，再开启空白为显式空串；存在性往返不变                                                                                                     |
| B03-T03 | number0、switch false、checkbox[]/未设置、radio/select的0与"0"                | 原业务类型/存在性和选项顺序不变，不串文本修复                                                                                                          |
| B03-T04 | 外部标记注入、嵌套col内文本、所有捕获/保存出口                                | 不信注入标记；编辑器输出无新增标记或raw缓存，不改文档版本                                                                                              |
| B03-D01 | F01–F08菜单→顶层/列内，跨列/排序/禁嵌套                                       | 最终树正确、字段唯一、原有未提交输入保持                                                                                                               |
| B03-D02 | Escape在拖前、拖中、落点前；取消后迟到释放                                    | 无新增/移动残留，原输入/字段上下文保持；“requested”不能当“cancelled”                                                                                   |
| B03-D03 | 拖出区、native pointercancel、合成pointercancel                               | 分别记真实/协议/未知；只有真实树核验通过才确认取消                                                                                                     |
| B03-D04 | 原文`-`/`2026-`/空串尚在，另发起拖动再取消                                    | 不全树setRule、不重挂载；原文、存在性、租约与另一实例不受损                                                                                            |
| B03-D05 | 取消通道缺失/抛错、无结束信号、旧事务迟到                                     | 明确unsupported/uncertain并阻断；不伪造取消、不覆盖新事务                                                                                              |
| B03-H01 | 第一/第二活编辑器capture throw/null/非法JSON/wrong kind/schema非法            | 故障capture实际执行；核对计数/顺序/原adapter和租约；全对象候选失败、两份输入保留、persist=0，修正后重试含最新值                                        |
| B03-H02 | public exportContent、工具栏、FormManager.commitPendingEdit、新captureContent | 同一retained捕获口径；legacy签名/默认行为不变；失败不关编辑器；关闭/放弃另验M01–M08                                                                    |
| B03-H03 | 输入/租约在捕获边界变更、只读查询、纯K切换                                    | 原A/B版本屏障继续拒绝旧结果；只读/纯切换不新增编辑或保存确认                                                                                           |
| B03-M01 | FormManager状态查询、就绪前/收尾中、同ID重开及旧事件晚到                      | query不blur/改版；活动未就绪返回blocked快照，完全无编辑器才null；旧key事件/save/cancel/null不影响新实例                                                |
| B03-M02 | `-`/`2026-`可K隐藏，但尝试Dialog关闭/销毁                                     | direct FormDesigner保持挂载可返回原文；FormManager关闭不因canSuspend=true而获授权，不拿v-model=false当K                                                |
| B03-M03 | X/遮罩/取消按钮；继续编辑、肯定放弃、确认框关闭/拒绝/异常                     | 关闭手势先于blur查状态并抑制被拒绝的后续click；共用守卫，未肯定放弃仍保留原实例/raw/字段上下文；肯定后才销毁，无updateContent/save/persist             |
| B03-M04 | composition中/结束同一刷新内/空闲及内部弹层的Escape                           | IME/弹层优先，Dialog不关闭；空闲Escape也不弃表单；协议与OS真实来源分列                                                                                 |
| B03-M05 | FormManager拖中/已请求取消/未确认结束时Escape和重复键                         | 只路由本事务；P3未支持则unsupported并保持打开，通道通过后才验真实取消；另一实例不受影响                                                                |
| B03-M06 | 放弃确认等待期间新输入、同ID重开、文档替换、旧肯定答复                        | 从事件所属key开始固定请求，nextTick/确认后复验key/revision/状态拒绝过期授权，旧答复/关闭动画不能销毁新输入或清空新状态；外部破坏性替换须先履行宿主确认 |
| B03-M07 | retained捕获blocked/failed、有效提交与明确放弃后重开                          | 失败保持打开；有效提交仅按既有守卫提交/关闭一次，非持久化确认；明确放弃重开只装载当前会话已提交的定义，不复活旧raw，另一表单不变                       |
| B03-M08 | legacy缺省及显式legacy的Escape/遮罩/X/取消/提交                               | 既有行为/签名和全部业务断言保留，不新增确认/吞键/销毁延迟；新增只读查询不改变状态                                                                      |
| B03-V01 | OS真实输入法、真实跨实例弹层/native pointercancel、ERR05                      | 有具体环境与最小动作；未取得证据保持未验证，不用人工throw补绿                                                                                          |

新证据必须独立于C的326条目录，逐条映射被修的19行。协议、真实UI、OS、人工适配器异常及自然失败分开。B03-N/T/D/H/M任一适用行失败或V01仍未知，B03不能解除；R不纳入本轮成功路径。

## 8. App默认超时单独列项（APP-T）

C在多个默认全量中观察`App.integration.test.ts:68/:1640`等5秒超时，最后`c53004e`默认748/748通过；排除C入口的190/190只是诊断。尚无足够因果证据把旧App超时归结为某一组件或认为已经根治。

APP-T独立顺序：固定head/命令/后台负载，拆mount、flush/等待、自动导出、FormCreate/Popper字符串化、卸载/迟到任务时段；同文件原生与诊断路径对照，验证原描述符、异步异常及卸载清理。禁止先复制兼容补丁、改全局worker、改默认5秒、删断言或改真实FormCreate。必要的单文件修复必须另出有证据的方案后确认。

候选定位文件为`apps/playground/src/App.integration.test.ts`及其实际调用的App/组件路径；本提案只给只读定位/临时诊断范围，不批准修改这些产品或旧测试文件。APP-T的回归结果不与B03业务修复合并计数，不把最终一次通过称稳定性修复。若影响新片默认全量，记录阻断并转APP-T，不自动扩大本片。

## 9. 停止条件、兼容影响与审阅门

| 条件                                                                                     | 立即处理                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0无法证明自定义编辑器注入、稳定字段归属/删除时点、同步捕获或Dialog公开关闭/键盘接线可行 | 不进入P1生产实现；保存最小证据，重提接缝                                        |
| 只能通过自动blur、DOM回写、私有状态、异步EditorAdapter或整树setRule保真                  | 拒绝该实现并暂停相关片，不降低输入合同                                          |
| P3缺少公开原位取消通道，或结束/输入/结构恢复无法核验                                     | P3停在门，不交付成功取消；依赖/上游方案另审                                     |
| 需要更换依赖、Pro、fork、文档格式/开放范围、分包或白名单外生产改动                       | 停止，列出文件、接口和兼容影响待确认                                            |
| 同ID新对象套旧输入、跨实例污染、部分写入/失效租约恢复                                    | 当前片不通过，先RED→GREEN；不能以其他行通过抵消                                 |
| 默认全量失败、异常清理不完整、成本扩大                                                   | 保留原始输出；当前片不验收，分别进入修复/APP-T/成本复审，不自动扩时限或裁掉矩阵 |
| OS/native/ERR05缺证据                                                                    | 可交实验与部分修复，不解除B03，不改成不适用                                     |

兼容性重点：legacy为默认，旧公开方法/事件/同步adapter/文档格式保持；retained是显式新增能力，新的blocked/null比旧路径更严格是该模式的明确合同。mode不在活动会话中热切换；FormManager的retained状态查询/转发、关闭确认和Escape优先级见§4.4，legacy默认不变。DTO是新增维护面，原始缓存与第三方实现不公开。P2的存在性UI也仅在retained中启用，legacy原有反例仍是已知限制，不被新模式结果掩盖。

本提案与计划通过审阅只允许按所选方式执行这些薄切片及门，不自动授权发布、推送、D/E或工作台。现在需要维护者审阅：新增mode/API、raw身份门、普通中间态可K切换但busy阻断的边界、文本存在性UI、FormManager隐藏/销毁/明确放弃边界与Escape优先级、取消门失败即停，以及锁定retained验收范围。实现方式与执行授权在审阅后确认；本轮不启动任何片。

## 10. 本次复审P2的文档修订范围

补充§4.4、M01–M08及计划P0/P1/P3/P4对应步骤；未来实现会在既有FormManager白名单内增加状态代理、关闭守卫和retained键盘协调，不改变legacy默认。这里是文档自审后的目标合同，不是新的浏览器验证或独立再审；原C证据与748/748历史记录保持原样。本轮不改产品/探针代码、不实施任一片、不推进D/E、不推送。
