/**
 * bpmn-moddle 10.x 未随包提供类本身的类型（仅元素类型），
 * 这里按本项目实际使用的最小 API 面声明，避免 `any` 渗入接缝。
 * 注意：10.x 是具名导出（export { SimpleBpmnModdle as BpmnModdle }），无默认导出。
 * 扩展用法时同步扩充此声明。
 */
declare module "bpmn-moddle" {
  export interface ModdleElement {
    /** 元素的描述符类型，如 "bpmn:UserTask" */
    $type: string;
    get(prop: string): unknown;
    set(prop: string, value: unknown): void;
  }

  export interface ModdleToXmlOptions {
    /** 缩进格式化输出 */
    format?: boolean;
    /** 输出 <?xml ...?> 前导声明 */
    preamble?: boolean;
  }

  export interface ModdleToXmlResult {
    xml: string;
  }

  export class BpmnModdle {
    /**
     * @param additionalPackages 额外的 moddle 扩展包描述符（引擎方言的载体）
     */
    constructor(additionalPackages?: Record<string, unknown>);
    create(type: string, attrs?: object): ModdleElement;
    toXML(element: ModdleElement, options?: ModdleToXmlOptions): Promise<ModdleToXmlResult>;
    fromXML(
      xml: string,
      typeName?: string,
      options?: object,
    ): Promise<{ rootElement: ModdleElement; references?: unknown[]; warnings?: string[] }>;
  }
}
