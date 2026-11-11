# B03 P0 公开接缝证据

本目录只对应默认值编辑/身份/事件时序及 Dialog 接线样稿，不是 P1 产品实现。入口结论见[报告](../../b03-repair-seams.md)。本地分支 `refactor/b03-default-editor-seams`，开工 `aaf7da6`；最新 develop 为 `10b2a13`，维护者已明确授权携带 C 依赖开工。

- `final/`：冻结样稿后的 11 批重放，102 条目录记录：88 通过、12 生产 legacy 负例、2 未验证。不是 102 项原生验收，也不是 retained 通过率。
- `coverage.json`：逐行对应 final JSON/CLI，显式模式、来源分类和结果。Dialog busy 由样稿协议开关注入，配真实指针/键盘，单独分类；CompositionEvent 不计 OS 输入法。程序化关闭与父级卸载是公开行为对照。
- `verification.json` / `verification/`：本轮命令、退出码和全量原日志；开工默认超时保留为基线。测试结果不替代真实浏览器行，最后一次通过不证明 APP-T 根因解决。
- `history/`：最初生产反例、未补充树顺序断言的样本、早选字段/占位层误定位/未等样稿 mounted 的错误，以及观察器误用 field 键/误认 ValueInput 为原生 number 的失败。都保留原字节，不计作当前通过或能力失败。`combined-session-console.log` 包含整次会话历史、favicon404、早期 triggerActive 异常、FormCreate source-map 与 ElSwitch 告警；不宣称浏览器控制台零告警。
- `scripts/*.browser.js.txt`：实际动作脚本，CLI 日志同时保存 Ran Playwright code；运行时不访问第三方 setupState、私有 Sortable 或内部规则句柄。测试驱动使用页面 DOM 选择器定位第三方控件；Dialog 保护逻辑仅使用公开 props/slots 及自有 class/data 标记。
- `independent-review.md`：一次独立核读结论、亲跑/核读分工及主审对五项暂不判断边界的裁定。
- `manifest.json`：逐文件 SHA256，排除自身；源文件字节与产品无差异核验另列。原始证据不经格式化器改写。

## 重放

安装仓库锁定依赖后，在本目录 manifest 指定源码或字节相同的检出启动专用探针：

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1 --port 5180 --strictPort
```

用已安装的 Playwright CLI 创建专用会话：

```sh
/absolute/path/to/playwright_cli.sh -s=flowduet-p0 open http://127.0.0.1:5180/probes/stage-zero/index.html --headed
FLOWDUET_PLAYWRIGHT_CLI=/absolute/path/to/playwright_cli.sh python3 docs/design/system-v1/probes/evidence/b03-p0-2026-10-16/scripts/replay.py --output /tmp/flowduet-p0-new-run
```

输出目录必须不存在，避免覆盖既有证据；端口不同须显式 `--url`。所有操作只重置虚构夹具。复跑生产反例失败是预期负证据，不能因 CLI 命令退出 0 判业务通过；须逐条看 `pass` 和实际模式。完成后关闭自己创建的会话/服务。

P0 样稿不实现 raw 缓存、同步 captureContent、确认放弃、旧实例 key/租约隔离或拖动取消。不用“能识别拖动”冒充 P3 取消通过，不用本目录改变 C 历史归档、B03 总验收或 D/E 状态。

归档时核对 Git 对象与磁盘 SHA256 一致。通用 `*.log` 忽略规则已通过仅针对本目录原始日志的显式入库处理。原始构建/CLI日志含既有尾空白/空行，原样保留；`git diff --check` 排除这些原始日志后的工程文件检查退出0，不为消除空白告警改写原始证据。
