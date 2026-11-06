# 一次性安装包消费模板

本目录只是 `scripts/verify-appearance-consumer.mjs` 的输入模板，不是 workspace 包或长期演示应用。执行脚本时才会复制到新的临时空目录，并安装当前工作区实际打出的三包 tarball。

长期可操作示例仍只有 `apps/playground`。这里的 `src/scenes` 由脚本从该宿主复制，确保源码宿主与安装包消费者复用同一组公开用法；Vite 配置没有源码 alias。
