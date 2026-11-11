export type EntityRef = {
  documentEpoch: number;
  kind: "node" | "flow" | "form";
  id: string;
  lifetime: number;
};
export type ValidationStamp = {
  documentEpoch: number;
  effectiveRevision: number;
  ruleRevision: number;
};
export type LiveEntity = { kind: EntityRef["kind"]; id: string; object: object };
