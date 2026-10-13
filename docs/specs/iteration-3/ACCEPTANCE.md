# 迭代三 · 验收清单

状态：已完成（2026-10-13 收官，发布提交与读回证据见文末收官执行记录）。

范围及协议以 [规格总纲](./README.md) 为准。A01–A20 可执行验收项的执行载体为 #74–#77 各票功能测试用例文档（74/75/76/77-functional-test-cases.md）、组件测试与真实浏览器证据；失败及修复说明保留于收官执行记录，未删除未改写。

## 主场景

在现有 Playground 新建一份“申请与复核”流程设计文档：

- 申请单包含文本、多行文本、数字、单选、多选、下拉单选、日期单值、开关，配置默认值、必填和基础行列布局。
- 申请单作为流程默认表单；至少一个单签节点继承它。
- 复核单具有独立字段；至少一个多人审批节点显式覆盖为复核单。
- 保留既有条件分支、并行分支及抄送能力的回归覆盖；继承规则对三种多人形态一致。

## 可执行验收项

| 编号 | 操作                                                                                                                             | 必须观察到的结果                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A01  | 新建设计、不绑定任何表单                                                                                                         | 可编辑并保存；流程配置完整后仍可部署导出                                                                                        |
| A02  | 创建两张表单，配置默认与节点覆盖                                                                                                 | 节点显示正确表单及继承/覆盖来源                                                                                                 |
| A03  | 改默认表单，再清除某节点覆盖                                                                                                     | 继承节点随默认变化；显式覆盖不变；清除后恢复继承                                                                                |
| A04  | 单签切换会签、或签、依次审批并恢复                                                                                               | 节点 ID 与表单覆盖不丢失                                                                                                        |
| A05  | 表单改名；再创建同名、不同 ID 的表单                                                                                             | 原引用继续指向原 ID；选择界面能区分两项                                                                                         |
| A06  | 删除被默认或节点引用的表单                                                                                                       | 拒绝并说明引用位置；解除引用后可删除                                                                                            |
| A07  | 审批人、条件未配齐时保存，刷新再打开                                                                                             | 编辑进度恢复，缺失配置保留，部署导出仍受阻                                                                                      |
| A08  | 保存含未绑定表单的文档                                                                                                           | 重新打开后该表单仍在，未因未引用被丢弃                                                                                          |
| A09  | 试填、触发必填错误、修正后查看值                                                                                                 | 校验有效；设计默认值及其他表单不被试填污染                                                                                      |
| A10  | 保存与打开完整文档；重复保存打开                                                                                                 | 字段 ID、类型、选项、默认值、必填、布局及表单级配置语义等价                                                                     |
| A11  | 导入存在失效表单 key 的可恢复文档                                                                                                | 以草稿打开，保留 key 并定位错误；相关预览及部署导出受阻，不回退默认                                                             |
| A12  | 打开坏 JSON、坏 XML、重复 ID、未知版本/引擎/提供者，或 XML 实际使用了与目标适配器冲突或不支持的引擎扩展                          | 拒绝打开，当前模型、表单及未保存内容不被部分替换                                                                                |
| A13  | 打开多流程或超出编辑子集/表单范围的文档                                                                                          | 明确拒绝，不静默选取或删除不认识的内容                                                                                          |
| A14  | 文件读取或本地存储失败；连续打开两个文件                                                                                         | 错误可见，不误报保存成功；旧请求不覆盖较新打开结果                                                                              |
| A15  | 文档下载、从文件打开、刷新恢复本地草稿                                                                                           | 两条存储途径都复用公开文档接口，恢复结果一致                                                                                    |
| A16  | 当前配置从有效变为无效后再次部署导出                                                                                             | 显示当前错误，不把旧有效 XML 当作最新结果                                                                                       |
| A17  | 使用原有 designer 入口且不安装表单包                                                                                             | 纯流程接入及手写 formKey 的既有行为保持有效                                                                                     |
| A18  | 流程默认 key 失效但无任何节点继承它，配齐其余配置后部署导出                                                                      | 仍因默认引用失效被阻断；先修复默认 key 才能导出，不因无人继承而放行                                                             |
| A19  | 含条件/并行分支及抄送的流程设置了流程默认表单                                                                                    | 网关与抄送节点不参与有效表单解析、不显示有效表单；审批节点正常继承                                                              |
| A20  | 使用 `flowableAdapter` 创建未配置审批人的标准流程，保存后重新打开；另验证扩展前缀更名但 URI 不变、仅声明未使用的其他引擎命名空间 | 标准草稿可以恢复，不因缺少 Flowable 扩展被拒绝；相同 URI 的有效扩展仍可识别，未使用的声明不构成冲突；缺失业务配置仍阻止部署导出 |

## 自动化与包消费

