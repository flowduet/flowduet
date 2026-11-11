## 解决的问题

显式 retained 模式下，文字默认值清空后需要保留 `value: ""`，关闭默认值时则应移除 value；字段删除重建和同步捕获也必须保持各自生命期。此前已完成的 P2 修复仍在本地交付分支，尚未合入 develop。

## 修改后的行为

从固定 P2 来源 `fcd7154` 提取 19 项工程差异，保留 legacy 默认及三项既有 15 秒测试例外；同步阶段零收尾入口，冻结供应商实验，不迁入未完成候选。没有新增依赖或修改 lockfile。

```text
retained：开启默认值并清空 → value: ""
retained：关闭默认值       → 不含 value
legacy：默认行为保持
```

## 验证结果

- 本地 Node 24：一次默认根测试 950/950；lint、build、私有夹具类型和 core 原生 ESM 通过。构建保留大 chunk 告警。
- 实际三包 tarball 在独立消费目录安装；固定依赖组合的 Node 入口/CSS、严格类型、生产构建通过。浏览器文字空串/未设置、普通中文、保存重开、中间数值阻断、legacy 与 XML 导出核对通过。
- 宿主处理器保持检查失败：现有供应商挂载会覆盖 onbeforeunload/body.ondrop，卸载未恢复。P2 未改变该路径；本 PR 不放行真实宿主嵌入，不以此引入供应商改造。
- Node 22/24 远端 CI 未执行；无推送。本地结果不代替准确 PR head 的远端检查。默认 Playground 仍为 legacy；完整工作台、OS IME、全主题与供应商取消能力没有交付。
- 详见 `docs/design/2026-10-25-stage-zero-p2-integration-result.md` 及同目录来源/证据。消费准备失败与纠正原件保留，没有将它们隐藏为第一次即成功。

## 关联 Issue

本次为维护者批准的阶段零收尾整合，无新增实施 issue，不关联或关闭 #56。
