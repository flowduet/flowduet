# 阶段零技术探针验收

更新：2026-10-15。产品基线为最新fetch核对的`develop@02d3474044e38e4a15d18a586e503802abe135be`；本轮实现`3a9bfa5`，分支`refactor/stage-zero-editing-contract`。

**阶段零出口仍未通过。A/B实现、回归与原生证据已就绪，最终结论待本轮独立复核；主题、全部编辑器内部状态、资源/容器三类阻断仍在。不进入正式工作台，不冻结公共接口或发布。**

本轮详见[编辑合同验收](contract-acceptance.md)、[批准规格](../../2026-10-15-stage-zero-editing-contract.md)及[执行计划](../../plans/2026-10-15-stage-zero-contract-slices.md)。

## 当前结论

| 项目 | 结果 | 限度 |
| --- | --- | --- |
| 前置结构保真 | 已解除阻断 | PR #92及本轮正式回归；存续fa、条件/default、顺序及DI合同保持 |
| B02 公开编辑/定位及冲突恢复 | 候选合同证据就绪，待独立复核 | A01–A15覆盖身份/租约、加载基线、依赖引用、隔离候选、原子属性提交及实际选择；控制器仍是probe，不是已发布API |
| B05 严格模板类型 | 当前锁定入口零错误，待复核汇总 | 精确局部绑定保留真实EP；不承诺所有peer版本，不改依赖 |
| B01 主题/弹层/空间与键盘 | 阻断未解除 | 本轮未重跑完整浅深/密度/双实例主题矩阵；真实EP选择工作不代表FormCreate完整主题隔离 |
| B03 第三方未序列化状态与天然异常 | 证据扩大，阻断未解除 | 真实两表单、最新输入失败保留及同ID替换已验证；注入异常和组件CompositionEvent不代表全部字段内部状态/OS输入法/天然故障 |
| B04 资源预算/最小容器 | 阻断未解除 | 未新增冷启动/多轮资源与完整容器任务走查，不能据固定320px实验面板或1440px截图承诺下限 |

## 本轮验证

- 全包`pnpm -r test --testTimeout 20000`：**634/634通过**，core148、designer184、form-create137、Playground165。包含正式测试与探针，不把634项全算生产能力验收。
- `pnpm build`、`pnpm lint`通过；构建保留既有chunk告警。
- 严格probe：`pnpm --filter @flowduet/form-create exec vue-tsc --noEmit -p ../../apps/playground/probes/stage-zero/tsconfig.json`退出0，包含正负类型用例；不是靠常规build间接认定。
- 原生浏览器验证非法缓冲切换、等价应用/保存竞态、冲突恢复、真实FormDesigner保留、结构操作后定位、唯一默认配置和真实EP选择。逐项证据及边界见验收记录。
- 本地Node24、20秒单例时限；未改生产默认配置，未跑本分支Node22/24远端CI、真实业务存储、路由卸载、下载文件或新引擎部署。

## 剩余工作的责任与门槛

A/B经独立复核后，仍需由agent先提出C/D补充方案与E测量协议，维护者审阅后实施。B03要补全部支持字段的内部编辑/恢复与天然失败；B01要证明真实可达弹层、主题作用域、对比度与键盘；B04要完成相同夹具冷启动/GC/多轮测量和容器任务，审阅预算与下限。

不自动削减双主题、两档密度、宿主定制或隔离范围，不自动转入正式工作台，也不推送。你现在无需为本轮收尾操作。

## 历史依据与复现

- [2026-10-14原始结果](2026-10-14-original-results.md)：七项结构失败的历史阶段，不能替代已修复后的结果。
- [结构修复后的上轮复验](recheck-2026-10-15.md)：截至`c58cd0c`的548项、13处类型错误及五类阻断是历史基线，不是本轮现状。
- [独立复核记录](independent-review.md)：区分不同审阅范围；上一轮无问题不等于本轮已审阅。
- [原主题/容器证据](theme-and-container.md)、[编辑器保留](editor-retention.md)、[身份](identity-and-validation.md)、[宿主与定位](host-and-location.md)保留各自范围。

```sh
pnpm --filter @flowduet/playground exec vite --config probes/stage-zero/vite.config.ts --host 127.0.0.1
```

打开返回端口的`/probes/stage-zero/index.html`，选择“编辑合同 A/B”。只用虚构夹具；实验切换会销毁可丢弃会话。完整成果以原始记录与manifest为准，不将实验页作为正式工作台交付。
