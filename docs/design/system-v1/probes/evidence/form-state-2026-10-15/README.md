# C组便携证据（执行2026-10-15—16）

当前结论以[验收报告](../../editor-state-acceptance.md)、[coverage.json](coverage.json)、[manifest.json](manifest.json)和最终命令日志为准。这里的“便携”指仓库内相对链接、锁定源码/依赖和可重放脚本，不要求复用本机浏览器会话。

- `final/`：明确1440×1000、DPR1、Chrome155的最终重放。每个JSON行可定位对应同名原始CLI日志。
- `coverage.json`：规范化caseId、原始文件/行索引、来源、通过/失败/安全回退/未知分列。326条记录含组件事件协议，不能称326项原生用例；208通过、19失败、96回退、3未知也不能合成一个整体PASS。
- `runtime-identity.json`：运行时源码pin及逐文件SHA256；之后只增加/归并测试与局部测试支持，未改浏览器运行时。
- `verification.json`和`verification/`：原样命令、head、退出码、计数、原始日志。
- `history/`：初始657基线、RED、超时、脚本错定位、旧观察器、未锁定viewport等历史。负证据不覆盖为绿，不能据旧head重放推广到当前。
- `scripts/*.browser.js.txt`：可重放整理版Playwright动作源码（实际执行源码同时保存在每个原始CLI日志的Ran Playwright code部分），保留为原始文本，避免根lint将其当产品源码重写；没有FormCreate实例私有写入。`replay.py`根据自身目录定位脚本，输出新的`replay-output/`，不覆盖本归档。

R的`kept-fallback`只说明按K导航成功，不是R恢复成功；值断言通过也不是R通过。早期R装载脚本继承K的caseId/status标签，规范目录已按实际请求/结果分列，旧原始文件保留历史。整理版脚本显式标requestedStrategy、valueAssertions与actualStrategy；规范目录为既有原始结果补正确分类，未修改旧原始字节。不得以原始`passed`字符串绕过actualStrategy把回退计为重建。

原生动作通过Playwright指针/键盘/真实控件执行。CompositionEvent和人工适配器故障逐行注明，不能当OS输入法或ERR05天然失败。OS/native pointercancel缺真实工具证据，保持未知。正常保存只接内存宿主计数；未验证真实存储、原生下载、部署或远端CI。

## 重放

在本文manifest指定源码或逐文件内容相同的检出安装锁定依赖，启动：

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1
```

用本机可用的Playwright CLI新建专用`flowduet-c`浏览器会话（Chrome，非个人会话）。然后执行：

```sh
FLOWDUET_PLAYWRIGHT_CLI=/absolute/path/to/playwright_cli.sh python3 docs/design/system-v1/probes/evidence/form-state-2026-10-15/scripts/replay.py
```

脚本使用`http://127.0.0.1:5173/probes/stage-zero/index.html`，入口会固定视口。若Vite实际分配其他端口，先修改重放副本中的端口并记录；不将错误页或未执行批次判通过。重放会重置仅用于实验的虚构会话。不要使用脚本操作真实业务数据。

对应单元/协议入口（全部断言保留，`.cases.ts`从入口导入，以减少重复worker装载）：

```sh
pnpm --filter @flowduet/playground exec vitest run probes/stage-zero/contracts/candidate.test.ts probes/stage-zero/contracts/validation.test.ts probes/stage-zero/contracts/error-boundary.test.ts
pnpm test
pnpm build
pnpm lint
pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json
```

manifest不哈希自身，避免自引用；文件哈希固定实际字节，不格式化原始结果。执行账本中的临时路径只用于历史定位，正式材料均在本目录。Git提交后另核对blob哈希与本地文件一致，不能只凭磁盘存在宣告已归档。
