---
"@flowduet/core": patch
---

修复 flowable 方言命名空间:引擎读 flowable: 属性用 http://flowable.org/bpmn(6.8 引擎常量),此前官方文档风格的 http://flowable.org/bpm 会让 assignee 等扩展属性被引擎静默忽略(部署注册照常通过,缺陷隐蔽)。部署冒烟同步升级:启动实例并断言 assignee 真实生效。
