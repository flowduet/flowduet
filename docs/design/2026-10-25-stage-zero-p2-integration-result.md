# 阶段零 P2 本地整合与验证结果

2026-10-25。分支 `refactor/stage-zero-p2-integration` 从远端 `develop@9a0d6bd542178e2d405279eae7c13d7f076ed024` 创建。产品工程提交为 `6b91cb4`，19 个工程文件与 P2 来源 `fcd715408579979240b8543cfbcab844c451436d` 逐字一致。供应商候选未迁入，依赖、lockfile、CI 和 legacy 默认未改；未推送、开远端 PR、合并 develop 或发布。

**结论：P2 本地工程门通过，限定包消费与输入保真路径通过；宿主处理器保持检查失败。** 本分支可作为待审阅候选，不代表首批宿主嵌入已经放行。远端 Node 22/24 CI 与维护者审阅仍是合并条件，阶段零完整目标仍未验收通过。

## 变更与文档收尾

- 产品变化：显式 retained 模式的文字空串/未设置区分、字段生命期和同步捕获保护，以及对应真实组件测试、夹具隔离、构建排除、文件串行和原三项 15 秒例外。[19 项来源清单](system-v1/probes/evidence/p2-integration-2026-10-25/source-manifest.json)给出 SHA256。未新增依赖或公共取消 API。
- 文档变化：[收尾清单与风险处置](2026-10-25-stage-zero-closeout-inventory.md)、15 个计划/决策入口及两个 README 已同步；历史“继续实验”不再构成当前指令。[更新清单](system-v1/probes/evidence/p2-integration-2026-10-25/document-updates.json)逐项记录处理方式。
- 原文保留：未迁入 develop 的计划使用精简停用入口，20 份历史原文按原字节收入[归档](system-v1/probes/evidence/p2-integration-2026-10-25/historical-sources.tar.gz)，[成员索引](system-v1/probes/evidence/p2-integration-2026-10-25/historical-sources.json)列来源及哈希。没有整批迁入 771 个 docs 文件，没有修改原实验工作区或给其他会话发送消息。

## 正常工程校验

本地 Node 24.16.0、pnpm 10.26.1。依赖用现有缓存、frozen lockfile、ignore-scripts 安装；无下载依赖升级和锁文件改动。

| 项目               | 本次结果        | 证据/限制                                                                                   |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| 默认 `pnpm test`   | 950/950，退出 0 | core 148、designer 184、form-create 312、Playground 306；一次完整运行，无重试或全局时限覆盖 |
| `pnpm lint`        | 退出 0          | ESLint 和 Prettier；收尾新增文档再作末次检查                                                |
| `pnpm build`       | 退出 0          | 保留既有大 chunk 告警，不为消除告警扩大修改                                                 |
| 私有夹具类型       | 退出 0          | `pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p tsconfig.test-fixtures.json`  |
| core 原生 ESM      | 退出 0          | 实际 dist 导入及 CORE_VERSION 检查                                                          |
| Node 22/24 远端 CI | 未执行          | 无推送；当前没有本地 Node 22，不宣称双矩阵已通过                                            |

命令原件位于[证据目录](system-v1/probes/evidence/p2-integration-2026-10-25/)，以 gzip 保存。历史测试失败没有被覆盖，本表只记录当前候选的运行。

## 独立消费与浏览器

三包实际打成 tarball，在仓库以外的新目录安装；没有 workspace/source alias。消费工程使用 Vue 3.5.43、Element Plus 2.14.6 和仓库已安装的固定生产依赖组合。[包哈希](system-v1/probes/evidence/p2-integration-2026-10-25/packages.json)、[依赖与别名](system-v1/probes/evidence/p2-integration-2026-10-25/consumer-dependencies.json)、[消费源码与驱动](system-v1/probes/evidence/p2-integration-2026-10-25/consumer-source.tar.gz)可复核该来源。

