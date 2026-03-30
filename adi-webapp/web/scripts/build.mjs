import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { createSharedOptions, indexHtml, rootDir } from "./esbuild.config.mjs";

const outdir = path.join(rootDir, "dist");
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({
  ...createSharedOptions(outdir),
  minify: true,
});
await writeFile(path.join(outdir, "index.html"), indexHtml, "utf8");
