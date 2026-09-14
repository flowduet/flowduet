# 调研备忘：引擎与设计器生态（2026-09）

> 核查日期：2026-09-14。结论有时效性，引用前请复核。

## 一、流程引擎格局

### 第一梯队：Activiti 系三兄弟（存量项目大多数）

| 引擎 | 现状 | 要点 |
|---|---|---|
| Flowable | 新项目默认首选 | Activiti 原核心团队 2016 fork；BPMN/CMMN/DMN；Apache 2.0；6.4.1 后开源版节奏放缓，7 起移除 UI |
| Camunda | 代际切换期 | C7 CE 已 EOL（2025-10，末版 7.24；EE 至 2030-04-09）；C8 = Zeebe 云原生重写，与 7 完全不兼容 |
| Activiti | 边缘化 | 7/8 方向不明，仅存量维护 |

- **编排系**（服务编排而非审批流）：Temporal（事实标准，Stripe/Datadog/Box 在用）、Uber Cadence、Netflix Conductor（Orkes）；云托管：AWS Step Functions、Dapr Workflow、Restate。
- 分界线记忆法：审批流引擎管"人怎么审批"，编排引擎管"服务怎么按流程跑"；嵌入式（引擎活在应用里）vs 独立集群（服务活在引擎集群里）。
- 其他：jBPM/KIE（Red Hat，Drools 同生态）；国产轻量：Warm-Flow（Dromara）、FlowLong。
- Apache Camel 是集成路由、Spring StateMachine 是状态机——都不是工作流引擎。

### Flowable 版本时间线（设计器适配相关）

- 6.8.x：JDK 8 / Boot 2 / javax，含表单引擎 + flowable-ui → **国内存量主力**
- 7.0.0（2023-12）：强制 JDK 17 / Boot 3 / jakarta；删除表单引擎、内容引擎、flowable-ui
- 7.2.0（2025-08-21）：7.x 末版
- **8.0.0（2026-02-27）**：Spring 7 / Boot 4 / Jackson 3
- 官方表态：6.8 不支持 Boot 3；标准路径 JDK17 → Boot3 → Flowable 7 一步到位
- **关键事实：flowable XML 方言（命名空间 + 扩展属性）跨 6/7/8 基本稳定**——适配器对准方言即可一代覆盖三代

## 二、在线设计器方案地图

- **官方自带**：Flowable 6.x `flowable-ui`（Modeler/Task/Admin/IDM；7 起移除，Modeler 归商业版 Flowable Work/Design，6.8.x 是末版）；Camunda 7 无在线建模器（Modeler 是桌面 Electron；Web Modeler 属 C8）；Activiti Explorer 的 Oryx 系 Modeler 已陈旧。
- **bpmn.io 生态**（事实标准）：`bpmn-js` + `bpmn-js-properties-panel` + `camunda-bpmn-moddle`；官方 Vue 封装 `vue-bpmn`。
- **国内封装**（均基于 bpmn-js）：
  - MiyueFE/bpmn-process-designer（Gitee）——Flowable 向，重写属性面板，文档最全
  - 温良恭/bpmn-process-designer（Gitee）——内置 activiti/flowable/camunda 三引擎支持文件
  - Adminhcf/Flowable-Bpmn-Design（Gitee）——bpmn-js 13.x，三引擎
  - 脚手架级：ruoyi-flowable、ruoyi-vue-pro（yudao）BPM 模块、JEECG、AgileBPM
- **图库自绘派**：AntV X6 / LogicFlow（如 SimFlow）。
- ⚠️ **仿钉钉式（wflow 等）不是 BPMN 2.0**：自有 JSON 模型，接引擎需转换层且必有损——FlowDuet 的核心差异化正是消灭这层转换。
- **自集成关键坑**：三引擎 XML 命名空间互不兼容（`activiti:` / `flowable:` / `camunda:`），`delegateExpression`、监听器、表单 key 等执行属性各挂各的命名空间。

## 三、FormCreate 授权双轨（ADR-0006 依据）

- 渲染器全家桶（element-plus / ant-design-vue / naive-ui / arco / tdesign / vant / iview 等）：**MIT**
- 开源表单设计器 `@form-create/designer`：**MIT**，EP 单基座；Antd 版、Vant 4 版已开源
- **FcDesigner Pro：商业授权 + license key**（AI 助理/公式/权限/SQL 生成）——不可进入 Apache-2.0 仓库
- 设计器扩展 API：`FcDesigner.component()` / `FcDesigner.dragRule()` / menu 配置（零 fork 加自定义组件）

## 四、关键链接

- Flowable：[7.0.0 Release 博客](https://www.flowable.com/blog/releases/flowable-open-source-7-0-0-release) · [7.2.0 论坛公告](https://forum.flowable.org/t/flowable-7-2-0-release/12404) · [GitHub Releases](https://github.com/flowable/flowable-engine/releases) · [6.8 不支持 Boot 3 官方表态](https://forum.flowable.org/t/flowable-6-8-0-is-not-working-properly-with-spring-boot-3-x/10578) · [企业版 Release Notes](https://documentation.flowable.com/latest/admin/release-notes/latest)
- Camunda 7 EOL：[论坛公告](https://forum.camunda.io/t/important-update-camunda-7-community-edition-end-of-life-announced/50921) · [EE 延期博客](https://camunda.com/blog/2025/02/camunda-7-enterprise-end-of-life-extension/) · [C7→C8 迁移指南](https://unsupported.docs.camunda.io/8.3/docs/guides/migrating-from-camunda-7/migration-readiness/)
- 设计器：[bpmn.io](https://bpmn.io/) · [MiyueFE/bpmn-process-designer](https://gitee.com/MiyueSC/bpmn-process-designer) · [温良恭/bpmn-process-designer](https://gitee.com/budongfeng/bpmn-process-designer) · [Adminhcf/Flowable-Bpmn-Design](https://gitee.com/haocaifei_haocaifei/flowable-bpmn-design) · [flowable-ui Docker（6.x）](https://hub.docker.com/r/flowable/flowable-ui)
- FormCreate：[form-create-designer（MIT）](https://github.com/xaboy/form-create-designer) · [官方文档/扩展 API](https://view.form-create.com/methods) · [Antd 版文档](https://view.form-create.com/antd/start) · [Pro 授权条款](https://pro.form-create.com/doc/license)
- 选型参考：[三引擎源码级对比（知乎）](https://zhuanlan.zhihu.com/p/2069706409080534346) · [2026 工作流引擎全景（腾讯云）](https://developer.cloud.tencent.com/article/2664180)
