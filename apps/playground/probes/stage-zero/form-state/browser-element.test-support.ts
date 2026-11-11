/** 仅包围新增真实组件用例：Popper的类型检查应读取浏览器字符串语义，不能让模拟DOM序列化整树。 */
export async function withBrowserElementString<T>(action: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  Object.defineProperty(Element.prototype, "toString", {
    configurable: true,
    writable: true,
    value: Object.prototype.toString,
  });
  try {
    return await action();
  } finally {
    if (original) Object.defineProperty(Element.prototype, "toString", original);
    else Reflect.deleteProperty(Element.prototype, "toString");
  }
}
