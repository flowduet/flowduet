# 前置结构修复验收记录

日期：2026-10-14。基线：`a72dc9de01d235ad3876f118044bd3dfb730416d`（开工时 fetch 的最新 origin/develop）。分支：`refactor/branch-identity-preservation`。本地 Node `24.16.0`、pnpm `10.26.1`。

后续状态：本文件保留首轮验收口径。全面复审另发现的 P1、P2 及此前延后的 P3 已完成补修，最新结果见 [复审问题闭环](2026-10-14-branch-review-fixes.md)。

## 结论

七项阶段零失败全部修复，原空分支拒绝守卫继续通过；补充身份、语义、DI、嵌套删除、ID 回收和文档往返回归通过。本轮没有引入工作台缓冲、主题或 EntityRef 实现，不能据此宣布阶段零全部出口通过。

完整测试以 `pnpm -r test --testTimeout 20000` 执行，**482/482 通过**：core 141、designer 161、form-create 125、Playground 55。`pnpm build` 和 `pnpm lint` 通过；构建保留 Playground 大 chunk 告警。

**限制必须保留：** 默认 `pnpm test` 在基线及修复后均出现既有表单组件用例的 5000ms 超时（`components.test.ts` 的“选中字段后：联动与编辑数据入口不渲染，静态选项与必填配置在场”）。单独延长时限后原断言通过，完整套件同样在延长时限下通过；未修改测试配置或断言，不能称默认命令全绿。未运行 Node 22/24 远端 CI 和 Flowable 物理部署/执行；本机未发现 Flowable 镜像，本轮未下载或启动引擎。

## 修复内容与合同

| 路径                         | 最终行为                                               | 回归证据                                             |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| 单→多、条件/default          | 原位挂载 loop，保留任务与两侧连线及 DI                 | 原始 2 项失败转绿；三档往返、扩展和几何测试          |
| 多→单、条件/default          | 移除受支持 loop，清除集合 assignee，保留任务其余内容   | 原始 2 项失败转绿；不支持 loop 前置拒绝              |
| 删除支路首节点、条件/default | 原入边改接后继，删除原节点及原出边                     | 原始 2 项失败转绿；完整表达式、引用与顺序检查        |
| 删除支路头嵌套块             | 完整块树上预计算集合，原外层入边跨过整块               | 原始 1 项失败转绿；条件/default × 内嵌条件/并行块    |
| 结构拒绝                     | 空分支、损坏引用、跨边界连接等在写入前拒绝             | XML/端点/引用/几何不变检查；既有多层嵌套与空分支用例 |
| DI                           | 转换保留几何；重接废弃旧路线；删除同步清除物化图引用   | 完整/缺失/混合 DI，非标准 DI ID，多图与历史 root 图  |
| 编译                         | 默认 Identity 保持严格；布局或序列化失败恢复原 DI 容器 | 两项红转绿；自动布局幂等且不回填登记表               |
| 保存恢复                     | 支路 ID/顺序/条件/default 与表单绑定保持               | 条件/default × 删除节点/嵌套块，连续保存恢复两次     |
| 同文档 ID 回收               | 新插入连线用空闲 ID 探测，不与存续入边碰撞             | 既有重插用例发现联动问题；审批和抄送新增回归         |

原始 8 项探针已迁入 `packages/designer/src/branch-preservation.test.ts`，该文件含补充边界共 19 项。原始失败输出保存在 [seven-red.txt](evidence/2026-10-14-branch-structure-repair/seven-red.txt)。完整最终测试输出见 [final-suite.txt](evidence/2026-10-14-branch-structure-repair/final-suite.txt)。

## 真实 Playground 验收

使用正式 Playground 入口 `http://127.0.0.1:5174`，通过 Playwright CLI Chromium 的真实文件选择器与下载完成，没有调用 Vue 内部状态替代编辑动作。

1. 打开 [带完整 DI 的输入文档](evidence/2026-10-14-branch-structure-repair/input.flowduet.json)，BPMN 可见两条有序支路及默认标记。
2. 钉钉式点“默认首审批”，单签切会签、输入 approvers、确认；BPMN 中多人审批标记及默认支路仍在。
3. 切回单签、填写 alice、确认；悬停删除该首节点。
4. BPMN 中 fa 指向“默认后续审批”，默认标记与兄弟条件保留；后续节点从原 y=396 移至自动布局 y=256，箭头到达新节点顶部。
5. 点击“下载设计文档”，保存原生下载字节，再从文件选择器重新打开该下载；钉钉式显示默认后续审批和条件审批，原首节点消失，左右支路未换位。

