/**
 * Assembles _site/ for GitHub Pages: builds Vite apps with the correct base path,
 * copies static sites, and places the apps hub at the site root.
 *
 * GitHub Actions: PAGES_REPO_NAME is set to the repository name (e.g. myapps).
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const siteDir = path.join(root, "_site");

const repoName =
  process.env.PAGES_REPO_NAME ||
  process.env.GITHUB_REPOSITORY?.split("/").pop() ||
  "myapps";

function basePath(segment) {
  const s = segment.replace(/^\/+|\/+$/g, "");
  return `/${repoName}/${s}/`.replace(/\/{2,}/g, "/");
}

function sh(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

function ensureCleanSite() {
  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { recursive: true });
}

function copyDistApp(dirName) {
  const dist = path.join(root, dirName, "dist");
  if (!existsSync(dist)) {
    console.error(`Missing dist for ${dirName}: ${dist}`);
    process.exit(1);
  }
  const dest = path.join(siteDir, dirName);
  mkdirSync(dest, { recursive: true });
  cpSync(dist, dest, { recursive: true });
}

/** Vite projects that emit the site into the package root (outDir: ..). */
function copyRootEmittedApp(dirName) {
  const src = path.join(root, dirName);
  const dest = path.join(siteDir, dirName);
  mkdirSync(dest, { recursive: true });

  const copyIfExists = (name) => {
    const from = path.join(src, name);
    if (!existsSync(from)) return;
    cpSync(from, path.join(dest, name), { recursive: true });
  };

  copyIfExists("index.html");
  copyIfExists("assets");
  copyIfExists("robots.txt");

  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const n = ent.name;
    if (ent.isFile() && /^(icon|favicon|apple-touch|manifest|site\.webmanifest)/i.test(n)) {
      cpSync(path.join(src, n), path.join(dest, n));
    }
    if (ent.isFile() && n.endsWith(".webmanifest")) {
      cpSync(path.join(src, n), path.join(dest, n));
    }
  }
}

function cleanViteParentOut(dirName) {
  const appRoot = path.join(root, dirName);
  for (const name of ["index.html", "assets"]) {
    const p = path.join(appRoot, name);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
}

function copyStaticTree(dirName, destName = dirName) {
  const src = path.join(root, dirName);
  const dest = path.join(siteDir, destName);
  mkdirSync(dest, { recursive: true });
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const n = ent.name;
    if (n === "node_modules" || n === ".git" || n === ".github") continue;
    cpSync(path.join(src, n), path.join(dest, n), { recursive: true });
  }
}

function findViteConfig(dirPath) {
  let found = null;
  for (const ent of readdirSync(dirPath, { withFileTypes: true })) {
    if (ent.isFile() && /^vite\.config\./.test(ent.name)) {
      found = path.join(dirPath, ent.name);
      break;
    }
  }
  return found;
}

/** Skip auto-build when Vite writes outside a `dist/` folder (handled explicitly above). */
function viteEmitsToDistOnly(configPath) {
  const text = readFileSync(configPath, "utf8");
  return !/outDir\s*:\s*["']?\.\./.test(text);
}

/**
 * Any remaining top-level folder with `vite.config.*` and a normal `dist/` build
 * is published automatically so new SPAs do not require editing this script.
 */
function buildDiscoveredViteDistApps(alreadyHandled) {
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory() || alreadyHandled.has(ent.name)) continue;
    const dirPath = path.join(root, ent.name);
    const pkg = path.join(dirPath, "package.json");
    const vc = findViteConfig(dirPath);
    if (!vc || !existsSync(pkg)) continue;
    if (!viteEmitsToDistOnly(vc)) continue;
    console.log(`publish-pages: auto-build Vite app "${ent.name}"`);
    sh(`npm ci && npx vite build --base=${basePath(ent.name)}`, dirPath);
    copyDistApp(ent.name);
    alreadyHandled.add(ent.name);
  }
}

function buildHub() {
  const b = basePath("");
  const hubRoot = path.join(root, "apps");
  sh(`npm ci && npm run build -- --base=${b}`, hubRoot);

  for (const name of ["index.html", "assets"]) {
    const from = path.join(hubRoot, name);
    if (!existsSync(from)) {
      console.error(`apps hub: missing ${name} after build`);
      process.exit(1);
    }
    cpSync(from, path.join(siteDir, name), { recursive: true });
  }

  for (const ent of readdirSync(hubRoot, { withFileTypes: true })) {
    const n = ent.name;
    if (!ent.isFile()) continue;
    if (
      /^(icon|favicon|apple-touch|manifest|site\.webmanifest)/i.test(n) ||
      n.endsWith(".webmanifest")
    ) {
      cpSync(path.join(hubRoot, n), path.join(siteDir, n));
    }
  }
}

ensureCleanSite();

const handled = new Set([
  ".git",
  ".github",
  "node_modules",
  "apps",
  "github-pages-hub",
  "scripts",
  "mapget",
  "DeutschBattles",
  "lernapp",
  "ProofAdvice",
  "bubble-pop-mania",
]);

const viteDistApps = ["oddbridge", "floret", "scoop", "Autoteile"];

for (const dirName of viteDistApps) {
  handled.add(dirName);
  sh(
    `npm ci && npx vite build --base=${basePath(dirName)}`,
    path.join(root, dirName),
  );
  copyDistApp(dirName);
}

buildDiscoveredViteDistApps(handled);

for (const ent of readdirSync(root, { withFileTypes: true })) {
  if (!ent.isDirectory() || handled.has(ent.name)) continue;
  const dirPath = path.join(root, ent.name);
  if (!existsSync(path.join(dirPath, "index.html"))) continue;
  if (existsSync(path.join(dirPath, "package.json"))) continue;
  console.log(`publish-pages: static copy "${ent.name}"`);
  copyStaticTree(ent.name);
  handled.add(ent.name);
}

cleanViteParentOut("mapget");
sh(`npm ci && npx vite build --base=${basePath("mapget")}`, path.join(root, "mapget"));
copyRootEmittedApp("mapget");

sh(
  `npm ci && node scripts/clean-root-build.mjs && npx vite build --base=${basePath("DeutschBattles")}`,
  path.join(root, "DeutschBattles"),
);
copyRootEmittedApp("DeutschBattles");

sh(
  `npm ci && node scripts/clean-root-build.mjs && npx vite build --base=${basePath("lernapp")} && node scripts/publish-root-build.mjs`,
  path.join(root, "lernapp"),
);
copyRootEmittedApp("lernapp");

buildHub();

copyStaticTree("ProofAdvice");
copyStaticTree("bubble-pop-mania");

console.log(`_site ready under ${path.relative(root, siteDir)} (repo base: /${repoName}/)`);
