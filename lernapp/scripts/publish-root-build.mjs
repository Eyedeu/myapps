import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const distRoot = resolve(appRoot, "dist");

for (const target of ["index.html", "assets", "apple-touch-icon.png", "favicon.png", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"]) {
  const outputPath = resolve(appRoot, target);
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true });
  }
}

for (const target of ["index.html", "assets", "apple-touch-icon.png", "favicon.png", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"]) {
  const sourcePath = resolve(distRoot, target);
  if (existsSync(sourcePath)) {
    cpSync(sourcePath, resolve(appRoot, target), { recursive: true });
  }
}

if (existsSync(distRoot)) {
  rmSync(distRoot, { recursive: true, force: true });
}
