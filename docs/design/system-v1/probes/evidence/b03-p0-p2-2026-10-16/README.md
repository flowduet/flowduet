# B03 P0 两项 P2 补修证据

结论见[验收报告](../../b03-p0-p2-followup.md)。基线 a857675；旧 P0 的整体通过结论已被本次全面复审反例收紧，本目录保存补修及重验，不覆盖旧归档。

- `red/`：本轮亲跑的两项失败、实际源脚本与上一轮复审原始日志。跨实例关闭失败为原生 Enter + busy/挂载协议；弹层负例为受控阻止打开后旧 oracle 仍判通过。不是自然失败或 ERR05。
- `final/` / `coverage.json`：本轮源码的完整 14 批重放，逐条对应 CLI 与 JSON，162 行分为 148 通过/12 生产负例/2 未验证；不同来源明确分类。新增的故障拒绝通过只能证明新 oracle 拒绝不完整证据。
- `history/`：pilot、提取时 openDialog 命名错误、ElSelect 外/内重复 class 的定位错误及早期协议/类型日志。保留原字节，不纳入最终通过目录。
- `verification.json` / `verification/`：原样命令与实际退出码。新 6 项协议回归并入既有 candidate 入口，没有修改默认 5 秒或全局 worker。
- `independent-review.md`：一次fresh-context复核、亲跑/核读区分及主审裁定；旧标记单项不推广为完整关闭生命周期。
- `runtime-sources.json` / `manifest.json`：冻结源码 SHA256 与归档文件校验；源码提交后再核对 Git blob。原始 `.log` 显式入库，不为通用空白规则格式化日志。
- `scripts/replay.py`：可重复执行的浏览器回归。`dialog-actions.js.txt` 是正常用例与故障 oracle 的同一个断言入口；失败阶段被明确区分，不能吞任意异常冒充回归有效。

## 重放

安装锁定依赖，在 manifest 对应检出启动：

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1 --port 5182 --strictPort
/absolute/path/to/playwright_cli.sh -s=flowduet-p0-p2 open http://127.0.0.1:5182/probes/stage-zero/index.html --headed
FLOWDUET_PLAYWRIGHT_CLI=/absolute/path/to/playwright_cli.sh python3 docs/design/system-v1/probes/evidence/b03-p0-p2-2026-10-16/scripts/replay.py --output /tmp/flowduet-p0-p2-new-run
```

输出目录必须不存在。端口变化显式传 `--url`。仅使用虚构夹具，完成后关闭自己的浏览器/服务。

`red-*.browser.js.txt` 固定对应旧 a857675 行为，不在新源码的正常重放队列中；不要用新源码重复旧 oracle 来冒称原反例不存在。旧 P0 manifest 的文档/源码哈希应对照旧 Git 对象，而非当前更版文档。

本轮不验证真实存储、部署、原生下载、OS 输入法、native pointercancel、ERR05 或 P1/M01–M08。保留 FormCreate source-map/ElSwitch 等会话告警，不声称控制台零告警。
