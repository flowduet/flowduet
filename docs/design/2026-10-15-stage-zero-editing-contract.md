# 阶段零剩余阻断与编辑接口规格

- 日期：2026-10-15。
- 状态：**用户已批准本规格及配套计划，包含A4，按本会话逐片执行A/B；尚未验收或发布。**
- 用户已确认：A→C/D→E 的依赖顺序，B同步处理；未知替换保留冲突输入；首期不自动合并或强制覆盖。
- 产品证据基线：`develop@02d3474044e38e4a15d18a586e503802abe135be`；探针复验及记录：`25d1e8f`、`c58cd0c`、`481fde9`。执行前须重新核对develop，不把本规格日期当作远端状态证明。
- 依据：[主提案](2026-10-14-design-system-workbench-proposal.md)、[ADR-0010](../adr/0010-integrated-designer-delivery.md)、[ADR-0011](../adr/0011-property-editing-containers.md)、[当前验收](system-v1/probes/README.md)。
- 配套：[薄切片执行计划](plans/2026-10-15-stage-zero-contract-slices.md)。

## 1. 目标、范围与批准层次

目标是证明一套可供独立组件和未来完整界面共同使用的编辑合同，主要服务流程实施顾问的高频配置。保持现有三包职责和BPMN模型事实源，不构建正式工作台、品牌皮肤、完整导航或业务存储。

2026-10-15用户已批准A/B薄切片实施及A4最小接缝；C/D/E仍按下述独立门槛推进。本规格中的名称是**候选接口名**，不表示当前已有导出，也不直接承诺npm发布。阶段零使用真实模型、session和第三方组件验证；允许建立最小外置面板实验宿主，不把它当成正式工作台。

| 批准层次                           | 可做的工作                                                         | 不自动包含                                        |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| 规格编写时                         | 整理规格、计划与自审                                               | 任何产品、探针或依赖代码变更                      |
| 书面规格与计划审阅通过后：A1–A3、B | 探针内身份、冲突、候选事务及严格类型验证                           | 新生产导出、正式工作台                            |
| A4最小生产接缝                     | 仅在审阅中明确批准A4后，按计划白名单抽离共享编辑内容与实际选择接缝 | 工作台外壳、公开控制器发布或重写FlowDesignSession |
| C、D、E后续组                      | 按各自补充方案复审后验证                                           | 仅凭本总览就施工完整主题桥接或确定资源阈值        |

若A4未获批准，做到A3后停下；不能用DOM点击或复制NodeDrawer源码把B02标记为解除。A组通过也不自动解除B01、B03、B04、B05。

## 2. 五组推进顺序

| 组/阻断 | 优先级及依赖                     | 交付物                                           | 通过门槛                                                                   |
| ------- | -------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| A / B02 | P0，先收敛；A1→A2→A3→A4→A5       | 本规格、候选实现、真实组件实验、合同与浏览器证据 | §10全部成立；公共发布名称与迁移另行审阅                                    |
| B / B05 | P0，与A并行排查；是A最终验收前提 | 13处EP类型错误根因、最小修订、严格检查记录       | 原严格入口及新候选入口零错误；真实Select/Option仍在，无any、关闭检查或替身 |
| C / B03 | P1，依赖A的编辑器捕获/保留接缝   | 全部支持字段及内部输入状态矩阵、异常证据         | 焦点/选项/拖拽中间态等逐项有结论；失败保留输入，不冒充保存                 |
| D / B01 | P1，可先调查；真实面板验收依赖A4 | 主题/弹层桥接补充方案、双实例矩阵                | 实例归属、浅深/密度/状态、主要弹层、键盘与对比度通过                       |
| E / B04 | P2，依赖C/D的候选策略            | 冷启动/GC/多轮测量与任务走查、预算提案           | 同夹具可复现；维护者审阅阈值及最小宽度；不由单次DOM/堆数推导               |

不设日历时间盒，以成果与复审推进。成本扩大、关键假设失败或必须扩展生产白名单时，记录证据、影响与选项，停止该项扩展；不自动降级双主题、两档密度、隔离或输入保真目标。

