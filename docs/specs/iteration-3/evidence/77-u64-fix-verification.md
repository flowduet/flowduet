# PR #89 U64 最小修复与定向复验（2026-10-13）

## 对象与结论

修复提交：`7be3aff`。

修复基线：`1f5bbffee51c076045aa5aad6f8c0793b321da96`，沿 PR #89 现有分支 `chore/77-package-acceptance-release` 继续。没有新建 Issue、改变架构或处理流程内核，未推送、合并、发版。产品变更仅 `FormPreview.vue`，无新增依赖。

U64 在修复前已用真实组件复现失败，修复后真实组件测试及 Codex 内置浏览器 11 次定向观察均通过。历史 133 项验收记录不覆盖：上一轮 131 通过、U64 失败、U62 阻塞；本轮只复验相关场景，不宣称重跑全部 133 项。U64 已修复待远端 CI，U62 原生文件选择取消仍需要维护者手工验证后才能关闭验收缺口。

## 根因及修复

FormPreview 在新的 `form` 对象到来时把 `trialValue` 置为空对象，但第三方 FormCreate 渲染器仍复用旧实例。其 `updateValue` 对与上次相同的序列化值直接返回，不再 emit；`modelValue` 的默认 merge 更新又不会将空对象变成新的完整默认值。因此相同内容重开会出现“可见默认正确、当前值{}”。初次挂载及改变默认值时不一定复现，旧测试仅检查默认回显/旧试填消失，漏掉了相同定义无试填时的当前值一致性。

复核安装版本源码：`@form-create/core@3.3.4/src/components/formCreate.js` 的 `updateValue` 去重与 `modelValue` watch。两条真实组件新回归分别覆盖未试填/已试填后的相同 ID、相同定义换代；修复前未试填分支失败：expected `{reason: "默认事由"}`，received `{}`；该轮实际 1 failed / 120 passed。

最小改动：定义对象换代时递增内部 renderer key 重建真实渲染器，同时重置试填、校验反馈及旧 API 引用。新实例从规则恢复默认并向父层发完整当前值。普通试填期间不会递增 key，不把试填写入设计定义；无需手工复制各字段的默认值，也不改变宿主或公开接口。

## 内置浏览器操作与证据

普通路径均通过 `mcp__cua_repl` 的 Codex In-app Browser 实走真实公开 UI、文件选择和下载，不用外部 Playwright CLI 或私有 Vue 状态。CDP 仅备份/读取/恢复宿主 localStorage，没有故障注入或组件替身。本轮基于已重建的 form-create dist 运行 Playground。

| 记录   | 操作与判定                                                        | 证据                                                                                          |
| ------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R01    | 首次加载：文本、数字0、false、[]及布局默认与当前值一致            | [截图](77-u64-fix/R01-initial.jpg)                                                            |
| R02 ×3 | 同一 S1 文件连续重开三次，每次可见默认与当前值一致                | [第3次](77-u64-fix/R02-reopen-3.jpg)                                                          |
| R03    | 试填申请单后切复核单，不混入申请单值；切回恢复设计默认            | [截图](77-u64-fix/R03-other-target.jpg)                                                       |
| R04    | 已试填、切目标再重开同 ID 文件，默认与完整当前值一致              | [截图](77-u64-fix/R04-reopen-after-trial.jpg)                                                 |
| R05    | 必填多选默认[]时校验失败                                          | [截图](77-u64-fix/R05-required-empty.jpg)                                                     |
| R06    | 勾选非空后校验通过                                                | [截图](77-u64-fix/R06-required-filled.jpg)                                                    |
| R07    | 重开清除上次校验结果，新渲染器API仍能触发失败校验                 | [截图](77-u64-fix/R07-new-api-validation.jpg)                                                 |
| R08    | 同 ID 新默认文档公开文件选择打开，字段与当前值都显示新默认        | [输入](77-u64-fix/changed-default.flowduet.json) / [截图](77-u64-fix/R08-changed-default.jpg) |
| R09    | 输入新试填后保存及实际下载，forms与设计输入完整等值，没有试填内容 | [下载副本](77-u64-fix/downloaded.flowduet.json)                                               |

每条记录有 AX 与原始 JPEG；[结构化结果](77-u64-fix/results.json)。本轮测试前的用户草稿重新备份，结束恢复字符串字节相同，[清理检查](77-u64-fix/cleanup.json)。用户原草稿不入库。

## 工程验证

`pnpm build`（含 vue-tsc）、`pnpm lint` 均 exit 0；`pnpm test` 单独重跑 exit 0。保留 [首轮测试失败](77-u64-fix/test-first-run.log)、[全仓复验](77-u64-fix/test-recheck.log)、[lint复验](77-u64-fix/lint-recheck.log)、[构建](77-u64-fix/build.log)。首轮全仓测试在并行 build 时出现一次既有 `App.integration.test.ts:1640` “读取期间新打开表单编辑器也保持当前目录及编辑器”5000ms超时；保留失败日志，未调宽超时或改动该测试。随后单独重跑全仓测试全部通过：core125、designer127、form-create121、Playground55，合计428。本轮证据快照以 scoped ESLint/Prettier ignore 保留原始字节，不改写坏 JSON 输入或操作脚本。

修复前红测试有输出证实；修复后 focused FormPreview 9 passed。完整构建有 Playground 大块体积提示，非构建失败。远端 CI 仍属于旧 HEAD，不能当本轮未推送提交的CI证据。

## 下一步与责任

本轮本地修复、定向复验和证据整理后在 PR #89 留评论。按用户要求及仓库逐项确认规则，等待用户授权推送指定本地提交；授权后由 Codex 推送 PR 现有分支、核对新 HEAD 的 Node22/24 CI并更新评论。合并前维护者需通过 Playground 手工打开原生文件选择器取消一次并记录 U62 结果，最终由维护者审阅合并。本轮没有建立后台自动任务。
