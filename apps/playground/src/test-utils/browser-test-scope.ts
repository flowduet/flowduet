type MountedTarget = { readonly element: Node };

const targetGuards = new WeakMap<MountedTarget, () => void>();

/** 只供指定测试文件安装：恢复浏览器字符串语义，并限定异步动作的实例生命期。 */
export function createBrowserTestScope() {
  const storage = localStorage;
  const setItem = storage.setItem;
  const prototype = Element.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, "toString");
  Object.defineProperty(prototype, "toString", {
    configurable: true,
    writable: true,
    value: Object.prototype.toString,
  });
  let active = true;
  return {
    own<T extends MountedTarget>(target: T): T {
      targetGuards.set(target, () => {
        if (!active || !target.element.isConnected) throw new Error("测试实例已失效，拒绝迟到动作");
      });
      return target;
    },
    close(unmount: () => void, cleanup: () => void): void {
      if (!active) return;
      // 先使异步发起者失效，避免卸载过程中的回调接触下一例。
      active = false;
      try {
        unmount();
      } finally {
        try {
          cleanup();
        } finally {
          try {
            // happy-dom Storage代理隐藏方法描述符且拒绝delete；restoreAllMocks
            // 无法撤销实例spy。恢复安装时已绑定的方法，防止quota故障串入后例。
            if (storage.setItem !== setItem) {
              Object.defineProperty(storage, "setItem", {
                configurable: true,
                writable: true,
                value: setItem,
              });
            }
          } finally {
            if (original) Object.defineProperty(prototype, "toString", original);
            else Reflect.deleteProperty(prototype, "toString");
          }
        }
      }
    },
  };
}

export function assertActiveTarget(target: MountedTarget): void {
  const guard = targetGuards.get(target);
  if (!guard) throw new Error("测试实例未登记");
  guard();
}
