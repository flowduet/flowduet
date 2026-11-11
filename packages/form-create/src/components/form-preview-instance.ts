let instanceSequence = 0;

/** 同页可存在多个 Vue app，实例标识不能只依赖 app 内的 useId 序号。 */
export function nextFormPreviewInstanceId(): string {
  instanceSequence += 1;
  return String(instanceSequence);
}