| 项目                        | 本次结果                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 实际包的 Node 入口/CSS 解析 | 通过：core 编译往返、designer 导出、CSS 文件均成立；form-create 纯 Node 导入按预期报告 `document is not defined` |
| 包声明严格消费              | `tsc --noEmit` 通过，skipLibCheck=false，包含三包公开组件和 retained DTO                                         |
| 消费工程生产构建            | 通过，无源码别名；保留大 chunk 告警                                                                              |
| retained 中文文本           | “中文申请说明”可捕获、保存和重开；这是普通文本输入，不是 OS IME 完整验收                                         |
| 文字空串/未设置             | 清空仍有 `value: ""`；关闭默认值后没有 value；重开后仍未设置                                                     |
| 其他值与输出                | 0/false 保持，未输出 `__flowduet` 编辑标记，组合 XML 导出成功；没有本轮引擎部署                                  |
| 中间数值与保存              | 输入 `-` 后捕获 blocked，已保存文档未被替换，原文保留；改为 0 后可保存                                           |
| legacy 对照                 | 重建为 legacy 后原 exportContent 可用，0 保持；未改变默认模式                                                    |
| 浏览器页面异常              | 最终验证 pageerror 0；初始 favicon 404 单列为静态资源请求，不当作业务异常                                        |
| 宿主处理器保持              | **失败**：挂载后及卸载后 onbeforeunload/body.ondrop 均不再是宿主原处理器                                         |

[最终浏览器读回](system-v1/probes/evidence/p2-integration-2026-10-25/browser-final-result.txt)及[retained 截图](system-v1/probes/evidence/p2-integration-2026-10-25/p2-retained.png)保留原件。宿主失败在一次固定来源的正常挂载/卸载中发现，没有开展供应商修复或取消/全主题实验。

### 消费准备中的失败与纠正

首次离线 semver 解析选择了 bpmn-moddle 10.3.1，但缓存缺少它所需的 moddle-xml ^12.3.1，安装失败。随后只在消费工程固定仓库已有组合。生成覆盖项时遗漏 npm 别名，导致安装错误和 Node 中 Popper named export 错误；已按实际包身份恢复 `@popperjs/core → @sxzz/popperjs-es@2.11.8` 及三项 cjs 别名。

消费工程还补齐了显式导入样式所需的直接依赖 `@vue-flow/core`，以及固定 pnpm 10.26.1，避免临时目录使用机器默认 pnpm 11 自动执行安装。最初点击设计画布内输入被正常拖动遮罩拦截，改为点击真实设计项后进入属性区；没有 force 点击或绕过业务层。

这些纠正只涉及临时消费工程/操作定位，未改变产品、断言或验收阈值。失败日志和最终日志分别保留；最终依赖别名修正后重新执行包入口、严格类型、构建和同一浏览器核对。只证明此固定组合，不外推全 peer 区间或任意新传递依赖组合。

## 剩余风险与交付边界

1. **宿主嵌入尚未放行。** 当前供应商挂载/卸载会覆盖且不恢复宿主全局处理器，限定消费已确认此风险。它不是本次 P2 的新增改动，但不能用单实例或文档声明豁免。P2 修复可单独进入代码审阅；需要嵌入真实宿主时，须先另行确定处理方案。本轮不改供应商。
2. 默认 Playground 未传 retained，因此不能直接展示 P2 的完整输入保留效果。已在独立消费工程显式启用验证；正式试用入口若要启用，需另做最小接入改动，不假称本轮已改。
3. Node 22/24 远端 CI、最低 peer 组合、OS IME、天然序列化异常、完整主题和多实例资源矩阵未验证。后四类实验保持冻结，不自动补跑。
4. 本轮没有完成真实外部用户试用、完整 FormManager 路由集成或 Flowable 部署。现有测试中的 Manager 回归不替代具体宿主路由验证。
5. 三包本地 tarball 沿用源码当前版本号，仅用于验收；尚未运行 changesets version/publish。未来发布需处理全部累计 changeset，不复用已发布版本。

## 审阅与后续

独立静态审阅将在固定整合提交上执行，其结果另行附录。当前本地 tarball 位于工作区 `output/p2-integration/`，按[包哈希](system-v1/probes/evidence/p2-integration-2026-10-25/packages.json)定位；原消费源码包中 file 依赖为本机验收路径，复现时须改为实际 tarball 绝对路径，不能当作可直接复制的安装说明。

后续由维护者决定是否推送并开 PR；准确 PR head 的 Node 22/24 CI 全绿并审阅后，才由维护者 squash 合入 develop。推送、发布与联系试用者均未授权，没有后台自动推进。
