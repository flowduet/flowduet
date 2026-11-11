import { FlowDesignSession } from "../../../../packages/form-create/src/session";
export class ProbeHostController {
  readonly session = new FlowDesignSession();
  epoch = 1;
  generation = 0;
  savedGeneration = 0;
  private saveRequest = 0;
  private loadRequest = 0;
  constructor() {
    this.session.newDesign({ processId: "host_probe" });
  }
  get dirty() {
    return this.generation !== this.savedGeneration;
  }
  edit() {
    this.generation++;
  }
  newDesign(id: string) {
    this.session.newDesign({ processId: id });
    this.epoch++;
    this.saveRequest++;
    this.loadRequest++;
    this.generation = 0;
    this.savedGeneration = 0;
  }
  replaceIfAllowed(
    id: string,
    approve: () => boolean,
    available: (id: string) => boolean,
  ): boolean {
    if (!available(id) || !approve()) return false;
    this.newDesign(id);
    return true;
  }
  async save(adapter: (json: string) => Promise<void>): Promise<"saved" | "stale" | "failed"> {
    const epoch = this.epoch,
      request = ++this.saveRequest,
      generation = this.generation;
    const current = () => epoch === this.epoch && request === this.saveRequest;
    try {
      const snapshot = await this.session.save();
      if (!current()) return "stale";
      await adapter(snapshot.json);
      if (!current()) return "stale";
      this.savedGeneration = generation;
      return "saved";
    } catch {
      return current() ? "failed" : "stale";
    }
  }
  async load(read: Promise<string>): Promise<"loaded" | "stale" | "failed"> {
    const request = ++this.loadRequest,
      epoch = this.epoch,
      generation = this.generation;
    try {
      await this.session.open(read, {
        canReplace: () => epoch === this.epoch && generation === this.generation,
      });
      if (request !== this.loadRequest || epoch !== this.epoch) return "stale";
      this.epoch++;
      this.saveRequest++;
      this.generation = 0;
      this.savedGeneration = 0;
      return "loaded";
    } catch {
      return request !== this.loadRequest || epoch !== this.epoch ? "stale" : "failed";
    }
  }
}