## 3. 职责与兼容

| 位置           | 负责                                                     | 不负责                                         |
| -------------- | -------------------------------------------------------- | ---------------------------------------------- |
| core           | 现有模型、编译、结构与引擎合同                           | 编辑生命期、Vue/DOM、主题和表单缓冲            |
| designer       | 流程属性读写规则、可复用字段内容、画布实际选择与滚动接缝 | FormCreate、文档持久化、宿主路由               |
| form-create    | 未来编辑控制层、表单编辑器接入、候选文档、冲突与版本协调 | 存储/部署服务，复制第二份可写BPMN事实源        |
| Playground探针 | 候选控制器与最小面板的真实集成、注入故障及取证           | 长期独占可复用装配逻辑                         |
| 宿主           | 文件/网络I/O、持久化确认、路由卸载接入                   | 伪造续期、把相同ID当同一对象、跳过收集宣布保存 |

独立DingtalkDesigner不传新选项仍使用抽屉、既有切换提交和commitPendingChanges合同；NodeDrawer普通确定不放宽。外置模式显式开启，跨对象/阶段切换不提交，应用使用`allowIncomplete: true`，仍拒绝非法非空格式、结构冲突及不支持配置。exportDeployXml合同不变。

旧文字诊断保持可用；结构化位置从实际诊断对象产生，不解析中文消息猜ID。本阶段只适配现有校验覆盖的节点、分支和流程默认表单配置，不新增BPMN对象选择能力或完整校验规则集。

## 4. 候选数据与小接口

### 4.1 身份与编辑器租约

```ts
// 说明性签名；令牌由所属控制器签发并登记，不能仅靠结构相等接受外来引用。
type EntityKind = "process" | "node" | "flow" | "form";
type EntityRef = Readonly<{
  controllerId: string;
  documentEpoch: number;
  kind: EntityKind;
  id: string;
  lifetime: number;
}>;
type EditTarget = Readonly<{
  ref: EntityRef;
  facet: "properties" | "default-form" | "form-content";
}>;
```

- `properties`仅接受支持的流程、审批/抄送节点、支路头连线；`default-form`只接受process；`form-content`只接受form。错误组合在查模型前拒绝。
- 定位引用由本控制器把现有诊断位置绑定成EditTarget；找不到可靠位置则不提供定位按钮。
- controllerId不代表安全凭证。归属还要在控制器私有登记中检查；引用不跨重载、控制器销毁或文档替换复用，不写XML或设计文档。
- 同ID重建签发新生命期。受控表单改名、内容副本更新及原位节点转换可延续身份，但字段相容性、基础版本必须另查，不能因续期就承诺输入可应用。
- 编辑器另持`EditorLease`不透明令牌。捕获、变更、销毁回调都核对租约；旧实例卸载回调不得注销新实例。失效租约只能保留冲突输入，不能写模型。

### 4.2 控制层能力

以下是契约表，不要求把每项都做成顶层公开方法。A1–A3先在`apps/playground/probes/stage-zero/contracts/`验证，A5再据结果决定哪些留内部。

| 候选操作                            | 输入与结果                                                  | 副作用合同                                                     |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `target(kind, id, facet)`           | 当前对象 → EditTarget或明确不可编辑错误                     | 只读；不通过ID恢复旧引用                                       |
| `stage(target, draft)`              | 类型匹配的原始DraftValue → DraftStatus                      | 仅改缓冲；保留首次基础版本及未规范化输入                       |
| `apply(target)` / `restore(target)` | 应用异步/还原同步 → OperationResult                         | 应用执行§6事务；还原回当前值，均非持久化保存；冲突态不得绕过§5 |
| `prepare(purpose)`                  | `draft-save`或`validate` → Promise<PreparedCandidate或失败> | 捕获所有编辑器，隔离候选；不写当前模型/session，不清缓冲       |
| `resolveConflict(id, action)`       | `discard-local`或`restart-on-current` → OperationResult     | 只处置冲突/编辑上下文，不强制写入业务模型                      |
| `locate(target, signal?)`           | → Promise<LocateResult>                                     | 仅导航、实际选择与焦点，不应用输入                             |

