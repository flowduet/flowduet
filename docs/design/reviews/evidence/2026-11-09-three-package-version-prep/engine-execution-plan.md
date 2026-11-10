# #120 本地 Flowable 6.8 验证执行计划

版本候选：core 0.4.0、designer/form-create 0.2.0；基线 develop@a17af75406571478c0ffc86d88033c048590ef95。候选产品只变更版本/CORE_VERSION；实际 tarball 与公开入口、类型、浏览器、结构 XML 已核对。日期布局单项风险由用户在 #120 明确接受，保留原反例。

## 本次申请的具体操作

1. 沿用本机 Docker Desktop 的 `desktop-linux` context 与现有国内 registry mirror 配置，拉取尚未缓存的 `flowable/flowable-ui:6.8.0`。镜像连通性小规模预检已成功，未修改 Docker 配置。仅一次 pull 命令，镜像准备最多 10 分钟，失败或超时即停止，不自行更换引擎版本或持续重试；下载体积/耗时目前未知。
2. 执行现有 `pnpm smoke`（本地临时容器、端口 18080），它不仅部署基准文件，也会在测试引擎启动基准流程、查询审批人，并完成或签测试任务等既有运行时断言；均为脚本内人工验收数据。脚本结束清理自身容器。
3. 另启动一个临时本地 Flowable 6.8 容器，绑定 `127.0.0.1:18081`，将下列候选 XML 部署并核对流程定义注册。共 12 份文件、10 种不同字节内容；只部署 10 份唯一内容，保留文件映射。该批候选 XML 不额外启动业务流程实例。完成或失败后清理该容器，保留镜像缓存。

本批最多两个临时引擎容器；不接触现有其他容器、生产引擎或真实用户数据。没有 npm 发布/tag/版本 PR 合并动作。任何镜像准备、引擎就绪或部署失败立即记录并停止，不改验收期望。HTTP 就绪等待沿用既有 180 秒，实际结果与来源/哈希一起归档。

## 已固定的候选 XML

表中源文件位于 /tmp/flowduet-release-prep.JE4FOq；原 manifest 为 `engine-xml-manifest.json`，内容在执行前重新校验哈希。

| 文件 | SHA-256 | 来源 |
| --- | --- | --- |
| approval-all-multi.bpmn | `868ae4938e31a00509048600502615595c3b0edbd6feb8fbe2aead7b26b1b8b6` | Playground 生产构建的真实操作与 XML 导出 |
| approval-all-reopened-single.bpmn | `cc4a73226ef59c528f58a097135d761e054202f762f487632acb0a029b5a2cea` | Playground 生产构建的真实操作与 XML 导出 |
| approval-any-multi.bpmn | `44d3be7a3e852faf7bd37387a7b18550ebd4e92d77315fe8d88be70296c54b95` | Playground 生产构建的真实操作与 XML 导出 |
| approval-any-reopened-single.bpmn | `cc4a73226ef59c528f58a097135d761e054202f762f487632acb0a029b5a2cea` | Playground 生产构建的真实操作与 XML 导出 |
| approval-sequential-multi.bpmn | `e78b944d0dbdca0bb6598ee0d965f8c2f2d731802cd0e9550e2188380c2092dc` | Playground 生产构建的真实操作与 XML 导出 |
| approval-sequential-reopened-single.bpmn | `cc4a73226ef59c528f58a097135d761e054202f762f487632acb0a029b5a2cea` | Playground 生产构建的真实操作与 XML 导出 |
| condition-deleted.bpmn | `957b6df16d19ebf926d9e616638c81d0344e311ad7a14d988831407b5b5999b8` | Playground 生产构建的真实操作与 XML 导出 |
| condition-retarget.bpmn | `e1ca7753c95a94636059534e93ee0b6ed6dde139996ba5c31d3ae1a9bcd772de` | 实际 tarball 公共 BpmnModel/retarget/exportXml 接口 |
| default-deleted.bpmn | `6ac977f2b6e31c3eb18ace4532f1efd380d5b620cab2c25dfeaa0ddbfa53556e` | Playground 生产构建的真实操作与 XML 导出 |
| default-retarget.bpmn | `c255aaccc57fd93cb166f1d13b0b6098661aa11184c50cd24d9354f576db353f` | 实际 tarball 公共 BpmnModel/retarget/exportXml 接口 |
| nested-condition-deleted.bpmn | `4344801fdbcb426e9ba60e196c53feb4c55ee5f4ddb366df2318da9bcb2502b9` | Playground 生产构建的真实操作与 XML 导出 |
| nested-default-deleted.bpmn | `c6aa54bdb78c1ae537a47d6457e2914269f23f1d27d86515ec71d966f01e4a77` | Playground 生产构建的真实操作与 XML 导出 |

候选覆盖三种多人审批、保存重开转单签、条件/default 支路首节点及内嵌块删除、支路 ID/顺序/条件、DI、流程默认表单与节点覆盖引用。部署成功只证明引擎接受/注册；不冒称这 12 个场景完成运行时业务验收。
