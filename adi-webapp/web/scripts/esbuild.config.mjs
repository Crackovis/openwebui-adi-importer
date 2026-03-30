import path from "node:path";

export const rootDir = path.resolve(import.meta.dirname, "..");
export const entryPoint = path.join(rootDir, "src/main.tsx");

export const createSharedOptions = (outdir) => ({
  entryPoints: [entryPoint],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  sourcemap: true,
  outdir,
  entryNames: "assets/main",
  loader: {
    ".png": "file",
    ".svg": "file",
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(process.env.VITE_API_BASE_URL ?? "http://localhost:8787"),
  },
});

export const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>ADI Importer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/main.js"></script>
  </body>
</html>
`;
