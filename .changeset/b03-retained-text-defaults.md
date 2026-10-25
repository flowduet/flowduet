---
"@flowduet/form-create": patch
---

修复显式 retained 模式下单行/多行文本清空后默认值丢失：区分显式空串与未设置，保持字段生命期和同步捕获保护；legacy 默认行为不变。
