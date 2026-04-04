import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = resolve(projectRoot, "dist");
const docsRoot = resolve(projectRoot, "..", "docs");
const targetDir = resolve(docsRoot, "lernapp");

if (!existsSync(distDir)) {
  throw new Error("dist klasoru bulunamadi. Once build calismali.");
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

writeFileSync(resolve(docsRoot, ".nojekyll"), "");

const docsIndex = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MyApps</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #08111f;
        color: #eaf3ff;
        font-family: Segoe UI, sans-serif;
      }
      a {
        color: #7dc6ff;
        text-decoration: none;
        font-size: 20px;
      }
    </style>
  </head>
  <body>
    <a href="./lernapp/">Ausbildung Web App</a>
  </body>
</html>
`;

writeFileSync(resolve(docsRoot, "index.html"), docsIndex);

console.log("GitHub Pages dosyalari docs/lernapp altina kopyalandi.");