`DraftValue`采用判别联合：流程名称、审批属性、抄送属性、分支名称/条件、默认表单引用、表单rules/options。可编辑字段源自现有NodeDrawer与session；审批缓冲还要保留elementVariable、单↔多切换的lastSingleAssignee/lastCollection等会话输入，不因抽离内容丢失。分支default是网关共享字段，经受控命令处理，不作为互不知情的各分支局部布尔值提交。预览试填值不属于DraftValue。

`OperationResult`成功携带当前版本，失败携带类别、可读信息及可选EditTarget；类别固定为`stale-target`、`conflict`、`invalid-input`、`capture-failed`、`version-changed`、`unsupported`、`commit-failed`、`cancelled`。不得靠throw穿透UI；内部异常在接缝转换为失败结果，保留原错误供宿主记录。

### 4.3 类型与返回约定

以下用于锁定相邻薄切片的字段名称；租约、候选、冲突ID及版本令牌均为控制器签发的不透明值。

```ts
type FlowPropertyDraft =
  | { kind: "process"; name: string }
  | {
      kind: "approval";
      name: string;
      approvalKind: "single" | "all" | "any" | "sequential";
      assignee: string;
      formKey: string;
      elementVariable?: string;
      lastSingleAssignee?: string;
      lastCollection?: string;
    }
  | { kind: "cc"; name: string; recipients: string }
  | { kind: "branch"; name: string; condition: string };
type DraftValue =
  | FlowPropertyDraft
  | { kind: "default-form"; formKey: string | undefined }
  | { kind: "form-content"; rules: string; options: string };
type DraftStatus = "clean" | "dirty" | "invalid" | "conflicted" | "detached";
type EditFailureCode =
  | "stale-target"
  | "conflict"
  | "invalid-input"
  | "capture-failed"
  | "version-changed"
  | "unsupported"
  | "commit-failed"
  | "cancelled";
type EditResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: EditFailureCode; message: string; target?: EditTarget };
```

apply因隔离准备包含序列化而返回`Promise<OperationResult>`，restore和resolveConflict返回同步OperationResult；apply只有最后提交段同步，不能把整个流程写成同步方法。

approval的assignee在单签时为审批人，在多人时为集合变量，沿用既有NodeDrawer口径；elementVariable等未传时保留已有值，不能错误重置。`OperationResult = EditResult<{ revision: number }>`；stage返回`EditResult<DraftStatus>`；target返回`EditResult<EditTarget>`；prepare返回`Promise<EditResult<PreparedCandidate>>`。prepare还要包含目录名称等当前已应用信息，DraftValue并非完整候选文档的替代表示。

EditorAdapter签名为`flush(): void`和`capture(): DraftValue | null`：flush仅收集该编辑器焦点输入；capture可抛错，由控制层转换失败结果。FormDesigner适配器可将现有exportContent用于flush后再次capture，必须证明重复导出稳定；不能证明则在适配器内部缓存同次捕获结果，禁止二次导出得到不同候选。任何捕获策略都不得借此写session。

## 5. 缓冲与冲突状态机

| 状态       | 含义与允许行为                                                                      |
| ---------- | ----------------------------------------------------------------------------------- |
| clean      | 当前对象无待应用输入                                                                |
| dirty      | 有输入；是否可应用须prepare后判断，不等于业务完整                                   |
| invalid    | 格式/结构不合法；输入保留，可切换，不可写当前模型或保存旧值冒充成功                 |
| conflicted | 同生命期基础内容变化或字段不相容；保留原基础、原输入、当前值供比较                  |
| detached   | 未报告替换/删除、文档世代变化导致旧目标不再有效；只保留待处置输入，禁止重绑同名对象 |

### 5.1 区分受控删除与未知替换

受控删除先计算完整影响集（节点、头连线、后代、嵌套块、表单引用及相应缓冲），有未应用输入时由实验宿主明确确认。确认依据绑定影响集与版本；等待中版本变化必须重算/重新确认。失败或取消保留全部输入、对象身份与选中。成功提交后，在任何ID复用之前注销被删引用；存续头边不注销。

