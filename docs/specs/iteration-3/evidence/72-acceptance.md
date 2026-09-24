# #72 验收证据（2026-09-24）

## Flowable 6.8 真实部署（规格第 9 条）

- 完整输出：`72-smoke-flowable68.txt`（含默认绑定基准 `default_form_flow` 部署注册 + 运行时断言，及全部既有基准回归）
- Playground 有效导出物：`72-playground-export.xml`（演示流程 + `flowduet:defaultFormKey="form_1"` + 竖排 DI，经 `SMOKE_EXTRA_XML` 同容器部署，process key `playground_demo` 注册成功）
- 结论：`urn:flowduet:bpmn` 编码被引擎部署解析接受（实例可启动、显式 formKey 节点任务可达），无需修订编码方案

## 真机交互回归（Chrome 153 / CDP，规格第 10 条）

同一浏览器会话内完成的端到端链路（截图与中间产物存会话临时目录）：

1. 表单管理新建「申请单」→ 真实 FcDesigner（菜单仅文本字段、AI 模块关闭）拖入输入框 → 字段名「申请事由」→ 勾选必填 → 保存
2. 流程默认表单选择条设为 form_1；单签/多实例卡片显示「继承默认」，抄送无表单行
3. 下载设计文档：协议头/forms（rules 含 `$required`）/xml（含 defaultFormKey）离线核验通过
4. 从文件打开：表单与绑定恢复、卡片继承还原、预览渲染同一字段（label/required/字段标识稳定）
5. 预览试填：清空必填 → 字段错误「申请事由不能为空」+ 摘要「校验未通过」；补填 → 「校验通过」；试填值入查看面板、不回写设计定义
6. 组合部署导出：产出含 `flowduet:defaultFormKey` 的 XML；篡改默认 key 为 ghost_form 后打开 → 草稿 + 引用待修复提示 + 失效标记（选择条/卡片保留原 key）→ 导出被阻断 → 改选回 form_1 → 导出恢复

## 版本锁定（规格第 1 条）

`@form-create/designer@3.5.0` + `@form-create/element-ui@3.3.4`（npm 镜像元数据 + 上游 dist 核验：Vue 3 线、peer vue ^3.5、designer 要求 formCreate ≥ 3.2.24 由 3.3.4 满足；`latest` 标签为 Vue 2 线已避开）。
