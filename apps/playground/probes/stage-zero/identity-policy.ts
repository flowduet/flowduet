import type { EntityRef, LiveEntity, ValidationStamp } from "./probe-contracts";
export class EntityRegistry {
  private epoch = 1;
  private counter = 0;
  private entries = new Map<string, { ref: EntityRef; object: object }>();
  private buffers = new Map<string, unknown>();
  get documentEpoch(): number {
    return this.epoch;
  }
  private key(ref: Pick<EntityRef, "kind" | "id">) {
    return `${ref.kind}:${ref.id}`;
  }
  private bufferKey(ref: EntityRef) {
    return JSON.stringify([ref.documentEpoch, ref.kind, ref.id, ref.lifetime]);
  }
  // continuity 只能来自已验证的受控命令，不能从 ID 相同推断。
  sync(live: LiveEntity[], continued = new Set<string>()): void {
    const keys = new Set(live.map((x) => this.key(x)));
    for (const [key, entry] of this.entries) if (!keys.has(key)) this.remove([entry.ref]);
    for (const entity of live) {
      const key = this.key(entity),
        previous = this.entries.get(key);
      if (previous && (previous.object === entity.object || continued.has(key)))
        previous.object = entity.object;
      else {
        if (previous) this.remove([previous.ref]);
        this.entries.set(key, {
          object: entity.object,
          ref: {
            documentEpoch: this.epoch,
            kind: entity.kind,
            id: entity.id,
            lifetime: ++this.counter,
          },
        });
      }
    }
  }
  ref(kind: EntityRef["kind"], id: string): EntityRef {
    const found = this.entries.get(this.key({ kind, id }));
    if (!found) throw new Error("对象不存在");
    return { ...found.ref };
  }
  put(ref: EntityRef, value: unknown): void {
    if (!this.resolve(ref)) throw new Error("对象身份已失效");
    this.buffers.set(this.bufferKey(ref), value);
  }
  get(ref: EntityRef): unknown {
    return this.resolve(ref) ? this.buffers.get(this.bufferKey(ref)) : undefined;
  }
  remove(refs: EntityRef[]): void {
    for (const ref of refs) {
      this.buffers.delete(this.bufferKey(ref));
      if (this.resolve(ref)) this.entries.delete(this.key(ref));
    }
  }
  resolve(ref: EntityRef): object | undefined {
    const entry = this.entries.get(this.key(ref));
    return entry && ref.documentEpoch === this.epoch && ref.lifetime === entry.ref.lifetime
      ? entry.object
      : undefined;
  }
  replaceDocument(): void {
    this.epoch++;
    this.entries.clear();
    this.buffers.clear();
  }
}
export class ValidationTracker {
  private state: ValidationStamp = { documentEpoch: 1, effectiveRevision: 0, ruleRevision: 0 };
  private stamp: ValidationStamp | undefined;
  private effective = "";
  private identities = "";
  // 由调用方给出候选指纹，本探针不把 JSON 串等同于全部 BPMN 语义。
  update(effective: string, identities: string): void {
    if (effective !== this.effective || identities !== this.identities)
      this.state.effectiveRevision++;
    this.effective = effective;
    this.identities = identities;
  }
  validate(): void {
    this.stamp = { ...this.state };
  }
  current(): boolean {
    return (
      this.stamp !== undefined &&
      Object.keys(this.state).every(
        (key) =>
          this.state[key as keyof ValidationStamp] === this.stamp![key as keyof ValidationStamp],
      )
    );
  }
  replaceDocument(): void {
    this.state.documentEpoch++;
    this.stamp = undefined;
  }
  changeRules(): void {
    this.state.ruleRevision++;
  }
}
