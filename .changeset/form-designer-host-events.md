---
"@flowduet/form-create": patch
---

修复 FormDesigner 挂载后覆盖宿主 onbeforeunload 和 body.ondrop 的问题：保留宿主处理器，将供应商离页提示按实例注册并在卸载时清理，默认 drop 阻断仅作用于本编辑器范围；双实例与宿主后续改写互不覆盖，legacy 和 retained 的编辑、保存合同保持。
