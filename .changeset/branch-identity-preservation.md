---
"@flowduet/core": patch
"@flowduet/designer": patch
---

修复审批单↔多转换及删除支路首节点/嵌套块时的支路身份、条件/default 与顺序丢失。转换保留原节点、连线和 DI；删除重接保留入边并废弃旧折线，BPMN 预览使用整图自动布局。新增 `BpmnModel.retargetSequenceFlow`，同步清理失效 DI，编译失败恢复原图容器。

链节点和块删除不再新建 relay 连线；插入审批/抄送的新连线 ID 使用空闲序号。集成方应读取模型返回的真实连线 ID，不依赖 `flow_relay_*` 或节点 ID 派生的命名。多→单转换拒绝会被丢弃的自定义循环配置；默认 Identity 编译及普通配置/部署守卫保持严格。
