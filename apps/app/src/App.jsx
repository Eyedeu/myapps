import React, { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Compass,
  LayoutGrid,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import appData from "./generated/apps.json";

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

  const apps = appData.apps || [];
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
          <StatCard icon={Star} value={appData.generatedAt ? "Canli" : "-"} label="Tarama durumu" />
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

          <div className="toolbar-note">
            Liste build oncesi otomatik taraniyor. Yeni proje eklediginde sadece
            yeniden build alman yeterli.
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
