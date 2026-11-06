# Playground

双视图演示宿主：钉钉式视图编辑与 BPMN 只读视图共享同一棵模型树，右侧预览当前流程的 XML。
草稿未通过 designer 导出校验时，预览区显示错误；补齐配置后自动恢复 XML。

```sh
pnpm --filter @flowduet/playground dev
pnpm --filter @flowduet/playground test
```

## Element Plus 双入口公开消费示例

工具栏的「双入口外观」和「预览外观」都会打开同一个整合场景，同时挂载：

- 两个公开 `DingtalkDesigner` 实例：目录选择与手写 `formKey` 两条路径，真实审批、抄送、条件分支和空抽屉；
- 两个公开 `FormPreview` 实例：文本、多行文本、数字、单选、多选、下拉单选、日期、开关，以及五种单值日期和真实下拉／日期／时间弹层；
- 无关宿主 Element Plus 输入、按钮、下拉和日期控件。

场景只从 `@flowduet/core`、`@flowduet/designer`、`@flowduet/form-create` 的包根导入组件和类型，样式只经两个公开 `style.css` 子路径引入。没有包内部组件、源码 alias、旧阶段零 probe 或内部测试 API。

### 公开外观合同

```ts
import type { ComponentAppearance } from "@flowduet/designer";

const hostAppearance: ComponentAppearance = {
  colorSource: "host", // 省略时也是 host
  mode: "light", // 必须与宿主当前 EP 主题一致
  density: "comfortable", // 省略时也是 comfortable
};

const brandAppearance: ComponentAppearance = {
  colorSource: "brand",
  mode: "dark", // 品牌实例可与宿主或其他实例不同
  density: "compact",
};
```

```vue
<DingtalkDesigner :model="model" :appearance="hostAppearance" />
<FormPreview :form="form" :appearance="brandAppearance" />
```

- 省略 `appearance` 是旧路径；合法对象才显式启用。运行中更新应替换整个对象引用。
- `host` 只声明并消费宿主当前主题，不会替宿主切换 `html/body` 深色类；`brand` 可按实例选择异主题。
- 合法切换来源、主题、密度和启停保留未提交属性输入、试填值与组合输入；非法配置整份拒绝并在控制台指出字段原因。
- 表单定义替换、同 ID 新对象重开仍重置试填；外观变化不属于定义换代。
- `propertyEditing="external"` 不渲染节点抽屉，合法 `appearance` 没有可见效果，也不影响宿主自己的属性面板。
- 既有表单／字段／栅格的显式尺寸、标签、布局、样式和弹层挂载配置优先，造成的视觉偏差单独记为配置影响。

### 操作入口

| 区域 | 可复测操作 |
| ---- | ---------- |
| 宿主 | 两个场景共享宿主 EP 深色与声明式局部深色声明；切换不会修改品牌实例自己的主题 |
| 每个节点实例 | 独立启停、来源、主题、密度、卸载／重挂；点击节点或分支操作真实抽屉，确定写模型、取消不写模型 |
| 节点实例一 | 目录选择、非法密度告警、change／draft 计数、长中文错误和合成组合输入 |
| 节点实例二 | 手写 `formKey`、异主题品牌预设与独立抽屉 |
| 每个预览实例 | 独立启停、来源、主题、密度、卸载／重挂和八类字段试填 |
| 预览实例一 | 切换控件、日期、另一表单、同 ID 重开、显式配置、非法密度及同周期宿主采样竞态 |
| 预览实例二 | 显式表单配置、外部／原位弹层、业务类名合并和异主题品牌预设 |

演示宿主额外把 EP 非模态抽屉的全屏容器设为可穿透、抽屉本体保持交互，便于在保留未提交输入时真实点击外观控件。这只是 Playground 的宿主样式，不是新增的公开 `appearance` 能力，也不改变公开组件的旧抽屉合同。

## 实际 tarball 消费闭环

在仓库根目录执行：

```sh
node scripts/verify-appearance-consumer.mjs
```

脚本会依次执行当前工作区构建、三包实际打包、全新临时空目录安装、严格 TypeScript 公开入口检查、生产构建和依赖副本检查。消费者固定 Vue 3.5.43、Element Plus 2.14.6，要求 EP 物理副本恰好一份，并记录 FormCreate renderer 实际版本（本批验收为 3.3.4）。默认使用 npmmirror，可通过 `FLOWDUET_NPM_REGISTRY` 覆盖。

已经成功构建且只想重跑打包消费时，可使用 `node scripts/verify-appearance-consumer.mjs --skip-build`。脚本末尾输出 `consumerDir`；该目录是临时包检查工程，不是第二套长期演示应用。

```sh
cd <脚本输出的 consumerDir>
npm run preview -- --port 4175
```

再用本机 Chromium 和临时外置的 Playwright 驱动执行双入口浏览器检查：

```sh
FLOWDUET_CHROMIUM_PATH=/absolute/path/to/Chromium \
node scripts/verify-appearance-browser.mjs \
  /absolute/path/to/playwright-core/index.mjs \
  http://127.0.0.1:4175 \
  /tmp/flowduet-appearance-browser
```

同一脚本也可对 Playground 开发页执行，URL 改为 `http://127.0.0.1:5173`。它核对旧路径基线、真实控件点击、跨入口主题同步、双抽屉、卸载重挂和弹层清理；局部深色回归将第二节点切为 host，同时检查两个抽屉的实际背景、宿主变量、关闭后浅色恢复和全局变量保留。JSON 与截图写入最后一个参数指定的目录。Playwright 驱动仅是临时验证工具，不是仓库新增依赖。

类型检查沿用公开消费先例：`tsc` 在 `skipLibCheck: false` 下检查公开 JS／类型入口，Vue SFC 由 Vite 编译并交给 Chromium 实测；不为掩盖声明问题开启 `skipLibCheck`，也不使用源码 alias 或跨 EP 副本注入。

## 人工与未验证边界

真实 OS 中文输入法不能由合成 `CompositionEvent` 代替。需要人工验收时在 macOS 中文输入法下执行：

1. 打开双入口场景和节点实例一的审批抽屉，在节点名称中输入一段尚未上屏的中文拼音。
2. 组合未结束时用鼠标切换密度、来源、主题及启停，确认拼音和已有文字不丢失、不自动确定或取消。
3. 组合未结束时点击「确定」，应提示「输入法尚未完成本次输入，请完成后重试」；完成上屏后再确定，才按原合同写模型。
4. 在 FormPreview 文本字段重复组合中切换外观，确认试填值和组合状态保留；换另一表单或同 ID 重开则仍应重置。
5. 记录实际 OS、输入法、Chromium 版本和结果。仓库自动脚本只证明合成组合事件路径，不证明这一步已经执行。

本批仅适配节点属性抽屉与 FormPreview。画布、抽屉外流程默认表单条、FormManager／FormDesigner 及其工具条未适配。其他 EP 组合、Firefox、Safari／WebKit、移动端和完整可访问性认证未验证；原生 `select` 的系统选项弹层受浏览器和操作系统限制，不承诺像素级主题一致。

整合验收环境与 T01–T14 结果见 [双入口与安装包验证记录](../../docs/design/system-v1/brand/108-dual-entry-consumer-verification.md)。
