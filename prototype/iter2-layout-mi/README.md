# [PROTOTYPE] 迭代二:竖排坐标推导(问题 A)+ 多实例三档手感(问题 B)

> **THROWAWAY**——本目录是 /prototype 产物,验证结论已折回规划资产(见文末「折回项」),
> 正式实现以 spec 成稿为准,本目录仅作 primary source 留档。

## 要回答的问题(来自 /tmp/flowduet-iter2-prototype-handoff.md)

**A. 竖排坐标推导形态**(dingtalk-view-mvp.md 待细化①):内核 `NodeSpec.shape` 必填,
钉钉式纵向编辑天然无坐标;推导放内核方法、designer 视图层还是独立 layout 模块?

**B. 多实例编译手感**(multi-instance-user-task.md 待细化 1–3):三档(会签/或签/依次)的
moddle 落法、API 形态(spec 进 vs 链式)、完成条件固化 vs 覆盖。

## 怎么跑

```bash
pnpm -C prototype/iter2-layout-mi play        # 9 项验证:块树/几何/三档 XML/守卫/往返
bash prototype/iter2-layout-mi/smoke-mi.sh    # Flowable 6.8 部署冒烟(需 Docker)
open prototype/iter2-layout-mi/out/demo.html  # 观感验收:SVG 渲染 + 四份 XML + 结论表
```

运行时探针(证据链,逐个可跑):`runtime-probe.sh`(collection 展开 + assignee 逐人)、
`assignee-probe.sh`(assignee 属性通道)、`ns-probe.sh`(命名空间判据,双变量对照)、
`log-probe.sh`(部署日志抓取)、`probe-manuals.sh`(XML 形态对照)。

## 结论 A:落点选「独立 layout 模块」,外加两项内核小改

| 落点 | 判据②(只依赖模型树) | 致命伤 |
| --- | --- | --- |
| ① 内核 `layoutVertically()` | ✓ | 需为布局器开几何注册表写入口(内部状态外泄),模型类继续膨胀 |
| ② designer 视图层自算 | ✗ | 编译合同 / parse→compile / 冒烟都不经视图,几何断供 |
| ③ **DiLayout 第二实现**(采纳) | ✓ | 内核唯一必要改动 = `shape` 可选化(见下) |

采纳形态(已原型实现并验证):

```
compile(model, { diLayout: verticalDiLayout() })
```

- `deriveBlockTree(model)`:图 → 块结构树(fork/join 良构配对),**公开导出**——
  钉钉式递归组件的渲染依据,与坐标推导共用,不藏进布局器私有;
- `layoutVertical(tree, flows)`:块树 → 每节点 `CanvasShape` + 每连线正交 `waypoints`,
  纯函数,嵌套块(条件/并行任意层)自底向上测宽、自上而下落位,fork/join 出入点沿边错开;
- `verticalDiLayout()`:组合二者并投影 bpmndi,只读 `process` 图,不碰几何注册表;
- **内核改动面**:① `NodeSpec.shape` 与 `SequenceFlowSpec.waypoints` 改可选(恒等布局
  遇缺坐标节点抛错,诚实);② 哑坐标绕行已试,不成立(调用面骗人);
- 良构检查:分支不收敛(撞 end)、交错收敛 → 显式抛错(已验证),宁可拒绝不出重叠几何。

场景实测:15 节点(条件块嵌并行块 + 条件块嵌条件块)、18 连线,两两无重叠,
60 个 waypoint,SVG 观感见 demo,XML 已过 Flowable 6.8 部署。

## 结论 B:语义 API + 三档枚举固化,零往内核外漏

```
addApprovalTask({ id, name?, collection: "approvers", mode: "all" | "any" | "sequential", elementVariable? })
```

XML 形态(部署 + 启动 + assignee 逐人验证):

```xml
<bpmn:userTask id="counter_sign" name="部门会签" flowable:assignee="${assignee}">
  <bpmn:multiInstanceLoopCharacteristics isSequential="false"
      flowable:collection="approvers" flowable:elementVariable="assignee">
    <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">${nrOfCompletedInstances == nrOfInstances}</bpmn:completionCondition>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>
```

