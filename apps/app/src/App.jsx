import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Compass,
  LayoutGrid,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import appData from "./generated/apps.json";
import repoData from "./generated/repo.json";

function normalizeText(value) {
  return String(value || "").toLocaleLowerCase("tr").trim();
}

function initialsFromTitle(title) {
  return String(title || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const ICON_CANDIDATES = [
  "icon.svg",
  "favicon.svg",
  "favicon.png",
  "apple-touch-icon.png",
  "icon-512.png",
  "icon-192.png",
];

function normalizeSummary(value, fallback) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
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

async function safeFetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function safeFetchText(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return "";
    }
    return response.text();
  } catch {
    return "";
  }
}

function extractReadmeTitle(readmeText) {
  const heading = String(readmeText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return heading ? heading.replace(/^#\s+/, "").trim() : "";
}

function extractReadmeSnippet(readmeText) {
  const lines = String(readmeText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("```"));

  return lines[0] || "";
}

async function buildRuntimeCatalog() {
  const { owner, repo, branch } = repoData || {};
  if (!owner || !repo || !branch) {
    return null;
  }

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treePayload = await safeFetchJson(treeUrl);
  const tree = treePayload?.tree || [];
  if (!tree.length) {
    return null;
  }

  const rootDirectories = Array.from(
    new Set(
      tree
        .filter((item) => item.type === "blob" && item.path.split("/").length === 2)
        .map((item) => item.path.split("/")[0]),
    ),
  ).filter((name) => !["apps", ".github"].includes(name));

  const appDirectories = rootDirectories.filter((directoryName) =>
    tree.some((item) => item.path === `${directoryName}/index.html`),
  );

  const apps = await Promise.all(
    appDirectories.map(async (directoryName) => {
      const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${directoryName}`;
      const packageJson = await safeFetchJson(`${rawBase}/package.json`);
      const manifest =
        (await safeFetchJson(`${rawBase}/manifest.webmanifest`)) ||
        (await safeFetchJson(`${rawBase}/site.webmanifest`)) ||
        (await safeFetchJson(`${rawBase}/manifest.json`));
      const readmeText = await safeFetchText(`${rawBase}/README.md`);

      const title =
        manifest?.name ||
        extractReadmeTitle(readmeText) ||
        manifest?.short_name ||
        packageJson?.name ||
        directoryName;

      const description = normalizeSummary(
        manifest?.description || packageJson?.description || extractReadmeSnippet(readmeText),
        `${title} uygulamasini tek tikla ac.`,
      );

      const category = inferCategory({ packageJson, manifest, directoryName });
      const [accentFrom, accentTo] = inferAccent(category, directoryName);
      const iconFile = ICON_CANDIDATES.find((candidate) =>
        tree.some((item) => item.path === `${directoryName}/${candidate}`),
      );

      return {
        id: directoryName,
        slug: directoryName,
        title,
        category,
        description,
        href: `../${directoryName}/`,
        icon: iconFile ? `../${directoryName}/${iconFile}` : "",
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
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    count: apps.length,
    apps: apps.sort((left, right) => left.title.localeCompare(right.title, "tr")),
  };
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function AppCard({ app }) {
  return (
    <a
      className="app-card"
      href={app.href}
      target="_blank"
      rel="noreferrer"
      style={{
        "--card-from": app.accentFrom,
        "--card-to": app.accentTo,
      }}
    >
      <div className="card-glow" />

      <div className="card-topline">
        <span className="app-category">{app.category}</span>
        <span className="launch-pill">
          Ac
          <ArrowUpRight size={15} />
        </span>
      </div>

      <div className="app-identity">
        {app.icon ? (
          <div className="app-logo image">
            <img src={app.icon} alt={`${app.title} ikonu`} />
          </div>
        ) : (
          <div className="app-logo fallback">{initialsFromTitle(app.title)}</div>
        )}

        <div>
          <h2>{app.title}</h2>
          <p>{app.description}</p>
        </div>
      </div>

      <div className="tag-row">
        {app.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <div className="empty-icon">
        <Compass size={28} />
      </div>
      <h2>Henuz listelenecek uygulama bulunamadi</h2>
      <p>
        Apps disindaki kardes klasorlere index.html iceren yeni bir uygulama
        eklediginde bu merkez onu build sirasinda otomatik algilar.
      </p>
    </section>
  );
}

function App() {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState(appData);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function syncCatalog() {
      setSyncing(true);
      setSyncError("");
      const runtimeCatalog = await buildRuntimeCatalog();
      if (!cancelled && runtimeCatalog?.apps?.length) {
        setCatalog(runtimeCatalog);
      }
      if (!cancelled && !runtimeCatalog?.apps?.length) {
        setSyncError("Guncel listeye simdi ulasilamadi.");
      }
      if (!cancelled) {
        setSyncing(false);
      }
    }

    syncCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const apps = catalog.apps || [];
  const filteredApps = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return apps;
    }

    return apps.filter((app) => {
      const haystack = normalizeText(
        [app.title, app.category, app.description, ...(app.tags || [])].join(" "),
      );

      return haystack.includes(normalizedQuery);
    });
  }, [apps, query]);

  const categories = useMemo(
    () => Array.from(new Set(apps.map((app) => app.category))).length,
    [apps],
  );

  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={14} />
            Kisisel uygulama merkezi
          </div>
          <h1>Tum projelerin tek ekranda.</h1>
          <p>
            Yeni uygulamalar ekledikce bu merkezde listelenir; sen de tek tikla
            istedigin uygulamayi acarsin.
          </p>
        </div>

        <div className="hero-panel">
          <StatCard icon={LayoutGrid} value={apps.length} label="Toplam uygulama" />
          <StatCard icon={Boxes} value={categories} label="Kategori" />
          <StatCard
            icon={Star}
            value={syncing ? "Esitleniyor" : catalog.generatedAt ? "Guncel" : "-"}
            label="Tarama durumu"
          />
        </div>
      </header>

      <main className="content">
        <section className="toolbar">
          <label className="searchbox">
            <Search size={18} />
            <input
              type="search"
              placeholder="Uygulama, kategori veya etiket ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="toolbar-actions">
            <button
              className="refresh-button"
              type="button"
              onClick={async () => {
                setSyncing(true);
                setSyncError("");
                const runtimeCatalog = await buildRuntimeCatalog();
                if (runtimeCatalog?.apps?.length) {
                  setCatalog(runtimeCatalog);
                } else {
                  setSyncError("Guncel listeye simdi ulasilamadi.");
                }
                setSyncing(false);
              }}
              disabled={syncing}
            >
              {syncing ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
              Listeyi yenile
            </button>

            <div className="toolbar-note">
              {syncing ? (
                <>Depodaki guncel uygulamalar kontrol ediliyor.</>
              ) : syncError ? (
                syncError
              ) : (
                "Uygulama acildiginda depodaki guncel klasorler kontrol edilir. Yeni proje ekleyip pushladiginda yeniden listelenebilir."
              )}
            </div>
          </div>
        </section>

        {filteredApps.length ? (
          <section className="app-grid">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </section>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

export default App;
