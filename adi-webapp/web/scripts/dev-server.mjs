import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { context } from "esbuild";
import { createSharedOptions, indexHtml, rootDir } from "./esbuild.config.mjs";

const outdir = path.join(rootDir, ".esbuild-dev");
await mkdir(outdir, { recursive: true });
await writeFile(path.join(outdir, "index.html"), indexHtml, "utf8");

const ctx = await context(createSharedOptions(outdir));
await ctx.watch();
const { port } = await ctx.serve({ servedir: outdir, host: "0.0.0.0", port: 5173 });

console.log(`ADI web dev server running at http://localhost:${port}`);

const shutdown = async () => {
  await ctx.dispose();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
