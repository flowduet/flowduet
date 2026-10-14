# 复审：设计体系 v1 与阶段式设计工作台提案

审阅对象：[提案](file:///Users/l/Documents/projects/flowduet/docs/design/2026-10-14-design-system-workbench-proposal.md)、[讨论记录](file:///Users/l/Documents/projects/flowduet/docs/design/experience-redesign-discussion.md)、[ADR-0010](file:///Users/l/Documents/projects/flowduet/docs/adr/0010-integrated-designer-delivery.md)、`CONTEXT.md` 新增词条（提交 `50d977d`）。对照了 ADR-0001~0009、ROADMAP 和三包现有源码。

## 结论

方向和边界写得很扎实：事实源不变、草稿与导出两套合同、诊断不解析中文文案、主题作用域不碰 `:root`、讨论原型不当作规范，这些都对，也延续了已有 ADR。

**但现在还不能进入阶段一计划。** 有 3 个阻断问题：一是与已接受的 ADR 有冲突却没有标注；二是主路径上缺一项功能，交付后的流程实际无法使用；三是三个阶段的顺序把最大的技术风险放到了最后才验证。另外缺少迭代框架，包括时间盒、砍序和发布计划。

---

## P0 阻断

### 1. 固定属性面板与 ADR-0003 / CONTEXT.md 冲突，且新的提交语义没有定义

- [ADR-0003](file:///Users/l/Documents/projects/flowduet/docs/adr/0003-dual-view-architecture.md) 第 1 条规定：钉钉式视图用“纵向递归组件 + 右侧抽屉属性面板”。[CONTEXT.md](file:///Users/l/Documents/projects/flowduet/CONTEXT.md#L27-L29) 里“钉钉式视图”的定义也写着“抽屉里配置”。提案改成固定面板，但没有按 `docs/agents/domain.md` 的要求标注这处 ADR 冲突。
- 这不只是换个容器。[`NodeDrawer`](file:///Users/l/Documents/projects/flowduet/packages/designer/src/components/NodeDrawer.vue#L319-L432) 现在用的是 `ElDrawer` 加“取消/确定”的**显式提交**语义，[`commitPendingChanges`](file:///Users/l/Documents/projects/flowduet/packages/designer/src/components/DingtalkDesigner.vue#L274-L278) 也是围绕这个语义设计的。改成固定面板后，下面几个问题提案都没有回答：
  - 节点 A 的输入还不合法时点了节点 B，是自动提交、阻止切换，还是按对象分别保留缓冲？
  - 是否保留“确定/取消”？如果改成失焦即写入，“未完成输入”的边界就变了。
  - §3.1 只讲了**跨阶段**怎么保留，没讲**同一阶段内切换选中对象**怎么处理。后者才是最高频的操作。
- 独立组件也有兼容问题：`DingtalkDesigner` 单独使用时还保留抽屉吗？`designer@0.1.0` 已经发布，§5 承诺“现有组件保持合同”，这一条和固定面板直接冲突。
- BPMN 视图有缺口：[`BpmnCanvas`](file:///Users/l/Documents/projects/flowduet/packages/designer/src/components/BpmnCanvas.vue) 现在没有任何选择事件。流程阶段切到 BPMN 视图时，固定面板显示什么？校验定位到节点时，是强制切回钉钉式视图，还是在 BPMN 视图里高亮？两种做法都是新能力。

**建议**：新增一份 ADR 补充或取代 ADR-0003 第 1 条，同步修改 CONTEXT 词条。提案里要写明面板的提交语义、选中切换规则、独立组件的兼容策略（比如抽屉和外置面板两种形态并存），以及 BPMN 视图下面板和定位的行为。

### 2. 主路径缺流程标识与名称编辑，导致“从零到交付”无法使用

- [`newDesign`](file:///Users/l/Documents/projects/flowduet/packages/form-create/src/session.ts#L69-L83) 默认使用 `flow_1` / `未命名流程`；Playground 的 [`onNewDesign`](file:///Users/l/Documents/projects/flowduet/apps/playground/src/App.vue#L391-L404) 不传任何参数；core 里也没有修改流程 id 和名称的 API。
- Flowable 按 process key 管理版本。两份从零做出来的设计部署到同一个引擎时，后一份会变成前一份的**新版本**。这正好打在提案排在最高优先级的路径上。
- 提案 §2 第 32 行又规定“基本信息优先呈现现有标识、名称，新增元数据编辑需另行确认”。结果就是“基本信息”这一整个阶段只能显示只读内容和新建/打开按钮，几乎是空的。

**建议**：在本提案里直接决定，二选一：
- (a) 把流程 id 和名称编辑纳入首期，包括 NCName 合法性校验、改 id 时对 DI 和引用的影响、属于核心逻辑变更需要先定合同；
- (b) 取消“基本信息”阶段，把身份信息和文档状态并入顶栏，工作台改为三阶段。

### 3. 阶段顺序：先出完整页面稿，再验证第三方能不能做到

提案把最不确定的部分放在阶段二，但这些风险在代码里已经能看到：

| 风险 | 证据 |
| --- | --- |
| FormCreate 设计器的样式是**全局导入**，不受实例作用域控制 | [form-create/src/index.ts](file:///Users/l/Documents/projects/flowduet/packages/form-create/src/index.ts) 顶部 `import "@form-create/designer/src/style/index.css"` |
| 组件会改宿主的全局注册 | [`ensureFormCreateInstalled`](file:///Users/l/Documents/projects/flowduet/packages/form-create/src/form-create-setup.ts#L15-L23) 执行 `app.use(ElementPlus)` |
| 弹层默认传送到 `body`，脱离实例作用域的 CSS 变量 | `ElDrawer`，以及 `BlockNodeList` 的类型菜单（测试注释写明“teleport 到 body”） |
| Element Plus 官方暗色变量挂在 `html.dark` 上 | 提案又禁止修改 `html`，只能在自己的作用域里重建一整套暗色变量 |
| 自有组件里有 103 处硬编码颜色 | 在 `packages/*/src`、`apps/playground/src` 的 `.vue` 文件中统计 |

FormCreate 设计器内部的下拉框、对话框我们无法控制挂载点，“弹层跟随实例主题”和“同页双实例不同主题”对这部分**很可能做不到**，除非 fork（提案已排除 fork）。如果阶段二才发现，阶段一的深色页面稿和定制边界都要返工。

**建议**：在阶段一之前或与阶段一并行，做一次**限时技术探针（1~3 天）**，只回答几个是/否问题：FormCreate 设计器深色主题、弹层的作用域归属、双实例隔离、跨阶段保持挂载的代价。同时**事先约定降级口径**，比如深色主题下表单设计器区域可以保持浅色，双实例隔离只承诺自有组件和 Element Plus。

---

## P1 重要

### 4. 缺少迭代框架

这是到目前为止范围最大的一轮：全面重设计、双主题、宿主定制、工作台、结构化诊断全在里面。但以往迭代都有的时间盒、砍序、出口标准和发布计划，这份提案都没有。ROADMAP 也没更新，[迭代三](file:///Users/l/Documents/projects/flowduet/docs/ROADMAP.md#L57-L59)的状态还写着“实施尚未开始”，实际已经发布收官。

另外需要说明这一轮和 v1 路线的关系。v1 还有更多 BPMN 元素、Flowable 7.2/8.0 冒烟、多框架渲染、文档站等事项，ROADMAP 风险第 2 条明确写着“v1 纪律是生死线”。

**建议**：补上时间盒和砍序，砍序示例：双实例不同主题 → 宿主定制 → 舒适密度 → 深色主题。在 ROADMAP 里登记这一轮，并说明 v1 延期多少。

### 5. 工作台的核心状态逻辑现在在 Playground 里，迁移归属没有决定

[App.vue](file:///Users/l/Documents/projects/flowduet/apps/playground/src/App.vue#L129-L288) 共 872 行，里面有：`editGeneration`/`savedGeneration` 判定是否有未保存修改，`saveRevision`/`documentRevision` 处理竞态，`captureReplacementGuard`、`confirmDiscard`、`collectPendingEdits`，以及 `window` 级别的 Cmd+S 监听。[`FlowDesignSession`](file:///Users/l/Documents/projects/flowduet/packages/form-create/src/session.ts#L37-L48) 是刻意做成框架中立的，不包含这些状态。

提案只写了“复用 FlowDesignSession”，没写这些状态机迁到哪里：扩展 session，还是新建工作台 composable 或组件。这是阶段三最大的迁移项，也属于核心逻辑变更。

**建议**：在提案层确定归属。迁移前先用合同测试锁住 #76/#88 的现有行为。Cmd+S 要改成只在实例获得焦点时生效，否则双实例或宿主自己的快捷键会冲突。

### 6. 阶段二验证清单只列了视觉项

漏掉的非视觉高风险项：
- FormCreate 设计器在跨阶段 `KeepAlive`/`v-show` 下的内存占用和状态保持；
- 校验“覆盖未收集的编辑状态”。这实际上需要一种**不产生副作用的试提交**，而现在的 `commit` 会直接写模型；
- 钉钉式视图和 Vue Flow 中定位并滚动到目标对象；
- 最小容器宽度。FormCreate 设计器的三栏布局本身就占很宽。

### 7. 宿主集成协议只定义了保存

还缺这些：从宿主存储加载（不是从文件打开）、新建时的默认值、未保存状态变化事件、离开页面拦截、错误通道。

此外 §2 说“工作台包含文件与保存入口”，§5 又说“示例存储和文件 I/O 由 Playground 提供”，两处矛盾。需要明确：下载/上传是工作台内置，还是通过宿主插槽提供？

### 8. 嵌入场景下的品牌与标志

宿主嵌入完整工作台时，是否显示 FlowDuet 标志？能否隐藏或替换？宿主覆盖主色之后，“双色品牌”在嵌入场景中实际上就没有了。

**建议**：明确“双色品牌是默认主题，不是嵌入时的强制项”，并提供隐藏标志的配置。

### 9. 阶段徽标与校验口径矛盾

§3 要求阶段徽标“依据真实配置与校验结果”显示，§3.2 又要求校验必须覆盖还没收集的缓冲。如果徽标持续计算，要么用的是旧模型（违反 §3.2），要么要频繁试提交。

**建议**：徽标基于已提交的模型计算，文案不说“通过”；“全部通过”只在用户显式执行校验之后出现。

---

## P2 改进

10. **验收标准无法度量**：对比度没有指定标准，建议采用 WCAG 2.1 AA（正文 4.5:1，大字和 UI 组件 3:1）。“键盘可达”要限定在自有组件，FormCreate 的拖拽和 Vue Flow 画布本身不支持键盘操作。
11. **测试工具**：现有测试都跑在 happy-dom 上，不能证明真实浏览器行为、四种主题密度组合、弹层归属。需要引入 Playwright 之类的浏览器测试或视觉回归，这是新依赖，应列为待确认项。
12. **阶段三要切片**，每片都能独立合入并发布。建议顺序：主题 token 化（先等价替换硬编码颜色，不改观感）→ 抽离属性面板 → 工作台外壳并迁移 Playground 逻辑 → 结构化诊断与定位 → 深色主题与宿主定制。抽屉改面板对 `designer` 是行为变更，按 0.x 惯例发 minor，并在 changeset 里写迁移说明。
13. **依赖声明不一致**：`designer` 把 `element-plus` 放在 `dependencies` 里，构建时却 external 掉；`form-create` 声明为 peer。两边版本下限也不同（`^2.14.6` 和 `^2.11.1`）。主题适配要依赖 Element Plus 的 CSS 变量名，版本下限需要统一，并都改成 peer。
14. **用户验证**：目标人群是假设出来的，迭代三自己也写了“没有明确真实业务试用项目”。建议阶段一的页面稿至少找 1~2 位实施顾问做任务走查。
15. **为后续能力留位置**：BPMN 编辑和更多节点类型都在 v1 路线里。页面稿要检查布局和面板能否容纳这些能力，避免下一轮再重设计一次。
16. **文档细节**：
    - 原型分支 `73ee745` 只在本地、没有推送，提案里的引用别人无法追溯；
    - 第 6 行“通过 HTTPS 获取 Git 对象”是过程细节，可以删掉；
    - 新术语“设计身份 / 编辑缓冲 / 编辑会话 / 阶段”没有收进 CONTEXT，“编辑会话”容易和 `FlowDesignSession` 混淆；
    - 没有声明 i18n 本轮不做；
    - 阶段一产物的形式（Figma、HTML 还是 Markdown token 表）以及“版本化设计基线”存放在哪里，都没有定义。

---

## 需要你决策的事项（按优先级）

1. 流程 id 和名称编辑：纳入首期，还是取消“基本信息”阶段（P0-2）。
2. 固定面板的提交语义，以及独立组件是否保留抽屉形态（P0-1）。
3. 是否在阶段一之前插入限时技术探针，并事先认可降级口径（P0-3）。
4. 这一轮的时间盒和砍序（P1-4）。
