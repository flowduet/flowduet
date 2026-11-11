import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, extname, join, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";

// 仅向回环地址提供冻结的既有 Playground 构建；没有浏览器控制接口。
const here = fileURLToPath(new URL("./", import.meta.url));
const [distArg, outputArg, portArg = "4187"] = process.argv.slice(2);
if (!distArg || !outputArg) throw new Error("用法：node serve.mjs <冻结 dist> <结果目录> [端口]");
const dist = resolve(distArg);
const output = resolve(outputArg);
const port = Number(portArg);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("端口无效");
const origin = `http://127.0.0.1:${port}`;
const observer = await readFile(join(here, "observe.js"), "utf8");
const index = await readFile(join(dist, "index.html"), "utf8");
const hashes = {};
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await hashTree(path);
    else
      hashes[path.slice(dist.length + 1)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
  }
}
await hashTree(dist);
const config = {
  baseline: "12806acd623aea3afc16ae3ea1a07e7fb7a32bd1",
  origin,
  preparedAt: new Date().toISOString(),
  observerSha256: createHash("sha256").update(observer).digest("hex"),
  buildHashes: hashes,
  method: "人工操作；无 CDP/WebDriver/CUA 控制；事件记录只读，isTrusted 本身不证明物理按键来源",
};
await mkdir(output, { recursive: true });
await writeFile(join(output, "preparation.json"), JSON.stringify(config, null, 2) + "\n");
let loaded = false;
let received = false;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  const send = (code, body, type = "text/plain; charset=utf-8") => {
    response.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(body);
  };
  try {
    if (request.headers.host !== `127.0.0.1:${port}`) return send(403, "只接受指定回环地址");
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    if (request.method === "POST" && pathname === "/__ime-record") {
      if (request.headers.origin !== origin || received) return send(403, "来源不符或本轮已交回");
      let body = "";
      request.setEncoding("utf8");
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 2_000_000) return send(413, "记录超限，本轮停止");
      }
      const record = JSON.parse(body);
      if (
        !Array.isArray(record.rows) ||
        record.rows.length > 810 ||
        record.config?.observerSha256 !== config.observerSha256
      )
        return send(400, "记录格式不符");
      await writeFile(
        join(output, "manual-result.json"),
        JSON.stringify(
          { receivedAt: new Date().toISOString(), preparation: config, record },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      received = true;
      console.log("本轮记录已交回：", join(output, "manual-result.json"));
      return send(200, "已交回");
    }
    if (request.method !== "GET") return send(405, "不支持的方法");
    if (pathname === "/__ime-observe.js") return send(200, observer, contentTypes[".js"]);
    if (pathname === "/" || pathname === "/index.html") {
      if (loaded)
        return send(409, "本轮页面已加载；刷新会破坏连续证据。停止并回聊天说明，不另开一轮。");
      loaded = true;
      const injection = `<script type="application/json" id="ime-observer-config">${JSON.stringify(config).replaceAll("<", "\\u003c")}</script><script type="module" src="/__ime-observe.js"></script>`;
      return send(200, index.replace("</body>", `${injection}</body>`), contentTypes[".html"]);
    }
    const path = resolve(dist, `.${pathname}`);
    if (!path.startsWith(dist + sep)) return send(403, "路径越界");
    const relativePath = path.slice(dist.length + 1);
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== hashes[relativePath])
      return send(409, "冻结资产已改变，本轮停止，不重新开始");
    return send(200, bytes, contentTypes[extname(path)] ?? "application/octet-stream");
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) send(400, "读取或保存失败；保留现状并回聊天说明");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => console.log(`人工验收地址：${origin}（只允许加载一次）`));
