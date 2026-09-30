---
"@flowduet/core": minor
"@flowduet/form-create": minor
---

设计文档打开的引擎扩展兼容检查与原子恢复（迭代三 #75）：

- `parse` 新增 opt-in 选项 `rejectUnregisteredNamespaces`：XML 实际使用的命名空间按 URI 与真实使用内容判定（带前缀元素/属性经作用域内声明解析），未注册的扩展内容抛 `UnregisteredNamespaceError` 并点名前缀、URI、限定名与行号。默认关闭，既有调用者的宽松行为不变；已注册集合以 moddle registry 为准（标准四包 + 适配器方言 + 项目协议），新增适配器扩展包自动进入放行范围。
- 动机：bpmn-moddle 对「未注册 URI 的带前缀属性」不产生解析警告而是静默收进 `$attrs`（键名还可能被改写成 `ns0:` 前缀）——假借 `flowable` 前缀但绑定其他 URI、实际使用 camunda 扩展等内容会混过 `rejectWarnings` 检查且语义丢失不可见。同 URI 不同前缀照常识别；仅声明未使用的命名空间不构成冲突；`xml` / `xsi` 基建前缀放行；扫描器跳过注释、CDATA、PI 与 DOCTYPE，按引号切分属性值（条件表达式中的尖括号不误判）。
- 审计在 moddle 解析成功之后执行：结构坏 XML 仍由解析层报「无法解析」，审计只针对「能解析但语义静默丢失」的内容。
- 表单包的文档保存自证与打开路径启用该审计，并在错误包装上区分两类失败：「文档 XML 使用了当前引擎适配器不支持的扩展」与「文档 XML 无法解析」，诊断不静默丢弃。
