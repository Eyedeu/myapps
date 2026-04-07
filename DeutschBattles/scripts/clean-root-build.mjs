import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");

for (const target of ["index.html", "assets"]) {
  const fullPath = resolve(appRoot, target);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true });
  }
}
