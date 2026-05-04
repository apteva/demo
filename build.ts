import { $, type BunPlugin } from "bun";
import { rmSync, mkdirSync } from "fs";
import { resolve } from "path";

// ─── Workspace package aliases ───
//
// The demo bundles components from sibling packages (@apteva/ui-kit,
// @apteva/integrations) without going through npm-link or workspaces.
// This plugin rewrites the bare specifiers to absolute paths inside
// the monorepo. Anything imported transitively (e.g. integrations'
// hubspot DealCard imports @apteva/ui-kit) resolves through the same
// rules.

const ROOT = resolve(import.meta.dir, "..");
const DEMO_NODE_MODULES = resolve(import.meta.dir, "node_modules");

// React / react-dom must resolve from demo's own node_modules, not
// from the sibling repos we alias into. ui-kit/ and integrations/
// don't keep their own node_modules (the workspace has no top-level
// one either), so Bun would otherwise fail to find react when it
// walks up from ui-kit/src/*.tsx. Pinning these here keeps a single
// React copy in the bundle and matches the importmap pattern the
// dashboard uses for runtime UI panels.
const ALIASES: Record<string, string> = {
  "@apteva/ui-kit": resolve(ROOT, "ui-kit/src/index.ts"),
  "react": resolve(DEMO_NODE_MODULES, "react/index.js"),
  "react/jsx-runtime": resolve(DEMO_NODE_MODULES, "react/jsx-runtime.js"),
  "react/jsx-dev-runtime": resolve(DEMO_NODE_MODULES, "react/jsx-dev-runtime.js"),
  "react-dom": resolve(DEMO_NODE_MODULES, "react-dom/index.js"),
  "react-dom/client": resolve(DEMO_NODE_MODULES, "react-dom/client.js"),
};
// Subpath alias: anything under @apteva/integrations/<x> resolves to
// integrations/src/<x>(.ts|.tsx) — TS-style implicit extensions.
const SUBPATH_ALIASES: Record<string, string> = {
  "@apteva/integrations": resolve(ROOT, "integrations/src"),
};

const aliasPlugin: BunPlugin = {
  name: "workspace-aliases",
  setup(build) {
    // Exact matches
    for (const [spec, target] of Object.entries(ALIASES)) {
      const re = new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
      build.onResolve({ filter: re }, () => ({ path: target }));
    }
    // Subpath matches (e.g. "@apteva/integrations/ui/hubspot/DealCard")
    for (const [spec, base] of Object.entries(SUBPATH_ALIASES)) {
      const re = new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(.+)$`);
      build.onResolve({ filter: re }, (args) => {
        const m = re.exec(args.path)!;
        const rel = m[1]!;
        // Try the path as-given, then with .tsx, .ts, .js, /index.tsx
        const candidates = [rel, `${rel}.tsx`, `${rel}.ts`, `${rel}.js`, `${rel}/index.tsx`, `${rel}/index.ts`];
        for (const c of candidates) {
          const full = resolve(base, c);
          if (Bun.file(full).size > 0) return { path: full };
        }
        return { path: resolve(base, rel) };
      });
    }
  },
};

rmSync("./dist", { recursive: true, force: true });
mkdirSync("./dist", { recursive: true });

console.log("Building CSS...");
await $`bunx @tailwindcss/cli -i ./src/index.css -o ./dist/style.css --minify`.quiet();

// Runtime config baked at build time.
//   API_BASE          — prefix for all server calls (default: same-origin `/api`)
//   DEFAULT_PROJECT   — optional; deep-links to a single project's instances
const API_BASE = process.env.API_BASE || "/api";
const DEFAULT_PROJECT = process.env.DEFAULT_PROJECT || "";

console.log(`Building JS... (API_BASE=${API_BASE}${DEFAULT_PROJECT ? `, DEFAULT_PROJECT=${DEFAULT_PROJECT}` : ""})`);

const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "linked",
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
    __DEFAULT_PROJECT__: JSON.stringify(DEFAULT_PROJECT),
  },
  naming: {
    entry: "[name]-[hash].[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
  plugins: [aliasPlugin],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const jsOutput = result.outputs.find((o) => o.path.endsWith(".js"));
const jsFile = jsOutput ? jsOutput.path.split("/").pop() : "main.js";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apteva</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${jsFile}"></script>
  </body>
</html>`;

await Bun.write("./dist/index.html", html);

console.log("\nBuild complete:");
for (const output of result.outputs) {
  const size = (output.size / 1024).toFixed(1);
  console.log(`  ${output.path.split("/").pop()} (${size} KB)`);
}
console.log("  style.css");
console.log("  index.html");