未知替换不能复用旧探针`reconcile`直接删缓冲的做法。先把旧输入与编辑器移入待处置区，再登记新生命期。已捕获值以快照保留；尚不能序列化的输入保留原挂载实例及租约，等待用户处置。不要求将非法内部输入写入设计文档。外部整个文档被直接替换也遵循此规则；受控打开/新建则在替换前完成未保存确认与竞态检查。

存在未解决conflicted/detached记录时，文档保存和“当前校验通过”被阻断，不允许忽略记录后保存新文档。该保留仅为当前编辑会话内存承诺，不承诺浏览器崩溃恢复或跨文档存储；宿主不能先卸载再要求恢复不可序列化输入。

### 5.2 首期两种明确处置

- `discard-local`：用户明确放弃该记录的输入，撤销其租约并清理待处置记录；对象仍存续时重新读当前值。不得影响其他对象的缓冲。
- `restart-on-current`：只在同一生命期对象仍存续且当前类型支持编辑时可用。以当前值启动新的编辑缓冲，旧输入保留为只读比较材料；用户手工选择/重新输入，再走普通应用。原冲突转为已明确处置，不把旧值自动复制到新基础。比较材料保留至显式关闭或受控离开确认。

对象已删除、同ID重建或文档已换代时不提供restart-on-current；用户只能明确放弃旧记录，随后独立打开新对象。无自动合并、无一键强制覆盖，也无静默“以最后一次为准”。冲突确认本身不改模型。

## 6. 候选状态、提交与外部变更

### 6.1 单写入入口与版本

外置模式下结构命令、表单目录/内容更新和文档替换全部经控制器。现有session仍负责设计文档及模型/表单集合；控制器负责编辑身份和事务协调。宿主不传对象延续名单，也不传任意`(model) => void`作为受信命令。

每次受控写入生成内部影响记录：创建、删除、延续、读写集合、前后版本。读写集合至少包含目标、相关fork的default/支路顺序、引用表单及其目录版本；定位引用不使用分支序号作为永久身份。

未知外部写入属于兼容防御范围，不承诺任意绕过接缝的并发写入可自动恢复。prepare、apply和locate前比较实际对象引用、受影响字段及完整可序列化状态；无法证明未变化就拒绝并保留输入。不可序列化时直接报告捕获失败。仅比较受控revision或最终ID集合不足以通过验收。

### 6.2 prepare

1. 固定文档世代和请求号，先让所属实例编辑器完成本次受控焦点收集，再记录捕获基础版本；不触碰其他实例的焦点。该次失焦产生的已归属输入纳入本次快照，不能要求用户再保存一次。
2. 捕获全部活跃编辑器与未挂载的已保存缓冲，每份保留原始值；规范化只用于候选。基础版本记录后，任何新的输入/对象/目录变化都会使本次候选过期，拒绝发布，允许重试。
3. 先获得不会修改当前DI、waypoints或对象引用的隔离模型副本，再运行现有操作、结构/表单守卫、编译与可恢复性检查。未知扩展按现有支持合同保留或拒绝，不静默删字段。
4. 全部成功后生成不可变PreparedCandidate，含所属控制器/世代、捕获版本、目标生命期清单、候选文档及诊断。读取或修改返回对象不能反向修改当前状态；令牌由控制器登记，不能接受宿主伪造候选。

`saveDesignDocument`目前调用compile，不能未经验证直接用于当前模型上的“无副作用收集”。候选路径优先以`model.toXML()`取得不生成DI的原树序列化，再用现有`parse`及相同引擎适配器建立副本；需同时证明toXML无当前状态副作用、异步期间版本受保护、已失效几何不被副本错误恢复。隔离快照接缝是A3的实验门槛；若现有公开能力做不到，记录失败，先审阅最小core接缝提案，不在此计划偷加clone/transaction公共API。

### 6.3 apply及失败原子性

