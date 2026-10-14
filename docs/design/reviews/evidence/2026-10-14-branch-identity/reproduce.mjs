import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = process.cwd();
const require = createRequire(`${root}/packages/designer/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const server = await createServer({
  root,
  configFile: false,
  logLevel: "silent",
  resolve: { alias: { "@flowduet/core": `${root}/packages/core/src/index.ts` } },
  server: { middlewareMode: true, watch: null },
  appType: "custom",
});

try {
  const { BpmnModel, flowableAdapter } = await server.ssrLoadModule("/packages/core/src/index.ts");
  const ops = await server.ssrLoadModule("/packages/designer/src/operations.ts");
  function build(mode = "condition", multi = false) {
    const m = BpmnModel.create({ processId: "review_branch_identity", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addExclusiveGateway({ id: "fork" });
    if (multi) m.addApprovalTask({ id: "approval_1", collection: "approvers", mode: "all" });
    else m.addUserTask({ id: "approval_1", assignee: "alice" });
    m.addUserTask({ id: "approval_2", assignee: "bob" })
      .addUserTask({ id: "other", assignee: "carol" })
      .addExclusiveGateway({ id: "join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "s_f", sourceRef: "start", targetRef: "fork" })
      .addSequenceFlow({
        id: "fa",
        name: "采购分支",
        sourceRef: "fork",
        targetRef: "approval_1",
        ...(mode === "condition" ? { condition: "${amount > 100}" } : { default: true }),
      })
      .addSequenceFlow({ id: "f12", sourceRef: "approval_1", targetRef: "approval_2" })
      .addSequenceFlow({ id: "f2j", sourceRef: "approval_2", targetRef: "join" })
      .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "other" })
      .addSequenceFlow({ id: "fbj", sourceRef: "other", targetRef: "join" })
      .addSequenceFlow({ id: "j_e", sourceRef: "join", targetRef: "end" });
    return m;
  }
  function snapshot(m, target) {
    const fork = m.elementOf("fork");
    const edges = fork.get("outgoing");
    const edge = edges.find((f) => f.get("targetRef").get("id") === target);
    return {
      edgeId: edge?.get("id"),
      name: edge?.get("name") ?? null,
      condition: edge?.get("conditionExpression")?.get("body") ?? null,
      defaultId: fork.get("default")?.get("id") ?? null,
      order: edges.map((f) => f.get("id")),
    };
  }
  const observations = [];
  for (const mode of ["condition", "default"]) {
    for (const action of ["single-to-multi", "multi-to-single", "delete-first"]) {
      const m = build(mode, action === "multi-to-single");
      const before = snapshot(m, "approval_1");
      assert.equal(before.edgeId, "fa");
      if (action === "single-to-multi")
        ops.convertApprovalToMulti(m, "approval_1", { collection: "approvers", mode: "all" });
      if (action === "multi-to-single") ops.convertMultiToSingle(m, "approval_1");
      if (action === "delete-first") ops.removeApprovalNode(m, "approval_1");
      const after = snapshot(m, action === "delete-first" ? "approval_2" : "approval_1");
      observations.push({ action, mode, before, after });
    }
  }
  const m = build();
  const original = m.elementOf("approval_1");
  const beforeIds = new Set(m.process.get("flowElements").map((el) => el.get("id")));
  const simulatedBuffers = new Map([["approval_1", "旧对象的未应用输入"]]);
  ops.removeApprovalNode(m, "approval_1");
  const absentImmediatelyAfterDelete = (() => {
    try {
      m.elementOf("approval_1");
      return false;
    } catch {
      return true;
    }
  })();
  const reusedId = ops.insertApprovalAfter(m, "approval_2");
  const afterIds = new Set(m.process.get("flowElements").map((el) => el.get("id")));
  for (const id of beforeIds) if (!afterIds.has(id)) simulatedBuffers.delete(id);
  observations.push({
    action: "delete-then-reuse-before-reconcile",
    reusedId,
    absentImmediatelyAfterDelete,
    sameIdPresentAtReconcile: afterIds.has("approval_1"),
    sameObjectReference: original === m.elementOf("approval_1"),
    staleSimulatedBufferSurvivedIdDiff: simulatedBuffers.has(reusedId),
  });
  const nested = BpmnModel.create({ processId: "review_nested_head", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addExclusiveGateway({ id: "fork" })
    .addExclusiveGateway({ id: "inner" })
    .addUserTask({ id: "i1" })
    .addUserTask({ id: "i2" })
    .addExclusiveGateway({ id: "inner_join" })
    .addUserTask({ id: "tail" })
    .addUserTask({ id: "other" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "end" });
  for (const [id, sourceRef, targetRef] of [
    ["sf", "start", "fork"],
    ["fa", "fork", "inner"],
    ["fb", "fork", "other"],
    ["ii1", "inner", "i1"],
    ["ii2", "inner", "i2"],
    ["i1j", "i1", "inner_join"],
    ["i2j", "i2", "inner_join"],
    ["it", "inner_join", "tail"],
    ["tj", "tail", "join"],
    ["oj", "other", "join"],
    ["je", "join", "end"],
  ])
    nested.addSequenceFlow({
      id,
      sourceRef,
      targetRef,
      ...(id === "fa" ? { name: "采购分支", condition: "${amount > 100}" } : {}),
    });
  const before = snapshot(nested, "inner");
  ops.removeBlock(nested, "inner");
  observations.push({
    action: "remove-nested-block-at-branch-head",
    mode: "condition",
    before,
    after: snapshot(nested, "tail"),
  });
  console.log(
    JSON.stringify({ kind: "diagnostic-observations-not-acceptance-tests", observations }, null, 2),
  );
} finally {
  await server.close();
}
