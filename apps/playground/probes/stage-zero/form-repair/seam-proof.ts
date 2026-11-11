/** 仅记录公开回调对象的引用关系，不给产品签发身份或维护输入缓存。 */
export function createSeamRecorder(owner: string) {
  const tokens = new WeakMap<object, number>();
  let serial = 0;
  const events: { sequence: number; event: string; detail: unknown }[] = [];
  function token(source: object): string {
    if (!tokens.has(source)) tokens.set(source, ++serial);
    return `${owner}:${tokens.get(source)}`;
  }
  function record(event: string, detail: unknown): void {
    events.push({ sequence: events.length + 1, event, detail });
  }
  return { token, record, events };
}