截图：[转换后 BPMN](evidence/2026-10-14-branch-structure-repair/converted-bpmn.png)、[删除后 BPMN](evidence/2026-10-14-branch-structure-repair/deleted-bpmn.png)、[重开后的钉钉式视图](evidence/2026-10-14-branch-structure-repair/reopened-dingtalk.png)。

原生下载：[downloaded.flowduet.json](evidence/2026-10-14-branch-structure-repair/downloaded.flowduet.json)。经当前 core 构建产物解析，断言 fa ID/name/default、targetRef=tail、fork.outgoing=[fa,fb]、兄弟条件表达式、旧节点/边消失与新路线端点；全部通过。可在构建后重跑：

```sh
node docs/design/reviews/evidence/2026-10-14-branch-structure-repair/verify-download.mjs
```

校验和及断言结果见 [download-verification.json](evidence/2026-10-14-branch-structure-repair/download-verification.json)。浏览器控制台仅观察到 favicon.ico 404，无应用异常。一次自动化点击点到了被样式覆盖的 radio input、一次输入使用了切换后过期的元素引用，刷新快照后改用可见标签/当前输入完成；不将这两次自动化选择器失败计为产品缺陷。

浏览器正向链路执行于 `c7d9624` 的构建产物；此后唯一生产补修是损坏连线 ID 的前置拒绝（`cd16534`），其已通过专项与全套回归，并完成最终重建；未把前一构建的浏览器操作冒充补修后全部 UI 重跑。

## 独立复核与处置

按 executing-plans 的单次全分支复核流程，由独立 `gpt-6-astra` reviewer 审阅 `a72dc9d..c7d9624`，只读检查，无子级派审。结论：Critical 0 / Important 1 / Minor 1，原结论为 With fixes。

- **Important 已修复**：`retargetSequenceFlow` 原先漏查 flow 当前 ID 与登记键的一致性，直接外部改 ID 后仍能重接并造成后续删除失败。新增 `renamed-flow` 用例观察失败，再增加前置拒绝；验证 XML、端点、数组引用和 DI 不变。证据：[red](evidence/2026-10-14-branch-structure-repair/review-red.txt)、[green](evidence/2026-10-14-branch-structure-repair/review-green.txt)。补修后完整套件 482/482；没有二次派审，不宣称 reviewer 已复审该提交。
- **Minor 延后**：operations 与 NodeDrawer 中部分旧注释仍提“重建节点”。行为已原位更新，注释清理留后续维护，不构成结构验收阻断。

Reviewer 未判断的范围与执行者裁定：同模型并发 compile、第三方布局任意语义修改回滚、工作台生命期/缓冲、任意第三方 BPMN 全细节编辑均维持已确认的范围外约束；Node 22/24 CI 与 Flowable 运行缺少本轮证据，明确未验证。

## 本轮决策与代价

- 无现成修复票，按仓库非票规范使用 refactor 分支；未写外部 Issue。后续 PR 需关联规格。
- 用户明确要求开始实施，清单只是已确认方案的展开，没有增加一轮重复授权；没有扩大到工作台实现。
- core 测试沿既有 src/model 目录；完整八项合同随删除修复提交，首个转换提交由独立转换测试覆盖。
- 保留入边暴露旧插入 ID 命名碰撞，连线 ID 改为探测空闲值；依赖旧生成名的集成需读取实际 ID，changeset 已说明。
- Git/Prettier 排除本地技能和浏览器缓存；原始下载与运行证据保留字节，不做格式重写。正式源码与文档继续检查。
- 默认测试命令的既有 5 秒超时保留如实记录，运行时增加到 20 秒完成全套；没有通过删断言或改测试配置掩盖失败。
- 删除后整图自动布局为已确认取舍；不提供局部手工布局保留。默认 Identity 缺坐标仍拒绝。
- compile 恢复只覆盖其 DI 容器，第三方修改和同模型并发仍可能冲突；对象缓冲/生命期交给后续阶段，不能承诺旧缓冲问题整体解决；超出编辑子集的第三方 BPMN 可能只读或拒绝。

## 本地提交

- `554c12f`：审批原位转换、支持形态守卫与测试，归档已确认提案和清单。
- `e6210ff`：安全重接、结构删除、DI 清理、插入 ID 碰撞与边界回归。
- `69f7ced`：编译异常恢复、几何与设计文档往返回归、changeset。
- `c7d9624`：执行缓存排除及确认状态同步。
- `cd16534`：独立复核发现的损坏 ID 前置拒绝。

本轮完成本地修复与上述回归；分支与工作区保留，未推送、开 PR、合并或发布。后续远端 CI/引擎验证及 PR 流程需在用户授权相应动作后继续。用户现在无需操作。
