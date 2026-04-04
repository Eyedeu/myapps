import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..");
const distDir = resolve(appRoot, "dist");
const worktreeDir = resolve(appRoot, ".pages-worktree");
const targetAppDir = resolve(worktreeDir, "lernapp");

function run(command, cwd = repoRoot) {
  return execSync(command, {
    cwd,
    stdio: "pipe",
    encoding: "utf8"
  }).trim();
}

function runStreaming(command, cwd = repoRoot) {
  execSync(command, {
    cwd,
    stdio: "inherit",
    encoding: "utf8"
  });
}

if (!existsSync(distDir)) {
  throw new Error("dist klasoru bulunamadi. Once npm run build calistir.");
}

const remoteUrl = run("git config --get remote.origin.url");
const hasRemoteBranch =
  run('git ls-remote --heads origin gh-pages').length > 0;

rmSync(worktreeDir, { recursive: true, force: true });

if (hasRemoteBranch) {
  runStreaming(`git clone --branch gh-pages --single-branch "${remoteUrl}" "${worktreeDir}"`);
} else {
  mkdirSync(worktreeDir, { recursive: true });
  runStreaming("git init", worktreeDir);
  runStreaming("git checkout -b gh-pages", worktreeDir);
  runStreaming(`git remote add origin "${remoteUrl}"`, worktreeDir);
}

rmSync(targetAppDir, { recursive: true, force: true });
mkdirSync(targetAppDir, { recursive: true });
cpSync(distDir, targetAppDir, { recursive: true });
writeFileSync(resolve(worktreeDir, ".nojekyll"), "");

runStreaming("git add -A", worktreeDir);

const hasChanges = run("git status --porcelain", worktreeDir).length > 0;

if (!hasChanges) {
  console.log("gh-pages branch icin yeni degisiklik yok.");
  process.exit(0);
}

runStreaming('git commit -m "Deploy lernapp"', worktreeDir);
runStreaming("git push origin gh-pages", worktreeDir);

console.log("lernapp GitHub Pages icin gh-pages branch altina yayinlandi.");