应用只作用于指定对象及明确相关共享字段，不自动应用其他对象缓冲。先在副本准备并校验，再在无await、无宿主回调的同步提交段比较版本和所有读集。写入只允许已验证命令；在通知外界前全部完成。失败必须恢复原字段、原对象/数组引用、default、顺序、DI、编辑租约及版本，不允许部分成功事件。

A3用事务故障注入证明这一点。若无法在既有接缝实现完整回滚或证明提交段不可失败，应报告未通过并提出独立修订；不能用整体替换当前模型掩盖部分提交（这会改变其他目标生命期）。结构命令仍遵守PR #92身份及DI合同，不重复改结构语义。删除重接后的整图自动布局取舍继续有效。

保存是序列化PreparedCandidate交给宿主，不要求先把缓冲写当前模型；失败不清输入。校验同样读取候选，不借commit计算徽标。PreparedCandidate不作为可任意延后提交的通用事务API公开。

## 7. 编辑内容与实际定位接缝（A4）

此节已由用户在本轮明确批准A4实施；当前实现与验收记录见[报告](system-v1/probes/contract-acceptance.md)，不构成已发布API声明。

- `NodePropertyFields`只渲染既有字段、接收中立的FlowPropertyDraft并发出原始输入变化，不直接改模型、不决定保存或切换。`property-editing.ts`复用现有读取、草稿/严格校验及写入准备规则，NodeDrawer仍拥有自身会话和关闭语义。
- DingtalkDesigner新增显式`propertyEditing="external"`候选模式；默认`"drawer"`。external模式下对象点击只发`selection-request`，结构动作只发语义化`operation-request`交给受控入口，禁止先写模型再补事件。事件带model实例、渲染版本与目标ID，由控制器绑定完整引用；未经版本核对不能接受。
- actual selection采用受控`selectedId`；新增`focusElement(id, signal?): Promise<FocusResult>`只负责确认元素已渲染、实际activeId与请求一致、滚动/焦点落在所属实例。返回`focused`、`missing`或`cancelled`；它不自动commit，不切BPMN视图，也不能单独替代控制层生命期校验。
- 外置模式的`commitPendingChanges`返回false并显示“外置编辑请由控制器收集”，防止旧宿主误以为已收集全部输入。默认抽屉模式行为不变。
- `showDefaultForm`候选属性默认true，维持现有`formOptions`展示条件；外置实验显式false，由实验表单配置区提供唯一可编辑入口。不能靠CSS隐藏证明接口存在。
- 内核不依赖FormCreate；designer不导入form-create的EntityRef或控制器。独立流程消费者仅使用中立选择/编辑/命令类型。

语义请求使用`{ model, renderRevision, operation }`；selection-request使用`{ model, renderRevision, id }`。operation判别联合限定为：`insert-after { nodeId, kind: "approval" | "cc" }`、`remove-node { nodeId }`、`add-branch { forkId }`、`remove-branch { flowId }`、`remove-block { forkId }`、`set-default { forkId, flowId: string | null }`。控制器在接收时验证来源、当前模型及引用，再把flowId映射为当前顺序所需的索引；请求中的索引不是身份。后续移动/缩放不在此联合中。

FocusResult为`{ status: "focused"; selectedId: string } | { status: "missing" | "cancelled" }`。错误对象、视图销毁或signal取消均不得错误返回focused；意外异常由locate转换为failed。NodePropertyFields候选props为`draft: FlowPropertyDraft`及既有表单摘要，事件为`update:draft(next)`，不接收整个DraftValue或表单编辑器内部对象。

`locate`内部先验目标，按facet进入钉钉式流程或表单配置区，再等待真实组件就绪并验目标/请求号，最后核对实际选择ID与焦点。新请求、用户主动选择、文档更换、销毁或AbortSignal使旧请求cancelled；目标死亡返回stale-target。无法定位的诊断仍可显示文字。

`LocateResult`成功形态为`{ status: "located", target, selectedId }`，失败状态为`stale-target | conflict | cancelled | unsupported | failed`并含可读message。默认表单定位成功必须确认process生命期和实际控件，selectedId取processId，不能把旧示意页作为成功。切换目的地时不应用或丢弃原输入；有冲突时可以导航至冲突说明，但不返回located。

