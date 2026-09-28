# #73 验收证据（2026-09-28）

## Flowable 6.8 真实部署（多表单覆盖基准）

- 完整输出：`73-smoke-flowable68.txt`（`form_override_flow` 部署注册 + 三段运行时断言，及全部既有基准回归）
- 运行时断言结论：
  - 继承节点（提交复核，单签）任务 `formKey=null`——默认继承不落节点属性，引擎不自动填充（FlowDuet 约定成立）
  - 显式覆盖节点（部门复核，会签 2 实例）任务 `formKey=form_review_v1`——覆盖编码经引擎任务查询可读
  - 多节点复用同一覆盖 key（依次确认）任务 `formKey=form_review_v1`
- 踩坑记录：REST complete 会签任务前必须注入后续依次审批的 `chains` 集合变量（任务完成同事务内推进 MI collection 求值，缺失即 HTTP 400 `Variable 'chains' was not found`）；bash 3.2 下 `$tid）` 全角括号并入变量名报 unbound（非 ASCII 前的变量一律 `${}`，与 AGENTS.md 记载一致）

## 真机交互回归（Chrome 153 / CDP）

同一浏览器会话内完成（Playground @ localhost:5199）：

1. 新建设计 → 表单管理新建「申请单 form_1 / 复核单 form_2 / 申请单 form_3」：列表按 ID 区分同名项，删除入口（两段确认）在场
2. 流程默认选 form_1 → 审批抽屉表单选择器：继承项显示「继承默认（申请单）」，同名选项附 ID（申请单（form_1）/申请单（form_3）），复核单唯一名不附
3. 覆盖选复核单保存 → 卡片摘要「表单：复核单（节点指定）」；默认改 form_3 后覆盖节点摘要不变（修改默认只影响继承节点）
4. 重开抽屉回填「复核单」；选回继承保存 → 摘要「表单：申请单（继承默认）」随新默认
5. 删除守卫：删 form_3（被默认引用）→ 确认后错误「仍被以下位置引用：流程默认表单」；默认改回 form_1 后再删成功（目录剩 form_1/form_2）
6. 覆盖复核单 + 审批人 ${boss} → 下载设计文档：forms 双表单、xml 含 `flowduet:defaultFormKey="form_1"` 与 `flowable:formKey="form_2"`、无待修复项
7. 新建设计后从文件打开：默认选中 form_1、摘要恢复「复核单（节点指定）」
8. 组合部署导出：XML 双引用在场、无错误
9. 按节点预览：选中审批节点后真实渲染器在场

## 自动化

- 全仓 `pnpm lint / test / build` 通过（core 90、designer 124、form-create 53、playground 17，共 284 项）
- 新增覆盖面：form-override 编译合同与四形态往返断言（core）、覆盖选择 UI 六用例（designer）、删除守卫四用例 + 双表单往返三用例（form-create session）、FormManager 删除交互（form-create components）、双表单闭环 / 删除守卫 / 预览多目标隔离三用例（playground 集成）
