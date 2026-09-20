# @flowduet/core

## 0.1.2

### Patch Changes

- f38cbaa: 修复 flowable 方言命名空间:引擎读 flowable: 属性用 http://flowable.org/bpmn(6.8 引擎常量),此前官方文档风格的 http://flowable.org/bpm 会让 assignee 等扩展属性被引擎静默忽略(部署注册照常通过,缺陷隐蔽)。部署冒烟同步升级:启动实例并断言 assignee 真实生效。

## 0.1.1

### Patch Changes

- 修复发布产物的 ESM 兼容性：源码相对导入补全 `.js` 扩展名。此前 dist 在
  Node 原生 ESM 下无法导入（tsc 不改写导入路径，extensionless 仅在打包器
  解析下可用），由发布后的真实安装验证发现；CI 新增产物导入检查防回归。

## 0.1.0

### Minor Changes

- 49b692c: 适配器接口正式化（ADR-0005 三收敛点）：命名空间前缀、扩展属性 schema、任务类型映射。
  合同以 `assertAdapterContract` 随包发布（纯断言、不依赖测试框架），任何适配器实现可直接复用；
  `BpmnModel.addTask(kind)` 消费任务类型映射，邮件任务按 Flowable 习惯落成
  ServiceTask + flowable:type="mail"。
- 56cc000: 新增 ROADMAP Step 1 接缝的最小实现：模型树包装（BpmnModel）、编译器（compile）、
  恒等 DI 布局（IdentityDiLayout）与 Flowable 适配器（扩展属性描述符）。
  编译合同测试以手写基准文件锁定最小流程（开始 → 用户任务 → 排他网关 → 两分支 → 结束）
  的 Flowable 6.8 方言输出：命名空间声明、flowable:assignee、bpmndi 一个不能少。
- e075358: 部署冒烟链路：`pnpm smoke` 一键完成「启动 Flowable 6.8 容器 → REST 部署基准
  XML → 断言流程定义注册」，CI 侧以 workflow_dispatch 手动触发的同名 job 承载。
- f126d96: 新增解析接缝 `parse(xml, { adapter })`：方言 XML → 模型树（语义元素 + bpmndi 几何恢复）。
  编译器幂等化：重复编译不再叠加 DI 段。往返保真不变量（parse → model → compile 语义等价）
  以最小流程与三个变体（分支交换 / 线性流程 / 审批链加签）逐字一致锁定。
