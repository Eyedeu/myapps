import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

const targets = [
  "assets",
  "index.html",
  "favicon.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
];

for (const target of targets) {
  const fullPath = path.join(workspaceRoot, target);
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  fs.rmSync(fullPath, { recursive: true, force: true });
}

console.log("Cleaned previous build output.");
