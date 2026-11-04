# #103 第二轮原始证据归档与复核

2026-11-04 补齐。固定实施提交为 `7ca2331dfa203dbaec163a2480f9717a7ccb33af`，完整基线为 `cd39258b3ab4d3b77f20994e85b58a4519746b4e`，上一轮修复基线为 `79bbea9136f33ff67b247aaa6238f763f3737790`。本次仅恢复证据、补建清单并核对，不重跑或改写历史验收结果。

此前只核对工作树、Git 与临时目录，漏掉了 Antigravity 会话存档。此次在会话 `95efc0a0-a44a-4f70-84d1-46f8589a7718` 的本机任务目录找到原始命令输出、收到的子代理报告与审查补丁。完整来源路径、时间字段、退出码及原文件哈希见 [provenance.json](provenance.json)。不复制会话思考、完整提示或机器配置。

## 原始工程日志

下列文件是任务日志的逐字节副本，没有删除失败、警告或合并重跑结果。`build.log` 保留原组合命令的完整输出，包括格式化、lint 与 build，并非另造的一次独立 build。

原日志包含终端回车，补丁包含单空格上下文行，均按原字节保留，不清除这些空白。新增说明、清单与校验脚本单独做格式检查，原始文件以 SHA-256 和补丁重建结果核对。

| 文件 | 原任务 / 命令 | 原退出码 | 核对结果 |
| ---- | ------------- | -------- | -------- |
| [test.log](logs/test.log) | step 256；`pnpm --dir <工作树> test` | 0 | 一次标准递归执行；core 148、designer 202、form-create 312、Playground 306，共 968 条通过 |
| [lint-first-failed.log](logs/lint-first-failed.log) | step 271；`pnpm --dir <工作树> lint` | 1 | 原首次 Prettier 格式检查失败保留，不用后续成功覆盖 |
| [build.log](logs/build.log) | step 275；`prettier --write . && pnpm lint && pnpm build`，均指定原工作树 | 0 | 格式修正后 lint、四包构建通过；保留既有大 chunk 提示 |
| [lint.log](logs/lint.log) | step 298；格式化两份文档后执行 lint、哈希及状态核对 | 0 | 最终文案修正后的 lint 通过；原输出含 `499a…0720` |

原工具结果由“退出状态前缀＋原始任务日志”组成。`provenance.json` 保留该前缀和完整工具结果的 SHA-256；核对脚本可重建工具结果字节并对照原哈希，避免只凭文件名或手写退出码判定成功。原标准测试没有更改 5 秒时限；本次归档没有运行业务测试。

首次 lint 的两项格式问题均在 `behavior.json`、`matrix.json`；后续格式化原输出将本轮产品和测试源码列为 `(unchanged)`。后续收尾修改为 changeset、验收说明及 README 的颜色边界文案，不将这些时间先后关系伪称为测试开始时已冻结完整工作树。

## 原始双轴复审报告

- [Standards 报告](reviews/standards.txt)：来自独立会话 `ad736ab1-5a8e-4268-91a7-dae772524e4a`。原报告为重要 0／细节 1／既有 1；细节是两份新增证据未纳入初始补丁。`7ca2331` 已跟踪这两个文件，后续 `9ad5…40a1` 的组合范围也明确纳入二者。既有无害样式规则未扩大处理。
- [Spec & High-Risk 报告](reviews/spec.txt)：来自独立会话 `632e9939-0960-4d38-aeeb-4a70a61a3704`。原报告为重要 0／细节 1／既有 1；细节是系统色与 `light-dark()` 的说明，已在最终 README 修正。既有 form-create 耗时波动保留，单次全绿不表示稳定性问题消除。

两份报告正文直接取自父会话收到的消息 `content`，没有重新生成或压缩。对应完整原消息 JSON 分别存于 [standards-message.json.txt](source-records/standards-message.json.txt)、[spec-message.json.txt](source-records/spec-message.json.txt)；使用 `.txt` 后缀保留原 JSON 字节。报告正文须与原 JSON 的 `content` UTF-8 字节一致。

## 历史范围哈希与最终完整快照

两种快照分别保留，不能将范围有限的旧哈希当作整个工作树的哈希。

