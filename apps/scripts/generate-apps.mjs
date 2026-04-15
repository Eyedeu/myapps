import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const parentRoot = path.resolve(workspaceRoot, "..");
const gitConfigFile = path.join(parentRoot, ".git", "config");
const gitHeadFile = path.join(parentRoot, ".git", "HEAD");
const outputDir = path.join(workspaceRoot, "app", "src", "generated");
const outputFile = path.join(outputDir, "apps.json");
const repoFile = path.join(outputDir, "repo.json");

const EXCLUDED_DIRS = new Set([
  "apps",
  ".git",
  ".github",
  "node_modules",
  "github-pages-hub",
]);
const ICON_CANDIDATES = [
  "icon.svg",
  "favicon.svg",
  "favicon.png",
  "apple-touch-icon.png",
  "icon-512.png",
  "icon-192.png",
];

function getGitInfo() {
  try {
    const configText = fs.readFileSync(gitConfigFile, "utf8");
    const headText = fs.readFileSync(gitHeadFile, "utf8").trim();
    const remoteSection = configText.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
    const remoteUrl = remoteSection?.[1]?.trim();
    const branch = headText.startsWith("ref:")
      ? headText.split("/").at(-1)
      : "main";

    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
    if (!match) {
      return {
        owner: "Eyedeu",
        repo: "myapps",
        branch: branch || "main",
      };
    }

    return {
      owner: match[1],
      repo: match[2],
      branch: branch || "main",
    };
  } catch {
    return {
      owner: "Eyedeu",
      repo: "myapps",
      branch: "main",
    };
  }
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeReadText(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    const utf8 = raw.toString("utf8");
    const repaired = Buffer.from(utf8, "latin1").toString("utf8");

    const utf8Markers = (utf8.match(/Ã|Ä|Å/g) || []).length;
    const repairedMarkers = (repaired.match(/Ã|Ä|Å/g) || []).length;

    return repairedMarkers < utf8Markers ? repaired : utf8;
  } catch {
    return "";
  }
}

function firstExistingFile(root, candidates) {
  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate);
    if (fs.existsSync(fullPath)) {
      return candidate;
    }
  }

  return "";
}

function normalizeSummary(value, fallback) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();

  return text || fallback;
}

function inferCategory({ packageJson, manifest, directoryName }) {
  const pool = [
    directoryName,
    packageJson?.name,
    packageJson?.description,
    manifest?.name,
    manifest?.description,
    ...(packageJson?.keywords || []),
    ...(manifest?.categories || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (pool.includes("game") || pool.includes("oyun")) {
    return "Oyun";
  }

  if (pool.includes("map") || pool.includes("widget")) {
    return "Harita";
  }

  if (pool.includes("learn") || pool.includes("education") || pool.includes("ders") || pool.includes("ausbildung")) {
    return "Egitim";
  }

  if (pool.includes("auto") || pool.includes("parca")) {
    return "Uretkenlik";
  }

  return "Deney";
}

function extractReadmeSnippet(root) {
  const readme = safeReadText(path.join(root, "README.md"));
  const lines = readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("```"));

  return lines[0] || "";
}

function extractReadmeTitle(root) {
  const readme = safeReadText(path.join(root, "README.md"));
  const heading = readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return heading ? heading.replace(/^#\s+/, "").trim() : "";
}

function inferAccent(category, directoryName) {
  const key = `${category}-${directoryName}`.toLowerCase();
  const palette = [
    ["#ff8a5b", "#ffd166"],
    ["#5dd39e", "#348aa7"],
    ["#8f7cff", "#4cc9f0"],
    ["#f25f5c", "#f7b267"],
    ["#2a9d8f", "#84a59d"],
  ];

  let total = 0;
  for (const char of key) {
    total += char.charCodeAt(0);
  }

  return palette[total % palette.length];
}

function getAppRecord(directoryName) {
  const appRoot = path.join(parentRoot, directoryName);
  const indexFile = path.join(appRoot, "index.html");
  if (!fs.existsSync(indexFile)) {
    return null;
  }

  const packageJson = safeReadJson(path.join(appRoot, "package.json"));
  const manifest =
    safeReadJson(path.join(appRoot, "manifest.webmanifest")) ||
    safeReadJson(path.join(appRoot, "site.webmanifest")) ||
    safeReadJson(path.join(appRoot, "manifest.json"));

  const title =
    manifest?.name ||
    extractReadmeTitle(appRoot) ||
    manifest?.short_name ||
    packageJson?.name ||
    directoryName;

  const description = normalizeSummary(
    manifest?.description || packageJson?.description || extractReadmeSnippet(appRoot),
    `${title} uygulamasini tek tikla ac.`,
  );

  const category = inferCategory({ packageJson, manifest, directoryName });
  const iconFile = firstExistingFile(appRoot, ICON_CANDIDATES);
  const [accentFrom, accentTo] = inferAccent(category, directoryName);

  return {
    id: directoryName,
    slug: directoryName,
    title,
    category,
    description,
    href: `./${directoryName}/`,
    icon: iconFile ? `./${directoryName}/${iconFile}` : "",
    accentFrom,
    accentTo,
    tags: Array.from(
      new Set(
        [category, ...(packageJson?.keywords || []).slice(0, 3)]
          .filter(Boolean)
          .map((item) => String(item)),
      ),
    ),
  };
}

const directories = fs
  .readdirSync(parentRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name))
  .map((entry) => entry.name);

const apps = directories
  .map(getAppRecord)
  .filter(Boolean)
  .sort((left, right) => left.title.localeCompare(right.title, "tr"));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  outputFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: apps.length,
      apps,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  repoFile,
  JSON.stringify(
    {
      ...(getGitInfo() || {}),
    },
    null,
    2,
  ),
);

console.log(`Generated ${apps.length} app records at ${path.relative(workspaceRoot, outputFile)}`);
