---
"@flowduet/core": patch
"@flowduet/designer": patch
"@flowduet/form-create": patch
---

修复 #72 默认表单评审发现：有效表单解析保留 XML 引用字面值；带首尾空格的引用在设计视图中标为失效，组合部署导出明确拒绝；表单定义拒绝缺失或重复的字段标识，避免试填值混用。Playground 的预览与引用提示随模型编辑更新，表单管理面板就地反馈空白名称错误。
