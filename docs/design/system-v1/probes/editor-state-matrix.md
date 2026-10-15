# C组状态矩阵与执行记录

基线`develop@10b2a13`；批准文档`7e5b520`迁入`7e4fd3b`。本表是逐片账本，不把入口盘点当成保真通过，B03仍阻断。

## C0 已实际盘点入口

真实Chromium、虚构两表单及同ID双控制器，正常点击所属DragTool选中字段。只读观察已确认保留焦点/文字/选区，不改session和版本。

| 字段 | 实际属性入口（含默认控件）                                                                                                                                                                                                            | 静态选项表数 | 状态           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------- |
| F01  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |
| F02  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: TEXTAREA/; 是否必填: INPUT/checkbox                                                                                                                                                | 0            | inventory only |
| F03  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/number; 是否必填: INPUT/checkbox                                                                                                                                             | 0            | inventory only |
| F04  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 1            | inventory only |
| F05  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 设置默认值: INPUT/checkbox; 默认选项: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                 | 1            | inventory only |
| F06  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 是否可以清空选项: INPUT/checkbox; 选项为空时显示的文字: INPUT/text; 多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词: INPUT/checkbox; 默认值: INPUT/text; 是否必填: INPUT/checkbox | 1            | inventory only |
| F07  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |
| F08  | 字段 ID: INPUT/text; 字段名称: INPUT/text; 默认值: INPUT/text; 是否必填: INPUT/checkbox                                                                                                                                               | 0            | inventory only |

字段ID/字段名称/必填配置均实际在场。F04/F05/F06静态选项表经真实DOM盘点，TableOptions源码确认cell blur/change-type提交；数值/日期中间串、真实drop/cancel与OS输入法仍待相应片验证。L01/I01另验，不能用普通日期代替全部导入形态。

## 执行与证据口径

F01–F08 × 顶层/列内 × 已批准值/清空/选项状态 × K/R，加X01–X09、ERR01–ERR07、L01/I01逐项登记。两策略独立新会话，回退只记kept-fallback。未执行、失败、工具阻断、天然失败未验证均不计通过。

C0基线默认全量657/657、strict退出0；新增语义、原生DOM只读观察及真实空设计器装载13项通过。复杂属性面板的新增HappyDOM测试出现未就绪断言、卸载后hidden错误、默认5秒超时；未改时限或扩大toString兼容，原生焦点业务断言已用Chromium另验，不把13项当全字段浏览器通过。

一次CLI批次的实际page变为about:blank，记工具上下文失败；重新核对URL进入C后重跑通过，不当产品缺陷。当前浏览器仅favicon404，未发现可计ERR05的天然失败。

后续各片结果和缺口逐行补充；完整原始负证据与源码身份在C5归档。