- 会签 = `== nrOfInstances`;或签 = `>= 1`;依次 = `isSequential="true"` 无完成条件;
- 非串行档 `isSequential=false` 是 XSD 缺省,moddle 按缺省省略属性(合法,bpmn.io 同款);
- 完成条件内核固化,不开放覆盖;`sequential` 档传覆盖直接抛错(守卫已验证);
- 审批人集合用**裸变量名**的集合表达式(运行时注入),`loopCardinality` 落法否决(见反例);
- 多实例 API 必须进 `BpmnModel` 方法面:外挂函数拿不到注册表,连 `addSequenceFlow` 都用不了(反例已录);
- 需要的描述符扩展(正式适配器同步):`MultiInstanceLoopCharacteristics` extends
  + `collection` / `elementVariable` 两属性(现有 `assignee` 之外)。

## ⚠ 折回项(重要,含迭代一遗留缺陷)

1. **flowable 命名空间必须改为 `http://flowable.org/bpmn`**(引擎常量 `FLOWABLE_EXTENSIONS_NAMESPACE`)。
   官方文档写的 `http://flowable.org/bpm` 会让**所有 flowable: 属性静默失联**:
   部署校验报 `flowable-multi-instance-missing-collection`,assignee/elementVariable 运行时全丢。
   手写文档原样 XML 双向验证锁定根因(与 moddle 无关)。
   **正式 `flowable-adapter.ts` 与编译基准文件用的正是错误 URI**——迭代一冒烟只断言
   「部署注册」从未启动实例,缺陷潜伏至今。迭代二需同步修:
   - `flowable-adapter.ts` 的 `uri`;
   - `minimal-flow.flowable68.baseline.xml` 与 minimal-flow fixture 的 `xmlns:flowable`;
   - **冒烟脚本加运行时断言**(启动实例 + 查任务/assignee),本轮已备好探针脚本可搬。
2. 三档基准文件按上文形态落(含 bpmndi),冒烟扩到三档全谱;
3. `NodeSpec.shape` 可选化 + 恒等布局诚实抛错,进 dingtalk-view-mvp spec 待细化①的落法;
4. 竖排布局器(`verticalDiLayout`)与 `deriveBlockTree` 的正式化,放 `packages/core/src/layout/`,
   与恒等布局并列;钉钉式视图只消费 `deriveBlockTree`。

## 反例全集(试过不成立)

| 反例 | 现象 | 判决 |
| --- | --- | --- |
| `flowable:` 命名空间用文档值 `bpm` | 属性静默失联,校验报错/运行时丢值 | 改引擎常量 `bpmn` |
| `loopDataInputRef` 纯标准子元素 | 部署通过,但 parse 后文本引用丢失,compile 静默丢集合 | 破坏往返保真,否决 |
| 外挂函数建模(不改内核) | 不进注册表,`addSequenceFlow` 端点校验拒绝 | 多实例 API 必须进内核方法面 |
| 建模传哑坐标 + 布局器覆盖 | 调用面骗人 | `shape` 走可选化 |
| `loopCardinality` 表人数 | 是 Expression 元素,set 字符串序列化崩;拿不到逐人审批人 | 集合表达式落法 |
| 分支不收敛的图 | — | 良构检查显式抛错(已验证) |

## 文件地图

| 文件 | 内容 |
| --- | --- |
| `mi-approval.ts` | 问题 B 候选 API + 修正版 flowable 描述符 + 连线草样 |
| `mi-approval.play.test.ts` | 三档 XML 形态断言 + 固化守卫 + cardinality 反例 |
| `vertical-layout.ts` | 问题 A 三件套:deriveBlockTree / layoutVertical / verticalDiLayout |
| `vertical-layout.play.test.ts` | 嵌套场景块树断言 + 无重叠断言 + 反例 + demo 生成 |
| `roundtrip-probe.play.test.ts` | 往返保真探针(loopDataInputRef 落法否决证据) |
| `demo.template.html` → `out/demo.html` | 观感验收页(play 生成,数据内嵌) |
| `out/mi-*.xml` `out/vertical-scenario.xml` | 冒烟产物(已部署注册) |
| `smoke-mi.sh` | 4 份产物批量部署冒烟(改编自 scripts/smoke-deploy.sh) |
| `*-probe.sh` | 运行时探针(证据链,命名空间根因定位过程) |
