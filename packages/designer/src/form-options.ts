/**
 * 中立表单选项（#72，ADR-0009）：designer 不依赖任何表单实现，
 * 只消费「目录里有哪些表单」的最小摘要；目录内容由表单集成包
 * （@flowduet/form-create）提供，未安装表单包的宿主不传即可。
 */

/** 表单目录摘要项：id 是稳定引用 key，name 是显示名 */
export interface DesignerFormOption {
  id: string;
  name: string;
}

/**
 * 节点卡片上的有效表单摘要：由 DingtalkDesigner 一次算好随树下发，
 * 卡片只负责呈现（含引用失效标记），不再各自解析。
 */
export interface NodeFormSummary {
  /** 呈现文案，如「表单：申请单（继承默认）」 */
  text: string;
  /** key 指向的表单不在目录中（保留原 key 供修复，不回退） */
  invalid: boolean;
}
