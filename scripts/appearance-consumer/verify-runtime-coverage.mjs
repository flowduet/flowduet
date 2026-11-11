import { readFile, writeFile } from "node:fs/promises";
import { requiredRuntime } from "./required-runtime.mjs";
import { verifyArtifacts } from "./artifacts.mjs";

const [verificationPath, receiptPath, outputPath, risksPath] = process.argv.slice(2);
if (!verificationPath || !receiptPath || !outputPath)
  throw new Error("需要 verification.json、运行回执和汇总输出路径");
const problems = [];
let receipt;
let risks = [];
try {
  receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt))
    throw new Error("回执须为对象");
} catch (error) {
  receipt = {};
  problems.push(`无法读取执行回执：${error.message}`);
}
let artifactId;
try {
  ({ artifactId } = await verifyArtifacts(verificationPath));
  if (receipt.artifactId !== artifactId) problems.push("运行回执不属于本次产物");
} catch (error) {
  problems.push(error.message);
}
try {
  risks = risksPath ? JSON.parse(await readFile(risksPath, "utf8")) : [];
  if (!Array.isArray(risks)) throw new Error("风险接受文件须为逐项数组");
} catch (error) {
  risks = [];
  problems.push(`无法读取风险接受：${error.message}`);
}
for (const risk of risks) {
  if (
    !requiredRuntime.some((required) => required.id === risk?.id) ||
    !artifactId ||
    risk?.artifactId !== artifactId ||
    risks.filter((other) => other?.id === risk?.id).length !== 1 ||
    typeof risk?.reason !== "string" ||
    !risk.reason.trim() ||
    typeof risk.authorization !== "string" ||
    !risk.authorization.trim()
  )
    problems.push("风险接受缺少唯一必验项、理由或授权来源");
}
const supplied = Array.isArray(receipt.checks) ? receipt.checks : [];
for (const check of supplied) {
  if (!requiredRuntime.some((required) => required.id === check?.id))
    problems.push(`未知必验项：${check?.id}`);
}
for (const key of ["errors", "failures"]) {
  if (!Array.isArray(receipt[key]) || receipt[key].length)
    problems.push(`运行回执 ${key} 非空或缺失`);
}
const checks = requiredRuntime.map((required) => {
  const matches = supplied.filter((check) => check?.id === required.id);
  if (matches.length !== 1) problems.push(`${required.id} 回执数量为 ${matches.length}`);
  const check = matches[0] ?? { status: "not-executed" };
  if (!["passed", "failed", "not-executed"].includes(check.status))
    problems.push(`${required.id} 缺少有效结果`);
  if (
    check.status === "passed" &&
    (!check.evidence || typeof check.evidence !== "object" || !Object.keys(check.evidence).length)
  )
    problems.push(`${required.id} 缺少执行证据`);
  const risk = risks.find((risk) => risk?.id === required.id);
  if (risk && check.status !== "failed") problems.push(`${required.id} 风险接受不能替代执行回执`);
  if (risk && check.status === "failed" && typeof check.error === "string" && check.error.trim())
    return { ...check, ...required, status: "accepted-risk", risk };
  return { ...check, ...required };
});
const passed = problems.length === 0 && checks.every((check) => check.status === "passed");
const complete =
  problems.length === 0 &&
  checks.every((check) => ["passed", "accepted-risk"].includes(check.status));
await writeFile(
  outputPath,
  JSON.stringify(
    {
      artifactId,
      complete,
      passed,
      outcome: !complete ? "incomplete" : passed ? "passed" : "complete-with-accepted-risk",
      checks,
      problems,
    },
    null,
    2,
  ),
);
if (!complete) process.exitCode = 1;
