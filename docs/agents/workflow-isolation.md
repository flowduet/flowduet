# 工作流隔离验证

## 当前结论（2026-11-02）

- 用户自行卸载本机 Superpowers Codex 插件后，系统最新下发的技能清单已不包含 `superpowers:*`；本次模型可见技能清单检查通过。
- 该结果来自卸载后的清单变化，不能证明原有项目配置已成功禁用远端 Superpowers。明确小改动、模糊新功能、已批准实施票、专业技能介入四项行为场景仍待验收，不能据此宣布工作流隔离整体验收通过。
- 本次仅更新本记录；不落地逐技能过滤方案，不修改项目配置、技能文件或全局配置。助手未执行卸载操作，也未建立新聊天或后台验收任务。

## 初始 CLI 配置隔离（历史结果）

2026-11-02 在 FlowDuet 添加以下项目配置，未修改用户级配置、上游技能、插件缓存、全局 hook 或外部服务权限：

```toml
# .codex/config.toml
[plugins."superpowers@openai-curated"]
enabled = false
```

本机 `codex-cli 0.165.0-alpha.1.2` 的新进程实测：

| 检查位置                    | `superpowers@openai-curated` 的有效状态 |
| --------------------------- | --------------------------------------- |
| FlowDuet 根目录             | `installed: true`、`enabled: false`     |
| FlowDuet 的 `packages/core` | `installed: true`、`enabled: false`     |
| 项目外空临时目录            | `installed: true`、`enabled: true`      |

初始检查时，用户级 `~/.codex/config.toml` 检查前后 SHA-256 相同，其中 Superpowers 仍开启。CLI 插件列表报告的版本为 `bd2122cb`，来源为 `local`；当时桌面聊天的技能目录路径包含 `7.0.1`，二者不作版本等价断言。可复核的配置哈希、实际命令和技能来源哈希见 [JSON 证据](evidence/workflow-isolation-2026-11-02.json)。该 JSON 保留初始结果，未改写为后续桌面排查或卸载后的证据。

这些结果证明本机 CLI 的有效开关按项目隔离。它们不能证明当前桌面聊天已卸载旧技能，也不能证明后续所有任务一定按预期分流。

## 桌面排查与卸载后复查（2026-11-02）

### 配置合并与远端插件身份

用户报告已完全退出并重启客户端后，桌面技能清单仍包含 15 个 `superpowers:*`。排查确认实际工作目录为 FlowDuet，项目信任状态为 `trusted`；桌面版本为 `26.1023.51421`（22530），其捆绑 CLI 与命令行 CLI 均为 `0.165.0-alpha.1.2`。

通过新进程 App Server 的 `config/read`（`includeLayers: true`）核对，项目 `.codex/config.toml` 已覆盖用户级设置，`superpowers@openai-curated.enabled` 的有效值为 `false`。继续读取安装元数据后确认两份安装的身份不同：

| 对象                         | 标识与来源                                                                                                                      | 版本                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 原项目配置禁用的本地市场插件 | `superpowers@openai-curated`，来源为 `local`                                                                                    | 清单版本标识 `bd2122cb`，manifest 为 `5.1.3` |
| 桌面实际加载的远端插件       | 清单 ID 为 `superpowers@openai-curated-remote`，来源为 `remote`；服务端 ID 为 `plugins~Plugin_60aea7460bd4819199fd97a9553a5e12` | `7.0.1`                                      |

远端技能路径为 `~/.codex/plugins/cache/openai-curated-remote/superpowers/7.0.1/skills/*/SKILL.md`，安装元数据 `.codex-remote-plugin-install.json` 记录了上述服务端 ID。

后续以进程内临时 `-c` 覆盖做对照，未写入配置文件。每组等待远端技能扫描完成，并通过 `skills/list`（`forceReload: true`）检查实际技能状态，避免把启动阶段尚未返回远端技能当成禁用成功：

| 临时覆盖                                                                                 | 实际结果                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 不增加覆盖，沿用原项目配置                                                               | 15 个远端 Superpowers 技能启用                                             |
| `plugins.superpowers@openai-curated-remote.enabled=false`                                | 有效配置为 `false`，15 个远端 Superpowers 技能仍启用                       |
| `plugins.plugins~Plugin_60aea7460bd4819199fd97a9553a5e12.enabled=false`                  | 有效配置为 `false`，15 个远端 Superpowers 技能仍启用                       |
| 对 15 个完整 `SKILL.md` 路径逐项设置 `skills.config` 禁用，并保留已有 `hatch-pet` 禁用项 | Superpowers 为 0 个启用、15 个禁用；`hatch-pet` 仍禁用，其他远端技能仍加载 |

本机该版本中，两种远端标识的插件级 `enabled=false` 均未过滤远端技能，不能把“换成远端插件标识”作为已验证修复。[官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)将 `plugins.<plugin>.enabled` 限定为本地市场插件开关。逐技能覆盖测试还发现：必须使用完整 `SKILL.md` 文件路径，仅填写技能目录没有生效；覆盖数组也未自动追加用户级已有条目。

逐技能过滤只形成过临时验证和提案，没有落盘，也没有完成对应的项目文件及桌面新聊天验收。用户随后选择自行卸载插件，本项目不采用该替代方案，不新增上述 16 条 `skills.config` 配置。

### Matt 技能未进入默认清单的原因

卸载前排查时，初始 JSON 中记录的 19 个 Matt 技能文件均存在，`SKILL.md` 哈希与该记录一致。其中以下 10 个技能的 `agents/openai.yaml` 设置了 `policy.allow_implicit_invocation: false`：`ask-matt`、`grill-with-docs`、`to-spec`、`to-tickets`、`implement`、`implement-spec`、`retro`、`triage`、`wayfinder`、`handoff`。