## 8. 校验与宿主持久化

- 校验章绑定controllerId、documentEpoch、候选内容版本、目标身份版本和规则版本；不是仅对当前模型的章。
- 只对已测试编辑域建立等价规则。将同一已校验候选原样应用、其余缓冲不变且目标生命期不变时可保持章；trim、补默认值、模式变化、未知扩展变化无法证明等价则失效。无变化的重复应用/还原不制造失效。
- 新输入、冲突及捕获失败不能保留“当前通过”。布局/导航版本与候选内容版本分开；DI只影响保存快照，不擅自把几何变化当成业务语义变化，无法分类时保守重验。
- 宿主收到`{ snapshotId, controllerId, documentEpoch, generation, json }`，持久化成功才确认该快照。保存中继续编辑则仍dirty；迟到成功不能标记其他文档或更新快照已保存。下载不默认充当宿主保存。
- 新建未修改基线不等于已有宿主记录，首次保存状态单独表达。离开保护由宿主接路由；外置模式与独立组件不新增全局快捷键抢占。

## 9. B、C、D、E的接口与测量边界

B先复现原13处错误并核对实际Vue/EP声明解析，产出最小根因和探针内修复方案。保持当前lockfile及真实ElSelect/ElOption，不用native select替换或宽泛类型断言掩盖。若必须变依赖或公共声明，停止并另行提案。

C使用input、textarea、inputNumber、radio、checkbox、select、datePicker、switch及现有栅格。每项记录焦点未失去输入、默认值、清空、选项编辑；不适用标注理由。覆盖拖拽未完成/取消、两份表单切换、序列化throw/null/非法结果。人工异常与自然第三方失败分列；不能制造安全自然复现时写未验证，不因此解除B03。保持挂载是保真基准；单例恢复只有等价证明后才可选。

D调查真实可达的属性选项/菜单、选择器、日期、预览对话框及嵌套弹层，列出宿主注册和CSS影响。主题根和弹层按实例归属，禁止通过全局root/body覆写宿主主题；不fork或引入Pro。补充桥接方案先审阅，验证清单覆盖浅/深×紧凑/舒适、同页双实例交换主题、卸载重挂、长中文、焦点/禁用/错误状态。正文对比度至少4.5:1，符合大字定义的文字至少3:1；必要非文本边界/焦点指示至少3:1，颜色之外保留状态表达。依据[WCAG 2.2文字对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)与[非文本对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)，测量computed前景/背景、保留精确值与适用例外；这不等同全部无障碍认证。

E使用相同锁定版本、浏览器、夹具和机器，分别新页面测2/10/20表单，保持挂载与单例恢复各做冷启动、20次往返及至少3轮；记录捕获/切换时延、JS堆、DOM、监听器、卸载GC后稳定值。诊断GC与自然运行分开，不设未经测量的绝对阈值。容器先测1440/1280/1024/900/768 CSS px，面板280/320/400px，两档密度及长中文/多分支任务；未通过窄宽度不自动删范围，由维护者审阅最小宽度及低于下限提示。预算与默认策略均为后续批准项。

## 10. 验收追踪与出口

