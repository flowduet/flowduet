---
"@flowduet/core": patch
"@flowduet/form-create": patch
---

修复普通 npm 消费者的类型声明链：core 构建时复制 bpmn-moddle ambient 声明并在公开入口引用，避免消费侧 TS7016；form-create 构建时剥离声明产物中的 CSS 副作用 import，避免 TS2882。core 接入示例补齐竖排布局函数导入。
