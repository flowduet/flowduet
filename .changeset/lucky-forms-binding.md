---
"@flowduet/core": minor
"@flowduet/designer": minor
"@flowduet/form-create": minor
---

默认表单绑定协议与真实 FormCreate 集成（迭代三 #72）：

- core：新增项目绑定扩展描述符——`bpmn:Process` 上的 `flowduet:defaultFormKey`（命名空间 `urn:flowduet:bpmn`），由创建与解析路径统一注册并与适配器扩展包合并，占用 `flowduet` 前缀的适配器明确拒绝；`BpmnModel.defaultFormKey / setDefaultFormKey()` 读写收口；`resolveEffectiveForm()` 有效表单解析（显式覆盖优先、默认继承、网关与抄送不参与）。未使用绑定的既有编译输出逐字不变（新增基准 `default-form.flowable68.baseline.xml`）。
- designer：`DingtalkDesigner` 新增中立表单接缝 `formOptions`（id/name 摘要，不依赖表单实现）——传入即展示流程默认表单选择条与审批节点有效表单摘要（继承默认 / 节点指定 / 引用失效，失效保留原 key），不传时纯流程形态完全不变；公开 `isCcServiceTask()` 谓词。
- form-create：接入真实开源设计器与渲染器（锁定 `@form-create/designer@3.5.0` + `@form-create/element-ui@3.3.4`，Vue3/Element Plus 线，AI 模块关闭）；`FlowDesignSession` 扩展表单目录管理（创建 / 改名不改 ID / 内容写入校验）；设计文档 forms 携带真实定义（provider=form-create/element-plus、成对序列化 rules/options、字段范围守卫为仅文本）；`FormManager` / `FormDesigner`（菜单收口仅文本字段）/ `FormPreview`（真实渲染器试填、必填校验、查看值，试填与设计隔离、切换目标重置）；`exportDeployXml()` 组合部署导出（流程校验 + 默认与节点引用完整性，A18：默认失效即使节点全有覆盖也阻断）；`collectReferenceIssues()` 引用诊断。