| ID  | A组硬验收                                                                      | 对应切片 |
| --- | ------------------------------------------------------------------------------ | -------- |
| A01 | 两控制器同元组引用互拒；process/default-form的kind/facet错误组合拒绝；不写文档 | A1       |
| A02 | 同步删后同ID再建、支路/块级联、文档替换、迟到租约注销不串输入                  | A1/A2    |
| A03 | 改名副本可续期；未知替换先保留输入再失效；捕获失败保留原实例                   | A2       |
| A04 | 基础内容变化/形态不相容冲突；discard只清目标；restart不自动复制或写模型        | A2       |
| A05 | 删除影响集确认过期/取消/失败均零丢失；成功只清实际删除对象                     | A2       |
| A06 | 全量捕获第二份失败、prepare期间新输入/外部变更，均不写模型/session/DI          | A3       |
| A07 | 原子提交失败恢复字段、数组引用、身份、default/顺序/DI；无部分事件              | A3       |
| A08 | 兄弟分支default与表单引用读集变化拒绝过期提交；不靠最终ID差集                  | A3       |
| A09 | 外置字段与旧抽屉复用规则；草稿级应用不放宽旧确定/部署；切换不提交              | A4       |
| A10 | 按实际ID定位，同名节点、两个实例、延迟/主动选择/销毁/旧请求均正确              | A4       |
| A11 | 转换/首节点和嵌套块删除后fa可定位；条件/default、顺序及DI合同无回归            | A4/A5    |
| A12 | 默认表单真实入口唯一；BPMN只读不选择；不可定位保留文字                         | A4       |
| A13 | 原样等价应用保留章；非等价/无法证明变化失效；校验失败不丢输入                  | A5       |
| A14 | 保存等待继续编辑仍dirty；旧世代成功不污染新文档；失败不清缓冲                  | A5       |
| A15 | prepare隔离副本保留现有扩展和往返语义；未支持能力不静默降级                    | A3/A5    |

A组通过需要合同测试、真实组件测试和原生浏览器共同证据；B严格检查零错误是最终门槛。全套测试、构建、lint按当前实际数量记录，不预填未来通过数。原产品501、本复验548只是历史基线，不作为下一轮结果。

阶段零出口由B01–B05逐项判定“通过/需修订/无结论”。C、D、E未完成前，即使A/B全绿仍不批准完整页面稿定稿、正式工作台或公共API发布。无自动推送、开PR、合并、发包或对外消息。

## 11. 实施细化与证据入口

A/B实施中增加的内部接缝和防护均为前述合同的具体化，不新增工作台范围：

- 还原后立即保留当前clean基线；明确放弃同生命期冲突后重建字段与租约，失效对象不能自动重绑。
- flush前后核对模型/生命期/租约，捕获stage后再查冲突；同步输入可收集，失焦产生的宿主模型变更不能被吸收为新基础。
- `openEditor`在字段显示前保存clean基础，不能到首次输入才采当前模型作为旧基础；受控操作只续clean、无未捕获输入的基线。
- `modelRevision`使同一模型引用的投影更新可控；实际选择/焦点确认不依赖名称或DOM模拟点击。
- 所有组件事件及捕获前后核对EditorLease；比较材料的旧实例不能向新编辑会话写入。新增/更换租约会使未经证明的校验覆盖待复核。
- 已解析的待绑定表单依赖其生命期；未知同ID替换产生冲突，不能自动绑定新对象。未解析文本仍保持既有引用修复行为，不伪造过去的生命期。
- 删除检查包括未应用绑定，确认展示完整影响集；不能为删除而隐式应用其他对象输入。
- 候选后发覆盖先发；签发凭据由私有登记验证，校验/保存最终消费前再查版本。捕获失败使输入待确认，旧失败不能覆盖新通过。
- 字段flush/capture与未序列化通知是最小适配能力；输入法检查仅组件层证据，第三方全状态仍待C组。默认控件固定过程引用，未知替换不猜同名目标。
- dispose须在宿主明确离开后调用，失效全部引用和请求；并未实现真实宿主路由或业务存储。

完整追踪见[验收报告](system-v1/probes/contract-acceptance.md)及其原始证据。准确公共名称与迁移仍在发布前审阅，C/D/E未通过前不进入正式工作台。

2026-10-15验收更新：A/B候选合同通过，B02/B05阶段零阻断解除；三个独立复核Important已补修并由执行方完成638项回归、构建、lint、严格类型及浏览器补验。详见验收报告；B01/B03/B04仍阻断，C/D/E未实施，公共名称与迁移未冻结。

2026-10-15四项P2补修更新：见[补修验收](system-v1/probes/p2-followup-2026-10-15.md)。B02在本地20秒全量验证条件下恢复候选功能合同通过；B05锁定入口通过。独立初审补充的一项问题已用两条正式回归闭环，最终657项通过；默认命令两项5秒超时仍保留，不宣称默认CI通过。C/D/E与正式工作台未实施。
