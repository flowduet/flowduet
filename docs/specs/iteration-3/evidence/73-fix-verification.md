# #73 复评问题修复验证（2026-09-28）

原始失败与未完成项见 [`73-browser-acceptance.md`](./73-browser-acceptance.md)。本记录保留原结论并补充修复后的验证结果。

## 功能回归

| 项目              | 验证方式与实际结果                                                                                                                                                                                                                                            | 结论 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A05 同名表单      | Codex 内置浏览器中新建两张“申请单”，默认下拉显示“申请单（form_1）/申请单（form_2）”；默认设 `form_2`、经理审批覆盖 `form_1` 后，两个节点摘要分别带对应 ID 与继承/指定来源。抽屉继承选项同样带默认表单 ID；摘要的完整 `title` 属性另由组件测试断言。           | 通过 |
| A06 删除拒绝提示  | 导入 [`a06-multi-reference.flowduet.json`](./73-browser-fixtures/a06-multi-reference.flowduet.json)，尝试删除同时被默认与经理审批引用的 `form_1`：弹窗内 `role="alert"` 显示两处引用，表单保留。先前失败的 900×800 视口中，完整提示也显示在弹窗内、未被遮挡。 | 通过 |
| 首尾空格 key 测试 | 在 `FlowDesignSession.deleteForm` 的公开会话接缝模拟从 XML 恢复的默认和节点原始 key（均为现有 ID 首尾各一空格）；引用诊断报空格错误，删除守卫不误认有效引用，原值保留。`src/session.test.ts` 单文件通过。                                                     | 通过 |
| 冒烟脚本传输失败  | `pnpm smoke` 正常路径通过 Flowable 6.8 部署及运行时断言。另用临时 `curl` 包装器只在会签任务完成请求模拟退出码 7：脚本打印传输错误和任务 ID，以预期的非零状态退出；临时响应文件已清除，冒烟容器已停止。`bash -n scripts/smoke-deploy.sh` 通过。                | 通过 |

## B09 真实下载与往返

Codex 内置浏览器会取消 Blob 下载，故改用 Playwright CLI 控制的真实浏览器验收该链路；测试工具未写入项目依赖。

1. 在双表单测试文档中分别预置文本字段“申请事由”和“复核意见”，经浏览器导入后点击“下载设计文档”；浏览器实际下载 `playground_demo.flowduet.json`（10,612 字节）。
2. 下载文件外层仅有 `format/version/engine/xml/forms`；表单 ID 为 `form_1/form_2`，规则分别保留 `reason/comment` 文本字段；XML 保留 `flowduet:defaultFormKey="form_1"` 和两个节点的 `flowable:formKey="form_1"/"form_2"`，没有第二份可写绑定。
3. 在页面点击“新建设计”后，上传刚下载的文件：默认选择、两节点的显式覆盖均恢复；按节点预览分别显示“申请事由”和“复核意见”。
4. 再次下载：两次浏览器下载文件逐字相同（原始文件 SHA-256 均为 `3ad890006bc56f924aa7a22442150cf9fd1d2cd47a905ae0bcf4a67cbddaae6f`）。[存档副本](./73-browser-fixtures/roundtrip-browser-downloaded.flowduet.json)为通过 Prettier 格式化的同语义 JSON。

**B09 结论：通过。** 此前未完成的原因是 Codex 内置浏览器取消下载，未发现 FlowDuet 保存或恢复缺陷。

## 自动化门禁

- `pnpm lint`：通过。
- `pnpm test`：core 90、designer 124、form-create 53、playground 17，共 284 项通过。
- `pnpm build`：通过；Playground 的大 chunk 提示是构建警告。
- `pnpm smoke`：Flowable 6.8 正常路径通过；受控传输失败路径按预期失败并清理资源。
