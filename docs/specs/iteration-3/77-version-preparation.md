# #77 三包版本准备草稿（2026-10-13）

## 当前结论

从最新 develop `dc5cbbcc76123867910a0c7664ddc9209ff1469d` 切 `release/77-iteration-3`。版本化源码提交：`f0344d4d0b8b1fa4aa59224b27fd70f8d01788bd`。

版本与候选产物已准备，**全仓测试门槛未过，暂不能合并或发布**。未推送、未创建版本PR、未发布npm或tag，#77及#78仍应保持原状态。

## 版本与变更

| 包                    | 现有版本  | 本次候选 | 官方registry读回                                  |
| --------------------- | --------- | -------- | ------------------------------------------------- |
| @flowduet/core        | 0.2.1     | 0.3.0    | 公开latest0.2.1，无0.3.0                          |
| @flowduet/designer    | 0.0.5     | 0.1.0    | 公开latest0.0.5，无0.1.0                          |
| @flowduet/form-create | 0.0.0占位 | 0.1.0    | 查询返回E404，未观察到公开包；不据此证明npm写权限 |

使用Changesets实际消费8份changeset，生成三包CHANGELOG与版本，CORE_VERSION同步为0.3.0。版本化前修正历史“仅空目录/仅文本”阶段描述，并补U64修复到发布说明。`pnpm install --lockfile-only --offline --ignore-scripts`通过，锁文件无需变更，workspace内部依赖由真实pack转换为core0.3.0 / designer0.1.0。

补充BpmnCanvas宿主需显式安装并引入VueFlow基础样式的README说明；实际外部消费展开画布后12节点、13边、704px高度。三包VueSFC声明以Bundler模式验证，纯NodeNext首次报5条VueSFC声明解析错误，失败保留；未加shim、未打开skipLibCheck来掩盖。core独立NodeNext检查通过。没有新增仓库依赖或产品逻辑；唯一源码常量改动是CORE_VERSION。

此前被*.log忽略的6份U64原始日志已强制加入Git，32条原始校验和全部匹配；旧报告链接随此提交恢复可访问，不重写历史失败记录。

## 实际验证

| 门槛                  | 本次结果与证据                                                                                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 构建/vue-tsc          | [build.txt](evidence/77-version-prep/build.txt)退出0；保留大块体积提示                                                                                                                                                                                                                                                 |
| lint                  | [lint.txt](evidence/77-version-prep/lint.txt)退出0，最终留档后再核对                                                                                                                                                                                                                                                   |
| 三包实际pack与dry-run | [最终tarball清单](evidence/77-version-prep/final-tarballs.json)，含LICENSE/README/声明/CSS及正确内部依赖；tarballs为实际tgz，不是计划                                                                                                                                                                                  |
| 仓库外安装/JS/CSS     | [最终依赖树](evidence/77-version-prep/dependency-tree-final.txt)、[Node消费](evidence/77-version-prep/node-consumer-final.txt)；独立目录无workspace源码alias，core版本及编译解析、designer导出、CSS路径通过；form-create Node导入document异常按浏览器边界验证                                                          |
| TS                    | [三包Bundler](evidence/77-version-prep/types-final.txt)、[core NodeNext](evidence/77-version-prep/types-core-nodenext.txt)退出0；[首次NodeNext失败](evidence/77-version-prep/types-nodenext-first.txt)保留                                                                                                             |
| 真实浏览器消费        | [初次实际tarball](evidence/77-version-prep/consumer-browser.json)、[最终消费](evidence/77-version-prep/consumer-final-browser.json)，真实设计器9菜单、内容保存、必填失败/通过、试填隔离、两表单保存恢复、公开画布样式；还有一条重复插件应用warning，不声称零警告                                                       |
| Playground            | [结果](evidence/77-version-prep/playground-browser.json)，版本化构建后的两表单刷新、同ID重开、0/false、默认/覆盖XML；[实际设计](evidence/77-version-prep/playground-design.flowduet.json)、[当前导出](evidence/77-version-prep/playground-export.xml)，原用户草稿字节恢复                                              |
| Flowable6.8           | [全套基准](evidence/77-version-prep/smoke-flowable68.txt)退出0；[两份当前导出部署](evidence/77-version-prep/artifacts-flowable68.json)均HTTP201、注册定义并启动实例，经理审批人王经理、继承formKey=null；部署不等于引擎原生渲染表单                                                                                    |
| 完整测试              | **未通过**：Mac首轮2失败、复验6失败；Node22 Linux挂载盘11失败、内部盘6失败；单worker4失败。均为components.test.ts真实设计器相关超时，[逐次失败清单](evidence/77-version-prep/test-blockers.json)。核心125/designer127通过，form-create无法整组通过，递归执行因此未到Playground。未修改任何测试、断言、超时或筛掉失败项 |

README修正后重生成并重新安装最终tarball；其dist/声明/CSS与第一次浏览器实测产物逐字相同，仅README变化，等值断言见final-tarballs.json。最终消费者已按新README引入VueFlow样式并重验保存恢复及画布。

原始输入、消费者脚本快照、安装、类型、Node及工程日志、截图、实际tgz、XML和校验和位于 [证据目录](evidence/77-version-prep/version-manifest.json)。本轮未重跑133项完整产品矩阵，不能宣称它在版本提交全部绿。

## 阻塞与下一步责任

当前停在本地版本草稿与候选验收证据整理；阻塞为真实设计器组件全仓测试超时及尚无本版本远端CI。未证实是版本回归或纯机器资源问题，不能以旧PR绿CI替代。

由用户审阅本地提交后决定是否授权推送版本分支；获推送授权后由Codex推送，开版本PR仍单独确认。版本PR建立后必须用新HEAD的Node22/24 CI核验；若远端同样失败，先定位修复，不能合并发布；若远端通过，结合保留的本地失败及浏览器/引擎证据审阅。

#77只在版本PR完成评审合入、实际版本化产物门槛全部满足后更新关闭，#78再解除依赖并进入人工发布。当前不关闭#77、不移除#78依赖，也不启动后台自动跟进。

## 本地双轴复核

固定范围：`dc5cbbcc76123867910a0c7664ddc9209ff1469d...f0344d4d0b8b1fa4aa59224b27fd70f8d01788bd`。Standards：0项规范问题、0项值得重构的smell；Spec：0项实现缺陷、1项验收阻断（当前完整测试未通过且无新HEAD CI），版本PR创建评审为正常后续待办。仅支持作为Draft审阅，不支持合并、关#77或发布。
