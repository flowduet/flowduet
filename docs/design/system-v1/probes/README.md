# 阶段零技术探针验收

更新：2026-10-15。当前C组文档基线为重新fetch的`develop@10b2a136c7a2d75065b2f6155a19a9dc5aa646da`（PR #93 squash）；已合入A/B薄切片与补修，源head为`f3a2bbb`。历史探针和修复记录保留各自基线。

**阶段零出口仍未通过。四项P2及独立复核补充问题已闭环，B02候选功能合同通过且本地默认`pnpm test`已657/657通过，B05锁定入口通过；B01/B03/B04仍阻断。** 两项FormManager默认5秒用例已按单文件方案补修并多轮验证；PR #93及合入后Node22/24 CI均已通过。不进入正式工作台，不冻结公共接口或发布。

本轮详见[默认时限补修验证](formmanager-default-2026-10-15.md)、[四项P2补修验收](p2-followup-2026-10-15.md)、[编辑合同验收](contract-acceptance.md)、[批准规格](../../2026-10-15-stage-zero-editing-contract.md)及[执行计划](../../plans/2026-10-15-stage-zero-contract-slices.md)。

## C组实验交付

维护者已批准[内部状态保真方案](../../2026-10-15-stage-zero-form-state-proposal.md)及[逐片计划](../../plans/2026-10-15-stage-zero-form-state-slices.md)。本轮按C0–C5执行，具体范围、原生失败、K/R回退和未验证项见[验收结论](editor-state-acceptance.md)、[状态矩阵](editor-state-matrix.md)及[便携证据](evidence/form-state-2026-10-15/README.md)。B03仍阻断：文字清空、数值/日期中间输入导航、Escape取消存在失败；OS输入法/native pointercancel和ERR05未验证。D/E与正式工作台未推进，未推送。

本轮C最终本地默认 **748/748**（正式513/探针235）、build/lint/严格probe类型通过；一次独立复核P2已由作者补齐证据。历史默认全量超时仍归档，未宣称根因修复；远端Node22/24未运行。B03继续阻断。

## B03后续修复材料（待审阅）

已整理[B03最小生产修复提案](../../2026-10-16-b03-minimal-production-fixes-proposal.md)及[薄切片计划](../../plans/2026-10-16-b03-minimal-production-fixes.md)，顺序为数值/日期中间输入、文字空串、拖拽取消。建议显式retained模式且保留legacy默认，R不采用；取消须先证明公开非重建通道，否则停片另审。APP-T默认超时独立列项。复审P2已在提案§4.4及M01–M08补充retained FormManager状态转发、关闭授权和Escape优先级，legacy默认不变；薄切片计划同步列入真实Dialog关闭/重开回归。本次仅文档，未改产品/探针代码，B03结论不变，未推进D/E或推送。

## 当前结论

| 项目 | 结果 | 限度 |
| --- | --- | --- |
| 前置结构保真 | 已解除阻断 | PR #92及本轮正式回归；存续fa、条件/default、顺序及DI合同保持 |
| B02 公开编辑/定位及冲突恢复 | 候选功能合同通过（本地默认全量） | A01–A15覆盖身份/租约、加载基线、依赖引用、隔离候选、原子属性提交及实际选择；控制器仍是probe，不是已发布API |
| B05 严格模板类型 | 阶段零当前锁定入口通过 | 精确局部绑定保留真实EP；不承诺所有peer版本，不改依赖 |
| B01 主题/弹层/空间与键盘 | 阻断未解除 | 本轮未重跑完整浅深/密度/双实例主题矩阵；真实EP选择工作不代表FormCreate完整主题隔离 |
| B03 第三方未序列化状态与天然异常 | 证据扩大，阻断未解除 | 真实两表单、最新输入失败保留及同ID替换已验证；注入异常和组件CompositionEvent不代表全部字段内部状态/OS输入法/天然故障 |
| B04 资源预算/最小容器 | 阻断未解除 | 未新增冷启动/多轮资源与完整容器任务走查，不能据固定320px实验面板或1440px截图承诺下限 |

## 本轮验证

- A/B当前证据：本地原样`pnpm test`及[合入后develop CI](https://github.com/flowduet/flowduet/actions/runs/38700763107)的Node22/24矩阵各**657/657通过**，core148、designer184、form-create137、Playground188。包含正式测试与探针，正式513项、探针144项分别计数。
- A/B本地与上述双矩阵的`pnpm build`、`pnpm lint`通过；CI另验core原生ESM导入，构建保留既有chunk告警。
- A/B本地严格probe（常规CI不包含该入口）：`pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json`退出0，包含正负类型用例；不是靠常规build间接认定。
- A/B原生浏览器补验四项P2及真实EP；旧矩阵未全量重跑，历史证据保留。旧轮次验证非法缓冲切换、等价应用/保存竞态、冲突恢复、真实FormDesigner保留、结构操作后定位、唯一默认配置和真实EP选择。逐项证据及边界见验收记录。
- 本地Node24；当前全量无超时覆盖参数，目标两项及整文件保留默认5秒，Playground既有真实FormCreate回归单例60秒未改；未改全局测试配置；远端Node22/24只证明上述CI范围，未重跑真实业务存储、路由卸载、下载文件或新引擎部署。C新增实验与回归见单独验收记录；不将历史A/B结果计作C通过。

## 剩余工作的责任与门槛

A/B累计复审发现项已闭环，PR #93完成合并前最终核对并按维护者授权合入develop；最近FormManager独立复审仅覆盖两提交，审阅范围与历史证据保持分列。C组方案和执行方式已获批准，C0–C5实验结果单独归档，新增生产修复仍须先提案确认。

B03需补支持字段的内部状态、焦点/拖拽/恢复与天然失败。B01主题/弹层/对比度/键盘及B04冷启动、GC、多轮资源和容器预算保持阻断，D/E仍须独立补充方案及授权。不因C采用保持挂载参照或拒绝不安全重建就宣称资源预算通过。

两项默认时限超时及其复跑保留历史；当前PR和合入后CI已各按真实head核对，不能由其替代C组矩阵。本轮完成C探针交付；下一步由代理据C的负证据整理最小生产修复提案供维护者确认，不自动进入D/E、正式工作台或推送。

## 历史依据与复现

- [2026-10-14原始结果](2026-10-14-original-results.md)：七项结构失败的历史阶段，不能替代已修复后的结果。
- [结构修复后的上轮复验](recheck-2026-10-15.md)：截至`c58cd0c`的548项、13处类型错误及五类阻断是历史基线，不是本轮现状。
- [独立复核记录](independent-review.md)：区分不同审阅范围；明确初审范围、三个问题处置及补修由执行方复验的界限。
- [原主题/容器证据](theme-and-container.md)、[编辑器保留](editor-retention.md)、[身份](identity-and-validation.md)、[宿主与定位](host-and-location.md)保留各自范围。

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1
```

打开返回端口的`/probes/stage-zero/index.html`，选择“表单状态 C”（历史A/B仍选“编辑合同 A/B”）。只用虚构夹具；实验切换会销毁可丢弃会话。完整成果以原始记录与manifest为准，不将实验页作为正式工作台交付。
