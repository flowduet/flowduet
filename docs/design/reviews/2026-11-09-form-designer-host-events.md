# FormDesigner 宿主处理器限定修复与验证

日期：2026-11-09。关联 [#118](https://github.com/flowduet/flowduet/issues/118)，承接 [#117 范围报告](https://github.com/flowduet/flowduet/issues/117#issuecomment-6736018847)。基线 `develop@74c02b46e7b8a13bb40354105f63145c386e051e`，分支 `fix/118-form-designer-host-handlers`。

用户在报告后明确选择“先限定修复，再准备版本”。本批只修复 FormDesigner 的两个宿主处理器覆盖；三包版本准备仍需包含修复的最新 develop，不将这次批准扩为推送、PR、合并、发布或引擎部署授权。

## 行为与实现边界

FormCreate designer 3.5.0 的 `created` 直接赋值 `window.onbeforeunload` 和 `document.body.ondrop`，`unmounted` 只清理 keydown/paste。历史 P2 三包消费失败保持原事实，见[原报告](../2026-10-25-stage-zero-p2-integration-result.md)。

本次在 FormDesigner 包装层保存宿主原引用，在真实 FcDesigner 的 VNode before-mount 接缝取回供应商已安装的两个回调并立即恢复宿主；此时子组件尚未渲染其内部子树。供应商 created/mounted/unmounted 均继续原样运行，不复制、删除或替换第三方生命周期，不修改依赖及公开 API。

- 离页回调通过当前实例独立的 beforeunload 监听执行，保留供应商自己的脏状态/exitConfirm 判断，卸载只移除本实例监听。
- drop 回调只从当前 FormDesigner 根接收，保留编辑器内默认 drop 阻断，宿主其他区域不再被供应商全局阻断。
- 卸载不再写回挂载前快照；宿主挂载后自行更换处理器，不会在卸载时被还原为旧值。每个实例/独立 Vue app 持有自己的监听和清理闭包。

修复覆盖 legacy 与 retained；不改变输入、保存、捕获或文档/BPMN 合同，不处理供应商其他全局行为。新增 `.changeset/form-designer-host-events.md` 为 form-create patch，随后三包版本准备应连同原九份 Changesets 一并纳入，不能只消费旧九份。

## 测试入口与红绿证据

用户批准的入口为公开 FormDesigner、真实 FcDesigner 和宿主 DOM 处理器/事件；测试不 mock 第三方、不直接改供应商私有脏状态。复用既有组件测试 fixture 的所有权与样式隔离，保留默认时限。

- [首次红色](evidence/2026-11-09-form-designer-host-events/tdd-red.txt)：legacy 挂载后，宿主 onbeforeunload 被匿名供应商函数替换，1/1 失败；最小修复后的[绿色结果](evidence/2026-11-09-form-designer-host-events/tdd-green.txt)为 1/1。
- 扩展至 6 项真实组件协议回归，最终[定向结果](evidence/2026-11-09-form-designer-host-events/host-events-second.txt)为 6/6：两种模式挂载/卸载、drop 作用范围、同 app 双实例及宿主后续改写、独立 app/空处理器、脏数据离页回调和清理。
- 首次扩展运行[5 通过/1 失败](evidence/2026-11-09-form-designer-host-events/host-events.txt)是离页测试只新增一次字段，未使供应商进入预期脏状态；调整为两次真实菜单新增后通过。没有直接设置私有状态、替换提供者或增加测试超时，不把这条测试准备失败写成产品回归。
- 当前固定源码与测试的 SHA-256 见[来源清单](evidence/2026-11-09-form-designer-host-events/source-manifest.json)。

Happy DOM 离页检查只观察供应商写入事件 returnValue 以及宿主回调是否调用；不证明真实浏览器关闭提示 UI。初次红色命令实际退出 1，日志末尾的 pnpm 错误保留；外层展示日志的 shell 退出码不作为测试退出码。

## 真实三包 tarball 与 Chromium

先小规模 HEAD 确认 npmmirror 连通，再运行 `node scripts/verify-appearance-consumer.mjs`。它实际构建、打包、空工程安装、严格公开类型检查、生产构建及依赖副本检查。完整[准备输出](evidence/2026-11-09-form-designer-host-events/consumer-preparation.txt)和[静态报告](evidence/2026-11-09-form-designer-host-events/static-verification.json)保留；静态报告的 browserRender 待验证状态属于当时脚本输出，后续浏览器结果另列，不改写原物。

本轮包版本仍为 core 0.3.0、designer 0.1.0、form-create 0.1.0，仅用于验收当前补丁，未运行 changesets version。三个 tarball SHA-256、路径和依赖树见静态报告及 [npm ls](evidence/2026-11-09-form-designer-host-events/npm-ls.txt)。实际使用 Vue 3.5.43、单份 EP 2.14.6、FormCreate renderer 3.3.4、designer 3.5.0；没有源码 alias。

在该空消费者增加本次临时公开 FormDesigner 宿主页，不新增长期演示应用或产品 API。消费页源码、HTML、Vite 配置和浏览器驱动均按原字节以 `.txt` 归档；[宿主页生产构建](evidence/2026-11-09-form-designer-host-events/host-consumer-build.txt)退出 0。驱动中的绝对工具/浏览器路径是当时本机入口，复现时需调整路径，不能假称随仓库可直接运行。

Chromium 156.0.8078.4、1440×1200。实际脚本 `node <verify-host-browser.mjs> <新输出目录>` 退出 0，[结果](evidence/2026-11-09-form-designer-host-events/result.json)有 10 个步骤记录，`errors=[]`、`failures=[]`：

1. legacy 挂载后宿主两处理器引用保持；外部 drop 仍到达宿主且未被取消，编辑器内 drop 被取消并停止外传。
2. legacy 与 retained 均经真实保存按钮保存，输入定义中的 `value: "保留值"` 保持。
3. 两次真实菜单新增使供应商进入脏状态；合成离页事件仍获得供应商消息，每次宿主处理器执行一次。
4. 同 app 两实例均在场时卸载第一实例，第二实例仍有离页保护；宿主改写处理器后挂载独立 app，引用仍保持。
5. 卸载同 app 的第二实例后，独立 app 的离页及 drop 保护仍在；最终全部卸载，离页监听无残留，宿主新的 drop 回调正常执行。

[独立 app 截图](evidence/2026-11-09-form-designer-host-events/independent-app.png)与[最终截图](evidence/2026-11-09-form-designer-host-events/final.png)已目检。beforeunload 使用合成 DOM 事件并单独记录 returnValue；没有触发真实页面关闭提示，也不据此证明所有浏览器行为。截图/协议核对不能替代原生 OS IME。

## 工程门槛、审查与停点

本地 Node 24.18.0 / pnpm 10.26.1，生产补丁冻结后：

| 命令                                                                               | 结果与证据                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p tsconfig.build.json` | 退出 0；正式源码检查，无生产代码后续修改                                                                                                                                                                                                                                                 |
| `pnpm test`                                                                        | 一次原样默认根命令退出 0，67 文件／1031 用例通过：core 148、designer 202、form-create 374、Playground 307；[原始日志](evidence/2026-11-09-form-designer-host-events/pnpm-test.txt)                                                                                                       |
| `pnpm build`                                                                       | 由 `verify-appearance-consumer.mjs` 首步实际执行，三包/Playground 构建和正式声明检查通过；[完整输出](evidence/2026-11-09-form-designer-host-events/consumer-preparation.txt)，保留既有大 chunk 告警                                                                                      |
| `pnpm lint`                                                                        | 退出 0；[日志](evidence/2026-11-09-form-designer-host-events/pnpm-lint.txt)。首次仅 4 份新增 JSON 原物的格式检查失败，[原记录](evidence/2026-11-09-form-designer-host-events/lint-first.txt)保留；按现有证据归档惯例只对本次原物目录新增 Prettier 排除，不放宽产品源码检查或重写证据字节 |
| `pnpm changeset status --output <临时路径>`                                        | 退出 0；[状态](evidence/2026-11-09-form-designer-host-events/changeset-status.json)共 10 份 Changesets。当前 core 仍为旧计划 0.3.1，推荐 0.4.0 的调整留版本准备；没有提前修改原 Changesets/配置或运行版本化                                                                              |
| `git diff --check`                                                                 | 通过                                                                                                                                                                                                                                                                                     |

第 1 轮独立审查固定完整 29 文件补丁 SHA-256 `d173210c3f64a4f61c9e7c8d543762b1071f12d3855e575f4c50e34bd3619442`，[快照](evidence/2026-11-09-form-designer-host-events/review-v1.patch.gz)、[逐文件清单](evidence/2026-11-09-form-designer-host-events/review-v1-manifest.json)与[结论](evidence/2026-11-09-form-designer-host-events/review-results.json)可复核。

- Standards：重要 0／细节 0／既有 0；无硬规范违反或值得追加改动的代码 smell。
- Spec：重要 0／细节 0／既有 0；#118 行为、验证、来源与范围符合。
- 宿主事件生命周期专项：重要 0／细节 0／既有新增报告 0；Vue 时序、回调 this/returnValue、实例清理与宿主改写未发现确定反例。

临时索引已从固定基线成功应用完整快照，重建 tree `a3158ff25cb338b527d459d47a208f57e22404be`；6 条提示均为归档日志的末尾空白/结束空行，原字节保留，不影响补丁应用。真实暂存区未用于此次重建。

三位审查者均使用新上下文、只读核对相同快照和 29 个文件哈希；没有将日志核读冒称独立重跑。审查后只追加本节结果、快照/清单与停点元数据，生产和测试代码保持受审字节。

本轮修复与本地验证完成，工作仍在独立 fix 分支。下一步为用户逐项授权推送/PR，Node 22/24 CI 全绿并由维护者合入 #118 后，再从包含修复的最新 develop 开始 core 0.4.0、designer/form-create 0.2.0 的版本准备；不能把本分支包消费结果写成未来版本化产物验收。

本轮不执行 Node 22 远端 CI、其他浏览器/OS、EP 多副本、完整可访问性、自然关闭提示或 Flowable 部署；不重开冻结供应商实验。回退可撤销本修复提交，无数据迁移；回退后会重新出现既有宿主处理器覆盖风险，回退未实测。