| 对象 | 文件 / SHA-256 | 来源与范围 |
| ---- | -------------- | ---------- |
| 原审查完整文本补丁 | [original-diff-from-cd39258.patch](snapshots/original-diff-from-cd39258.patch) | 从原 scratch 恢复；当时排除了 PNG，也没有包括未跟踪的两份新增证据；报告中的归档细节正是对此的提醒 |
| 原审查增量文本补丁 | [original-diff-from-79bbea9.patch](snapshots/original-diff-from-79bbea9.patch) | 从原 scratch 恢复，具有相同排除边界 |
| 原复审范围组合 | [reviewed-scope.patch](snapshots/reviewed-scope.patch)，`9ad5f196e998da21f0ae3854ecc1149fd2dcb2265ce0b7e1d5d4969b555840a1` | 精确重建：原完整文本补丁中 `packages/`、`apps/` 部分，依次追加两份 `round2-fixes` 的 `/dev/null` 差异；与原 [step 292 输出](source-records/step-292-output.txt) 完全匹配 |
| 最终文案修正后的同一范围 | [final-scope.patch](snapshots/final-scope.patch)，`499a53fddaf6337384790003912bfa4b2c38d8fffff17b4a8ff3ca58715f0720` | 只改变 README 的系统色说明及对应 Git blob 头；与原 `lint.log` 中最终哈希匹配，产品与测试源码不变 |
| 最终提交完整二进制补丁 | [final-full.patch](snapshots/final-full.patch) | 本次由不可变 `cd39258` → `7ca2331` 补建，含所有提交变化、PNG 与新增证据；应用到基线临时索引后须精确得到目标 tree |
| 最终提交逐文件清单 | [source-manifest.json](snapshots/source-manifest.json) | 本次从 Git blob 补建，列出 `7ca2331` 的全部 2824 个受跟踪文件的路径、模式、Git blob、字节数及 SHA-256，另列基线／目标 tree 与三份组合补丁哈希 |

旧组合哈希包含原机器的绝对路径。核对脚本只在新文件 diff 头恢复这些历史路径，文件内容从固定提交读取，因此可在其他 checkout 复算。脚本另将原文本补丁应用到临时索引，比对 `packages/`、`apps/` 下除 README 之外的全部 221 个文件，确认复审后产品和测试源码没有变化；最终完整补丁则验证整个目标 tree。

## 无法恢复或从未单独保存的部分

1. 原 stdout 与 stderr 已合并为终端输出，无法还原两个独立通道；归档保留原合并字节。
2. 后台任务精确进程结束时间没有单独保存，不把后续查询时间、文件时间或 Vitest 单包耗时倒填为进程结束时间。
3. 原会话未保存“复审当时整个未提交工作树”的完整字节快照。`9ad5…40a1` 的有限范围已精确恢复；最终 `7ca2331` 的完整补丁和逐文件清单属于本次补建，不追认当时覆盖了所有工作树字节。
4. 原完整机器环境快照没有单独保存。本次只核对现存命令、仓库配置与原输出，不倒填补证时的环境为历史环境。

lint／test／build 的原输出、原双轴报告、原有限范围组合哈希本身均已恢复，不用新执行结果替代。先前历史超时和浏览器 404 仍按主验收记录保留；本归档不补做 Node 22、其他浏览器、真实操作系统输入法或 #108 三包矩阵。

## 复算方法

在包含基线与目标提交的仓库中执行；只需要 Python 3 和 Git，不新增依赖、不改当前暂存区。

```sh
python3 docs/design/system-v1/brand/evidence/103-property-drawer/round2-archive/verify.py
```

预期 `result: PASS`、`source_files_checked: 2824`、`product_and_test_files_unchanged_after_review: 221`、`original_test_total: 968`，并复得上述 `9ad5…40a1` 与 `499a…0720`。脚本核对归档所有文件的 SHA-256、原日志及工具结果、原报告正文、原范围哈希、全部 Git blob 与完整补丁生成的 tree，不重新执行业务测试。任何核对失败均以非零退出码结束。

目录内 [SHA256SUMS](SHA256SUMS) 覆盖除它自身以外的全部归档文件（包括脚本和清单），也可在本目录执行 `shasum -a 256 -c SHA256SUMS`。本次没有产品代码变更，撤回补证文档提交即可移除本目录，不涉及数据迁移。