扫描接口可发现这些技能，返回 `enabled: true` 且无扫描错误；该策略使它们默认不注入模型技能清单，仍可显式调用，含义见[官方调用策略说明](https://learn.chatgpt.com/docs/build-skills#optional-metadata)。当次日志记录 `omitted_skills=0`，排除了清单预算裁剪。不能把默认清单中未出现这些技能写成安装失败，也不为此修改上游技能或调用策略。

项目工作流与技能允许范围的来源已定位为根目录 [AGENTS.md](../../AGENTS.md) 的 Agent skills 入口、[workflow.md](workflow.md) 和 [skill-policy.md](skill-policy.md)。工作流以 Matt 的 Ask Matt 图谱为上游来源，由项目文档规定阶段适配与授权边界；技能允许范围不改变运行时加载或隐式调用策略。

### 用户卸载后的清单检查

用户在本聊天报告已自行卸载本机 Superpowers Codex 插件。随后系统重新下发的可用技能清单不再包含 `superpowers:*`，本次加载目录检查据此通过。

此结论只覆盖当次最新下发的模型可见清单；助手没有独立执行或审计卸载过程，也没有据此确认磁盘缓存清理、账户安装状态、其他项目状态或既有聊天上下文均已清除。用户自行卸载是本机安装状态变更，不能记作项目级配置隔离通过。助手的排查未修改全局配置；本次文档更新继续保持项目配置与全局配置原样。

## 生效条件与配置边界

[OpenAI 插件配置说明](https://developers.openai.com/plugins/build/plugins#enable-or-disable-a-plugin-for-a-repo)规定，受支持本地客户端可从受信任项目的 `.codex/config.toml` 读取插件开关；项目配置不改变管理员管理的安装策略。因此每台机器、每种客户端及升级后都应验证实际状态，不能只看文件存在。

- 配置随当前工作区存在；其他 checkout 或工作树只有带上这份配置后才具备同样设置。仓库级交付需依现有流程提交和合入。
- 当前聊天启动时载入的技能仍可能留在上下文。下一次开发应在配置已落盘、项目受信任的新聊天中检查技能目录；必要时重新打开客户端。
- 用户级、管理员级或启动参数的覆盖另行核查。本轮不需要全局调整；若将来确需修改，先展示具体补丁、影响的其他项目及恢复方法，取得用户确认后执行。
- [技能禁用说明](https://learn.chatgpt.com/docs/build-skills#enable-or-disable-local-codex-skills)给出的用户级 `skills.config` 不作为本项目隔离的替代方案；本次逐技能过滤提案也不落地。配置验证不要求改写上游技能元数据或删除插件；用户自行卸载的后续结果按上节单独记录。
- `skill-policy.md` 是调用规则，不是运行时权限限制；保留的工具和专业技能仍受平台指令、任务范围与项目授权约束。

## 可复验步骤

如需复验 CLI，先确认当前实际安装状态，再在 FlowDuet 根目录和一个子目录分别运行：

```sh
codex plugin list --marketplace openai-curated --json
codex plugin list --marketplace openai-curated-remote --json
```

分别定位本地市场与远端插件记录，报告实际身份、来源、安装及启用状态。初始历史对照是本地市场插件在项目内 `enabled: false`、项目外 `enabled: true`；用户卸载后应按现状报告缺失或其他实际状态，不再强求项目外仍启用，也不要通过重装或修改用户配置制造对照。远端列表状态还应与实际技能清单分开核对。

`codex debug prompt-input` 可辅助核对项目指令，但本机禁用前其技能目录就未列出 Superpowers，所以不能用它的“未出现”证明本次禁用有效。完整原始提示可能含个人或项目上下文，保留证据时只提取必要且已脱敏的字段。

## 桌面技能清单与行为场景验收

截至 2026-11-02，本次卸载后的技能清单检查已完成；其余四项行为场景仍待在后续有实际授权的任务中验收。没有创建新聊天或后台验收任务，不承诺自动跟进。

| 场景         | 操作与预期                                                                                                             | 本轮状态                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 实际加载目录 | 只读列出已加载的工作流来源与技能目录，确认没有 `superpowers:*`，并能定位 `AGENTS.md`、`workflow.md`、`skill-policy.md` | 通过（仅本次清单检查；卸载后） |
| 明确小改动   | 给定一个明确且局部的任务，预期按轻量实施路径推进，不重复需求访谈或生成另一套计划                                       | 待验收                         |
| 模糊新功能   | 提供一个未确定边界的新想法，预期进入 `grill-with-docs`，每次一张问题卡片并等待回答                                     | 待验收                         |
| 已批准实施票 | 引用已确认的规格和工单，预期沿用决定、核对阻塞与分支，再按既定测试入口实施和双轴审查                                   | 待验收                         |
| 专业技能介入 | 在现有阶段需要 Vue 或浏览器方法时，预期只补充对应方法，保持需求、阶段与授权边界                                        | 待验收                         |

行为场景只在有实际授权的任务中验收；本次记录更新不计作“明确小改动”等行为场景通过，也不要为测试路由而改产品、创建工单或发送外部消息。后续由承担相应已授权任务的智能体核对场景并记录实际证据，未执行前保持待验收。新聊天可使用以下只读提示复查加载目录：

> 只检查 FlowDuet 的工作流隔离，不修改文件、不调用开发实施技能。报告当前实际技能目录是否包含 Superpowers，并列出本项目工作流与技能允许范围的来源；区分目录事实和配置文件声明。

若仍出现 Superpowers，先核对项目受信任状态、实际工作目录、客户端版本和配置来源，记录结果；保持用户级设置原样，将需要全局调整的备选方案交给用户决定。配置和技能升级后重做上述检查，不能沿用历史“通过”。