- [x] 编译合同：旧基准保持，新增默认与覆盖的 XML 基准。（core 测试套件，版本 PR #90 CI 全过，run 38343842665）
- [x] 往返保真：绑定与文档内表单定义都恢复，重复往返结果稳定。（core 125 项含往返用例；CI 同上）
- [x] 适配器合同：既有三项合同继续通过，公共绑定描述符的创建/解析注册一致。（core 适配器合同测试；CI 同上）
- [x] 单元与组件验证覆盖 A01–A20 中可自动化部分；实际 FormCreate 设计器和渲染器参与主链验证。（designer 127、form-create 121 项，真实设计器/渲染器主链；本地多环境 form-create 超时失败保留见收官记录）
- [x] `pnpm lint`、`pnpm test`、`pnpm build` 及既有 CI 矩阵通过。（版本 PR #90 Node 22/24 双矩阵各 428 全过；#78 发布日本地复跑 core/designer/form-create 全过、form-create 首轮 2 项 flaky 复跑排除，见 evidence/78-release/local-verification.txt）
- [x] 三包实际 tarball 在仓库外临时项目安装成功，无 workspace 源码路径或隐式依赖。（evidence/77-version-prep/dependency-tree-final.txt；发布后官方源 @latest 复验 evidence/78-release/install-check.txt）
- [x] 外部项目的 JS、TS 类型、CSS 可用，浏览器能展示表单并完成一次保存恢复。（evidence/77-version-prep/types-final.txt、consumer-final-browser.json、consumer-final.jpg；发布产物与该轮产物 SHA256 逐字节一致）

## 引擎验证

- [x] 现有 Flowable 6.8 基准冒烟继续通过。（evidence/77-version-prep/smoke-flowable68.txt 退出 0）
- [x] 含 `flowduet:defaultFormKey` 与 `flowable:formKey` 的新基准 XML 真实部署成功。（evidence/77-version-prep/artifacts-flowable68.json，HTTP 201）
- [x] Playground 配置完整后导出的 XML 真实部署成功，记录实际流程定义标识与导出物。（同上两份当前导出部署成功并启动实例；导出物 playground-export.xml、设计文档 playground-design.flowduet.json）
- [x] 结果只证明本轮承诺；不将部署成功表述为运行时表单、业务数据或完整审批已接通。（口径见收官执行记录边界节）

## 发布与留档

- [x] 三个公开包按 Changesets 版本 PR 流程发布，版本及 dist-tag 从官方 registry 读回。（版本 PR #90 合入 085802a 后 `changeset publish`；读回 core 0.3.0 / designer 0.1.0 / form-create 0.1.0，latest 与批准清单一致，evidence/78-release/npm-readback.json）
- [x] Git tag 使用 Changesets 自动生成的 `<包名>@<版本>`，远端可读回。（三 tag 均指向 085802a，evidence/78-release/git-tags-readback.txt）
- [x] 接入文档说明安装、样式、默认继承、文档存储、草稿与部署导出的差别、支持组件及宿主责任。（#72 三包 README 接入说明 + #77 补 BpmnCanvas 宿主显式引入 VueFlow 基础样式说明）
- [x] 本清单附实际执行记录、验收提交与主场景设计文档；保留失败及修复说明。（主场景设计文档 evidence/77-version-prep/playground-design.flowduet.json；失败保留见收官执行记录）

全部必选项有实际证据后方可标记迭代完成。布局美化和额外示例不影响上述出口；任何核心范围调整需先修订规格。

## 收官执行记录（2026-10-13）

### 票与提交链

迭代三功能票 #71–#77 依次经 PR #79（#71）、#81（#72，含修复）、#83（#73）、#84（#74）、#87（#75）、#88（#76）、#89（#77 验收）合入 develop；版本 PR #90（squash 合入 085802a）树与已验收 HEAD 73ecb78 完全一致，Node 22/24 CI 每矩阵 428 全过。发布在 085802a 上以 `changeset publish` 执行，三 tag 指向该提交。

### 发布结果

| 包                    | 版本 | npm latest 读回 | 远端 tag                      | 产物核对                       |
| --------------------- | ---- | --------------- | ----------------------------- | ------------------------------ |
| @flowduet/core        | 0.3.0 | 0.3.0          | @flowduet/core@0.3.0         | SHA256/SHA1 与 #77 基准逐字节一致 |
| @flowduet/designer    | 0.1.0 | 0.1.0          | @flowduet/designer@0.1.0     | 同上                           |
| @flowduet/form-create | 0.1.0 | 0.1.0          | @flowduet/form-create@0.1.0  | 同上（远端 tarball 下载复核）  |

明细：[78-release/published-tarballs.json](./evidence/78-release/published-tarballs.json)、[npm-readback.json](./evidence/78-release/npm-readback.json)、[git-tags-readback.txt](./evidence/78-release/git-tags-readback.txt)、[publish-record.md](./evidence/78-release/publish-record.md)。

异常与恢复：form-create packument 曾现官方域名 CDN 404 负缓存（tarball 始终 200、SHA256 一致、yarn registry 正常），约 5 分钟后自然恢复，未重复发布、未手工干预，甄别与恢复记录见 publish-record.md。

### 失败与修复保留（未删除未改写）

- form-create components.test.ts 真实设计器用例在 #77 阶段多环境本地超时失败（[test-blockers.json](./evidence/77-version-prep/test-blockers.json)），未证实根因；版本 PR 远端 CI 双矩阵全过后放行，#78 发布日本地复跑首轮 2 项 flaky、复跑全过——超时倾向机器资源问题，不宣称已根治。
- 三包 VueSFC 声明纯 NodeNext 首次解析失败（[types-nodenext-first.txt](./evidence/77-version-prep/types-nodenext-first.txt)）保留；最终以 Bundler 模式验证，未加 shim、未开 skipLibCheck 掩盖。
- 真实浏览器消费存在一条重复插件应用 warning（[consumer-final-logs.json](./evidence/77-version-prep/consumer-final-logs.json)），不声称零警告。

### 后续范围边界（本轮不承诺）

运行时审批接通、多框架适配（非 Vue 宿主）、权限模型、部署成功不等于引擎原生渲染运行时表单/业务数据/完整审批已接通——以上均属后续迭代范围，本轮证据不覆盖、不表述为已实现。
