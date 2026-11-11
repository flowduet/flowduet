import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function buildArtifacts(directory) {
  const artifacts = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile())
        artifacts.push({
          path,
          servedPath: relative(directory, path).split(sep).join("/"),
          sha256: sha256(await readFile(path)),
        });
    }
  }
  await walk(directory);
  return artifacts.sort((a, b) => a.servedPath.localeCompare(b.servedPath));
}

export async function verifyArtifacts(verificationPath) {
  const bytes = await readFile(verificationPath);
  const verification = JSON.parse(bytes);
  const packages = ["@flowduet/core", "@flowduet/designer", "@flowduet/form-create"];
  if (
    !Array.isArray(verification.tarballs) ||
    verification.tarballs.length !== 3 ||
    packages.some(
      (name) => verification.tarballs.filter((item) => item?.package === name).length !== 1,
    )
  )
    throw new Error("必须提供本次三包的唯一 tarball 哈希");
  if (
    !Array.isArray(verification.buildArtifacts) ||
    !verification.buildArtifacts.some((item) => item?.servedPath === "contracts.html")
  )
    throw new Error("缺少公开合同的构建产物清单");
  for (const artifact of [...verification.tarballs, ...verification.buildArtifacts]) {
    if (typeof artifact?.path !== "string" || !/^[a-f0-9]{64}$/.test(artifact?.sha256))
      throw new Error("无效产物路径或 SHA-256");
    if (sha256(await readFile(artifact.path)) !== artifact.sha256)
      throw new Error(`产物哈希不匹配：${artifact.path}`);
  }
  return { verification, artifactId: sha256(bytes) };
}
