# P0两项P2补修账本
BASE: a85767544e176565bf0a9e11985460a574bd5854
Branch: refactor/b03-default-editor-seams，复用既有隔离工作树。
Scope: 只修Dialog实例归属、双Dialog交叉与弹层断言；无P1/产品/D/E/推送。
Plan: 1复现两项RED；2提取无产品依赖的Dialog样稿，每挂载唯一owner且活动/销毁状态守卫；3正式协议/真实双Dialog及弹层正负回归；4重放P0矩阵+默认全量/build/lint/strict；5一次独立复核，分组提交与更新门结论。
Pre-flight: 原P0旧归档不改；新文件只在form-repair与新增证据目录；dialog提取保留旧单DialogUI标记，第二实例默认不挂载，旧矩阵可原样重放。模块唯一标记不得使用跨Vue应用可碰撞的默认useId。

RED: 当前a857675旧样稿跨应用同标签Dialog的Enter隔离失败；阻止Select打开后旧oracle仍判true。原始脚本/结果存red/，不是天然故障或OS证据。
实现: 新DialogCloseSeamProbe.vue仅测试私有；每挂载crypto.randomUUID()，公开class/data绑定唯一归属，活动/卸载守卫，document监听按原函数引用移除。Parent默认只挂A，可选B对照；无产品导出。
协议回归: 新6项真实ElDialog事件协议通过，candidate入口110/110，未扩大默认5秒；独立Vue应用同label、隐藏busy、双开/Space/指针、旧marker、卸载重挂、迟到click均在自动入口。
Pilot: 原生动作+busy协议矩阵48/48；弹层正常及no-open/no-close注入9/9；共同popupExercise等待显式打开/关闭并给stage，负例要求相应stage及真实拦截计数，不能吞任意错误算通过。
工具错误: 初次提取log字符串替换误命名openDialog造成4个协议失败，按类型/测试栈定位修正；初始popup选择器命中EP外内两个带class节点，改用自有class+公开role=tooltip。原日志保留，不计业务RED/GREEN。

最终冻结重放: 14批162行=148通过/12旧生产负例/2工具未知；跨Dialog48、跨应用同标签3、popup oracle9均通过，正负共享同一popupExercise。源快照156份，五命令后逐字保持。
验证: candidate110/110、pnpm test756/756，build/lint/strict exit0。未改默认超时/worker/业务断言/真实提供者，历史APP-T不宣称解决。浏览器flowduet-p0-p2关闭，Vite5182 SIGINT关闭。
Independent review: pending; P1/D/E/推送均未执行。

独立复核: fresh-context reviewer Standards/Spec新增P1/P2=0，支持限定P0技术依据。亲跑哈希/映射，浏览器和五命令仅核读。
非阻断精度提醒: closed_instance单项只测初始未打开旧marker，不单独视为完整关闭周期；验收范围收窄，未追加P1生命周期实现。
Final Ruling: P1/M01-M08/租约/异步关闭留待明确授权；代价为仍需真实实现回归。
Final Ruling: Enter/指针不推广Tab/OS；P3/native/ERR05仍未知；代价为B03继续阻断。
Final Ruling: 本地绿色不根治APP-T，不代替未运行远端CI；代价为独立范围保留。
源码与驱动提交6b1daca；本轮验证在该提交相同字节执行，没有源码补修发生在最终验证/独立复核之后。
