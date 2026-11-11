# 一次性安装包消费模板

本目录只是 `scripts/verify-appearance-consumer.mjs` 的输入模板，不是 workspace 包或长期演示应用。执行脚本时才会复制到新的临时空目录，并安装当前工作区实际打出的三包 tarball。

长期可操作示例仍只有 `apps/playground`。这里的 `src/scenes` 由脚本从该宿主复制，确保源码宿主与安装包消费者复用同一组公开用法；Vite 配置没有源码 alias。

执行 `node scripts/verify-appearance-consumer.mjs` 后，保留输出的 `temporaryRoot`。静态检查包括三包实际安装、依赖副本、必验公开类型合同和双页面生产构建；此时浏览器合同仍未执行。`--skip-build` 只供已自行构建当前三包 dist 的调用方使用。

消费者的 `npm run typecheck` 会在同一次 tsc 检查中收集实际文件列表，核对 `src/main.ts`、`src/env.d.ts` 和 `src/release-contracts.ts`。缺文件、未纳入编译或类型错误均非零退出；原始输出与覆盖报告分别为 `typecheck-files.txt` 和 `type-verification.json`。合同示例中的 `CORE_VERSION` 字面量随下一次 core 版本准备一起维护。

公开运行合同复用版本准备复审的七项成功示例，入口为消费者的 `contracts.html`；`window.contractHarness` 仅是临时消费者的控制层，使用包根导出、公开 props/事件/方法及 DOM，不是产品 API。按脚本输出启动消费者生产预览，然后在仓库根目录执行：

```sh
FLOWDUET_CHROMIUM_PATH='/绝对路径/Chromium' node scripts/verify-consumer-contracts.mjs \
  /绝对路径/playwright-core/index.mjs \
  http://127.0.0.1:4174/ \
  /临时目录/verification.json \
  /输出目录/contracts
```

Playwright 与 Chromium 沿用现有外置驱动方式，不增加项目依赖。驱动核对三包 tarball、全部构建文件及预览服务返回字节；浏览器的每个实际网络响应也必须匹配清单哈希，才会交付给页面，未知资源或预检后的服务切换均被拒绝。回执的 `artifactId` 是本次 `verification.json` 原字节的 SHA-256，汇总时再次核对本地产物。`result.json` 保留实际运行结果及浏览器资源哈希，`coverage.json` 核对 `required-runtime.mjs` 中的必验清单。必验项与驱动一起维护；外观矩阵仍由 `scripts/verify-appearance-browser.mjs` 单独验收，不能代替这七项合同。

回执缺失、重复、未知项、缺结果、缺成功证据、浏览器错误或产物不匹配都会阻止完成。运行在首个失败处停止，后续项标记 `not-executed`。`passed` 仅表示全部通过；`complete` 可以包含逐项明确接受的失败风险，显示 `complete-with-accepted-risk`，不会改成全通过。

需要记录新批准的风险时，由维护者先明确接受具体反例，再提供 JSON 数组（每项含 `id`、`artifactId`、`reason`、`authorization`），用以下调用重新汇总。`artifactId` 必须匹配本次回执，避免沿用旧批次批准。工具不作批准判断；填写来源不等于取得授权。本次七项合同没有预设豁免，历史日期布局风险不能用来豁免任何一项。

```sh
node scripts/appearance-consumer/verify-runtime-coverage.mjs \
  /临时目录/verification.json /输出目录/contracts/result.json \
  /输出目录/contracts/coverage.json /绝对路径/accepted-risks.json
```

风险接受不能替代未执行项、其他失败或浏览器全局错误。旧页头和关闭确认使用受控迟到 DOM 事件；字段生命期验证默认菜单生成的新 ID，不声称覆盖同字段 ID 改名。原生 OS IME、完整外观矩阵和真实引擎部署不在七项合同内；本脚本也不自动发布。

`pnpm test` 包含验收 CLI 的反例测试，验证防漏行为；合成回执仅用于测试校验器，不能当作浏览器证据。断言质量仍需独立审查，文件列表与回执完整性不能证明合同设计充分。

预检后切换服务的回归需要真实 Chromium。提供上述两个外置驱动环境变量后运行；未配置时该项明确标为跳过，不冒称已验证，也不新增 CI 环境矩阵：

```sh
FLOWDUET_PLAYWRIGHT_DRIVER=/绝对路径/playwright-core/index.mjs \
FLOWDUET_CHROMIUM_PATH=/绝对路径/Chromium \
node --test scripts/appearance-consumer/coverage.test.mjs
```
