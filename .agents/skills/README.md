# 共享 Agent 技能正本目录

本目录遵循 agentskills.io 开放标准的项目级技能布局，Codex、GitHub Copilot、Antigravity 原生读取；`.zcode/skills`、`.qoder/skills`、`.minimax/skills` 通过相对符号链接指向本目录，供 ZCode、Qoder、MiniMax Code 复用同一份内容。

## 来源

- 上游仓库：<https://github.com/vuejs-ai/skills>（Vue 3 技能集）
- 锁定 commit：`198f0cd8f7f9c0a3d9b566ccc16de6677519ee78`
- 许可：MIT，见 [vuejs-ai-skills-LICENSE](./vuejs-ai-skills-LICENSE)

## 内容

`skills/` 下的 8 个技能原样拷贝：vue-best-practices、vue-options-api-best-practices、vue-router-best-practices、vue-pinia-best-practices、vue-testing-best-practices、vue-jsx-best-practices、vue-debug-guides、create-adaptable-composable。

## 更新方式

重新下载对应 commit 的上游 tarball（`gh api repos/vuejs-ai/skills/tarball/<commit> > /tmp/vuejs-ai-skills.tgz`），覆盖本目录后再校对各 SKILL.md 差异，并同步更新本文的锁定 commit。
