/**
 * 只读画布的 VueFlow 配置（#26 AC1：配置清单单一出处，测试直接断言本常量）。
 * 编辑面全部禁用；缩放/平移保留（AC：缩放平移可用）。
 */
export const READONLY_FLOW_PROPS = {
  nodesDraggable: false,
  nodesConnectable: false,
  edgesUpdatable: false,
  elementsSelectable: false,
  connectOnClick: false,
  /** 键盘删除禁用（null = 不绑定删除键） */
  deleteKeyCode: null,
  zoomOnScroll: true,
  panOnDrag: true,
} as const;
