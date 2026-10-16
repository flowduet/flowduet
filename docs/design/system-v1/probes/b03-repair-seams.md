# B03 P0：默认值编辑与 Dialog 公开接缝验证

执行日期：2026-10-16。范围为[薄切片计划 Task 1 / P0](../../plans/2026-10-16-b03-minimal-production-fixes.md#task-1p0证明默认值编辑接缝与身份不写生产实现)，合同依据为[修订提案](../../2026-10-16-b03-minimal-production-fixes-proposal.md)。本轮不实施 P1，不变更产品代码、公开导出、依赖或 lockfile，不推进 D/E、不推送。

## 基线与复现入口

开工 fetch 确认 `origin/develop=10b2a13`；C 组尚未合入。维护者通过问题卡明确授权从含 C 依赖的 `aaf7da6` 切出 `refactor/b03-default-editor-seams`。因此证据适用于本分支含 C 的探针环境，不能称 develop 单独已经包含这些入口。`packages/` 与 develop 之间无差异。

[证据目录](evidence/b03-p0-2026-10-16/README.md)保存最终重放、早期失败/操作错误、原始 CLI 日志、执行脚本、命令日志和校验和。浏览器使用独立会话，1440×1000，DPR1；实际浏览器版本见 `final/environment.json`。

样稿通过 `packages/form-create` 已声明依赖的公开包入口使用锁定 FormCreate，不新增 Playground 依赖。`FcDesigner.component()` 注册的组件不保存跨挂载输入；owner 与 source token 由每实例 `componentRule` 的 props/回调闭包传入。`fieldReadonly=false` 仅为同文档删除/复用实验，不改产品开放范围。

## 观察与合同含义

| 接缝           | 已观察事实                                                                                                                                                                        | P1 可消费的边界                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 自有默认值编辑 | 真实 FormCreate 载入无状态文本样稿，能读取 `-` / `2026-`，blur 不归一原文；样本数值 37 及日历确认经公开 v-model 写入原规则                                                        | 可接入自有输入；这不是解析器、raw 缓存或 retained 保真实现，切字段卸载样稿仍会丢未提交 DOM 原文                            |
| 字段引用       | 同一字段切出/返回、排序保持 source token；同 ID 双实例 token 不同；getRule 副本不同于 sourceRef                                                                                   | 可用公开回调 sourceRef 作为实例内不透明 token，不能从复制树或仅 field 字符串建立身份                                       |
| 删除时点       | 顶层/列内删除事件关联旧 sourceRef；新建并将字段 ID 改为原值使用新 sourceRef；删父栅格可从事件的公开 children 递归关联八个旧字段 token                                             | 必须在删除事件时点失效；事件内 getRule 仍可能含旧字段，不能等待最终集合差集。change-field 载荷不当作 sourceRef             |
| 同步回显/捕获  | v-model 发射后的同步段 prop 仍旧，nextTick 后 prop 与公开规则均为新值；既有 C wrapper 在焦点未完成数字/日期时同步拒绝候选且 live/persist 零写入                                   | P1 必须显式记录 pending-update 并在同步出口拒绝；UI 可一次 nextTick 后重读。C wrapper 的通过不等于新 captureContent 已实现 |
| 日期/日历      | I01 省略/date/datetime/week/month/year 六形态在两布局无编辑往返保持；普通 date 和 YYYY/MM/DD 格式日历确认与手工文本分离                                                           | 只证明所测格式，不能推广到任意 valueFormat；P1 对未证明编辑明确 unsupported，不改全局 schema                               |
| 未接管控件     | ValueInput 数值选项实际上用 text 输入，`-` 时 badInput=false，公开规则仍旧；本实例原生 input 能观察其 raw/DOM token，原生确认 37 后公开规则为 number37                            | 不能只靠 validity.badInput。P1 需将未确认输入视为 pending，保留原入口确认路径；本轮未实现通用控件状态协调                  |
| 忙碌/弹层归属  | 原生 dragstart/dragend 有实例归属，公开 @drag 在落入提交时才出现；公开 popperClass 可区分两个自有日历弹层；组合开始/结束/nextTick 的先后可由协议事件观察                          | @drag 不能充当可靠 start；丢失结束保持 uncertain。组合协议不等于 OS 输入法验收；非自有弹层归属不明须保守阻断               |
| Dialog         | 公开 header slot、show-close、modal-class、class、before-close 与原生捕获监听可让关闭手势先于 blur 检查；拒绝手势的后续 click 不放行；禁自动 Escape 后普通/弹层 Escape 不关闭表单 | 自有标记只路由本实例关闭控件/遮罩，无第三方私有 DOM 类。busy 是样稿协议开关，不能说真实 FormManager 已受保护               |
| 销毁对照       | 默认 Escape/X/遮罩进入关闭；程序化 v-model=false 和父级卸载不调用 before-close                                                                                                    | P1 必须统一内部关闭授权并由宿主先处理外部销毁。样稿没有放弃确认、旧实例 key 或租约实现，不替代 M01–M08                     |

Dialog 键盘用例区分“已在关闭按钮上按 Enter”与“输入焦点通过指针点击关闭”：前者证明激活路由被拒绝，后者才证明 pointerdown 早于 blur，不能将前者说成 Tab 焦点转移也被拦截。IME busy/迟到 click 是明确标注的协议状态与真实指针/键盘组合，非自然 OS 故障。

## 结果分类与门裁定

最终裁定及数量以本轮完成时的 `coverage.json` / `verification.json` 为准。生产 legacy RED、C wrapper、防误关样稿、协议与未验证项分别统计，不合成为一个 retained 通过率。

**P0 的公开能力门通过，可作为进入 P1 的技术依据；本轮执行停在 P0，不自动进入 P1。** 这里的“通过”只指上述已测公开接缝有可复现的实现路径，不是 retained 产品合同、M01–M08 或 B03 整体验收通过。

最终目录 102 条：88 通过、12 生产 legacy 负例、2 工具未验证。88 条包括 C wrapper 的 12 条安全拒绝，以及样稿 UI、协议/真实动作组合和公开销毁对照；来源分类见 coverage，不称 88 项原生 retained 验收。排序补充断言核对公开字段顺序确实变化后 source token 仍相同，不以拖影或 no-op 算通过。

本轮开工原样默认全量失败一次：App.integration.test.ts:68“插入抄送草稿后自动与手动导出均报错，配置收件人后自动恢复 XML”在默认 5 秒超时。关闭本轮浏览器和服务后的末次原样默认全量为 **750/750**（core148、designer184、form-create137、Playground281）；两次日志均保留，不推断失败由并行负载造成，也不称 APP-T 根因修复。新增 2 条是观察器引用区分测试，不是 2 条 retained 功能验收。

本轮候选入口 **104/104**，`pnpm build`、`pnpm lint`、严格 probe `vue-tsc` 均退出 0，保留构建体积等既有告警。一次 [fresh-context 独立复核](evidence/b03-p0-2026-10-16/independent-review.md)未发现新增 P1/P2 问题；复核员亲跑映射/哈希，浏览器和命令结果仅核读，未冒称独立重跑。

P1 仍需按计划先 RED：真正的原文缓存/字段生命期、同步捕获、未接管控件协调、FormManager 唯一实例 key/状态转发、明确放弃确认及异步复验；其真实组件回归、M01–M08 和 legacy 兼容均不能由本样稿替代。P3 原位取消未执行，不以“识别拖动”宣称“能取消”。

OS 输入法、native pointercancel 和 ERR05 自然失败仍没有新证据。APP-T 默认超时保留历史，不将一次通过视为根因已解决。B03 保持阻断，工作台、D/E、发布或推送均未获本轮授权。
