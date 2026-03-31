import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { context } from "esbuild";
import { createSharedOptions, indexHtml, rootDir } from "./esbuild.config.mjs";

const outdir = path.join(rootDir, ".esbuild-dev");
await mkdir(outdir, { recursive: true });
await writeFile(path.join(outdir, "index.html"), indexHtml, "utf8");

const ctx = await context(createSharedOptions(outdir));
await ctx.watch();
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
]);

const resolvePath = (requestPath) => {
  const cleanPath = requestPath.split("?")[0].split("#")[0];
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const localPath = path.normalize(path.join(outdir, requested));
  if (!localPath.startsWith(outdir)) {
    return null;
  }
  return localPath;
};

const server = http.createServer(async (req, res) => {
  const requestPath = req.url ?? "/";
  const localPath = resolvePath(requestPath);
  if (!localPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }
    const extension = path.extname(localPath);
    res.writeHead(200, {
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(localPath).pipe(res);
    return;
  } catch {
    // Fall through to SPA index.html fallback.
  }

  const fallbackPath = path.join(outdir, "index.html");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  createReadStream(fallbackPath).pipe(res);
});

const port = 5173;
await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));

console.log(`ADI web dev server running at http://localhost:${port}`);

const shutdown = async () => {
  await new Promise((resolve) => server.close(resolve));
  await ctx.dispose();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
