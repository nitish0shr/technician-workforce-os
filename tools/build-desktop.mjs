/**
 * No-Vite production build.
 *
 * Bundles the client with the standalone esbuild binary and compiles Tailwind with
 * its CLI — both run without the rollup native addon, so the build works on runtimes
 * (e.g. an Electron-bundled Node) where `vite build` cannot load native modules.
 * Output matches what `vite build` produces: a self-contained ./dist the Express
 * server serves on a single port.
 *
 *   node tools/build-desktop.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, rmSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const assets = path.join(dist, "assets");

function findEsbuildBinary() {
  // Resolve the platform esbuild executable (a standalone Go binary — no dlopen).
  const candidates = [];
  const pnpm = path.join(root, "node_modules", ".pnpm");
  if (existsSync(pnpm)) {
    for (const d of readdirSync(pnpm)) {
      if (d.startsWith("@esbuild+")) {
        const inner = path.join(pnpm, d, "node_modules", "@esbuild");
        if (existsSync(inner)) for (const plat of readdirSync(inner)) {
          const bin = path.join(inner, plat, "bin", "esbuild");
          if (existsSync(bin)) candidates.push(bin);
        }
      }
    }
  }
  const direct = path.join(root, "node_modules", "@esbuild");
  if (existsSync(direct)) for (const plat of readdirSync(direct)) {
    const bin = path.join(direct, plat, "bin", "esbuild");
    if (existsSync(bin)) candidates.push(bin);
  }
  if (!candidates.length) throw new Error("esbuild binary not found — run `pnpm install` first.");
  return candidates[0];
}

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`[build] ${label} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return r;
}

console.log("[build] cleaning dist/");
rmSync(dist, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });

const esbuild = findEsbuildBinary();
console.log("[build] bundling client with esbuild …");
run(esbuild, [
  "src/main.tsx",
  "--bundle",
  "--minify",
  "--format=esm",
  "--jsx=automatic",
  "--loader:.css=empty",        // index.css is compiled separately by Tailwind
  "--define:process.env.NODE_ENV=\"production\"",
  "--outfile=dist/assets/app.js",
], "esbuild bundle");

console.log("[build] compiling Tailwind CSS …");
run(process.execPath, [
  "node_modules/tailwindcss/lib/cli.js",
  "-i", "src/index.css",
  "-o", "dist/assets/app.css",
  "--minify",
], "tailwind");

console.log("[build] writing index.html …");
writeFileSync(path.join(dist, "index.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>Technician Workforce OS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`);

const favicon = path.join(root, "public", "favicon.svg");
if (existsSync(favicon)) copyFileSync(favicon, path.join(dist, "favicon.svg"));

const js = statSync(path.join(assets, "app.js")).size;
const css = statSync(path.join(assets, "app.css")).size;
console.log(`[build] done → dist/  (app.js ${(js / 1024).toFixed(0)}kb, app.css ${(css / 1024).toFixed(0)}kb)`);
