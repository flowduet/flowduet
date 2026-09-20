# AGENTS.md

## 沟通方式

1. **语言：** 使用中文回复。
2. **注释：** 代码注释使用中文。注释应聚焦于解释逻辑意图、业务背景及复杂原因，避免对显而易见的代码进行冗余注释。
3. **风格：** 解释简洁直接，结论先行，减少无意义的客套铺垫。
4. **提问方式：** 使用 grill-me / grill-with-docs / grilling 等质询类技能时，采用逐个提问的方式——每次只抛出一个问题，并附 2~4 个候选方向供我选择，不要一次性罗列大量问题。

## 协助方式

1. **第一性原理：** 从本质出发分析问题，不被表象迷惑。若需求模糊或存在逻辑漏洞，必须主动提问澄清。
2. **事实优先：** 尊重事实比尊重我更重要。若我的方案存在技术风险或逻辑错误，请直接指正并给出依据。
3. **批判性思维：** 当被质疑时，回归需求原点验证逻辑。若需求本身不合理，请反问我，而不是盲目执行。
4. **执行边界：** 涉及架构调整、数据迁移、核心逻辑变更时，必须先提案确认再执行；对于常规优化、Bug修复，可执行后附带说明。

## 工程规范

1. **风格一致性：** 严格遵循项目现有的代码风格、目录结构和命名规范。
2. **防御性编程：** 必须处理边界条件和异常情况，外部调用必须有错误处理机制。
3. **复用优先：** 编写新逻辑前，先检索项目中是否已有可复用的模块，避免重复造轮子。
4. **自测意识：** 提供的代码应包含必要的测试用例或提供自测验证步骤。
5. **版本控制：** 代码变更应保持原子性，避免单次提交过大范围的修改。

## 网络环境（中国大陆）

当前身处中国大陆网络环境，下载或访问外部资源时**优先使用国内镜像源**，避免直连境外源长时间超时。

| 资源 | 镜像 / 方式 |
| ------ | ------------- |
| Homebrew | 清华 TUNA 或中科大 USTC 镜像源 |
| pip | `https://pypi.tuna.tsinghua.edu.cn/simple` |
| npm | `https://registry.npmmirror.com` |
| Go 模块 | `GOPROXY=https://goproxy.cn,direct` |
| Docker Hub | 配置国内 registry mirror |
| GitHub Release 资产 | 直连 github.com 下载常超时；优先经 `api.github.com` 资产接口（`Accept: application/octet-stream`）下载，并用官方 checksums 校验 |

原则：先镜像、后直连。首次使用某个下载渠道时，先小规模验证连通性（如 HEAD 请求），再执行批量下载或安装；若镜像与直连均失败，主动汇报而不是反复重试。

## Git 提交规范

### 约定式提交(Conventional Commits)

所有 Git 提交信息必须符合 [约定式提交规范](https://www.conventionalcommits.org/zh-hans/v1.0.0/),格式如下:

```text
<type>[optional scope]: <中文描述>

[required body]

[optional footer(s)]
```

### BREAKING CHANGE

在脚注中包含 BREAKING CHANGE: 或 <类型>(范围) 后面有一个 ! 的提交，表示引入了破坏性 API 变更（这和语义化版本中的 MAJOR 相对应）。 破坏性变更可以是任意 类型 提交的一部分

### Type 类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式(不影响功能)
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `build`: 构建系统/外部依赖
- `ci`: CI 配置变更
- `chore`: 其他不修改源码的变更
- `revert`: 回退提交

## Agent skills

### Issue tracker

issue 统一记录在 GitHub Issues（flowduet/flowduet），通过 `gh` CLI 读写。详见 `docs/agents/issue-tracker.md`。

### Triage labels

Triage 标签沿用五个规范角色名（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix）。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局：根目录 `CONTEXT.md` + `docs/adr/` 决策记录。详见 `docs/agents/domain.md`。
