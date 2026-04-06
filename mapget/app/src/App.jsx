import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const STORAGE_KEY = "mapget.savedLocations.v1";
const MAX_LOCATIONS = 10;
const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };

function buildGoogleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function buildScriptableCode(locations) {
  const serializedLocations = JSON.stringify(
    locations.map((location) => ({
      id: location.id,
      name: location.name,
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
      url: buildGoogleMapsUrl(location.lat, location.lng),
    })),
    null,
    2,
  );

  return `const LOCATIONS = ${serializedLocations};

const palette = {
  bgStart: new Color("#0f172a"),
  bgEnd: new Color("#111827"),
  card: new Color("#172033", 0.92),
  muted: new Color("#9ca3af"),
  text: Color.white(),
  accent: new Color("#38bdf8"),
  accentSoft: new Color("#0ea5e9", 0.18),
  border: new Color("#334155", 0.6),
};

function maxVisibleItems() {
  const family = config.widgetFamily || "medium";
  if (family === "small") return 1;
  if (family === "large") return 8;
  return 5;
}

function addRow(widget, location, index) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.backgroundColor = palette.card;
  row.cornerRadius = 14;
  row.borderColor = palette.border;
  row.borderWidth = 1;
  row.setPadding(10, 12, 10, 12);
  row.url = location.url;

  const badge = row.addStack();
  badge.size = new Size(22, 22);
  badge.cornerRadius = 11;
  badge.backgroundColor = palette.accentSoft;
  badge.centerAlignContent();
  const badgeText = badge.addText(String(index + 1));
  badgeText.font = Font.boldSystemFont(11);
  badgeText.textColor = palette.accent;

  row.addSpacer(10);

  const textStack = row.addStack();
  textStack.layoutVertically();
  textStack.spacing = 2;
  const title = textStack.addText(location.name);
  title.font = Font.semiboldSystemFont(13);
  title.textColor = palette.text;
  title.lineLimit = 1;

  const subtitle = textStack.addText("Google Maps'te rota ac");
  subtitle.font = Font.systemFont(10);
  subtitle.textColor = palette.muted;
  subtitle.lineLimit = 1;

  row.addSpacer();

  const arrow = row.addText(">");
  arrow.font = Font.boldSystemFont(18);
  arrow.textColor = palette.accent;
}

const widget = new ListWidget();
const gradient = new LinearGradient();
gradient.colors = [palette.bgStart, palette.bgEnd];
gradient.locations = [0, 1];
widget.backgroundGradient = gradient;
widget.setPadding(16, 16, 16, 16);

const header = widget.addStack();
header.layoutHorizontally();
header.centerAlignContent();

const titleStack = header.addStack();
titleStack.layoutVertically();

const title = titleStack.addText("MapGet");
title.font = Font.boldSystemFont(18);
title.textColor = palette.text;

const caption = titleStack.addText("Hizli rota widget'i");
caption.font = Font.systemFont(10);
caption.textColor = palette.muted;

header.addSpacer();

const countChip = header.addStack();
countChip.backgroundColor = palette.accentSoft;
countChip.cornerRadius = 12;
countChip.setPadding(6, 10, 6, 10);
const countText = countChip.addText(String(Math.min(LOCATIONS.length, maxVisibleItems())) + " konum");
countText.font = Font.semiboldSystemFont(11);
countText.textColor = palette.accent;

widget.addSpacer(12);

const visibleLocations = LOCATIONS.slice(0, maxVisibleItems());
visibleLocations.forEach((location, index) => {
  addRow(widget, location, index);
  if (index < visibleLocations.length - 1) widget.addSpacer(8);
});

if (visibleLocations.length === 0) {
  const empty = widget.addText("Bu script icin once konum ekle.");
  empty.textColor = palette.muted;
  empty.font = Font.systemFont(12);
}

if (!config.runsInWidget) {
  await widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();
`;
}

function App() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(DEFAULT_CENTER);
  const [selectedName, setSelectedName] = useState("Istanbul");
  const [savedLocations, setSavedLocations] = useState([]);
  const [scriptCode, setScriptCode] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseLoading, setIsReverseLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Haritadan sec ya da arama yapip listene ekle.",
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedLocations(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    setScriptCode(savedLocations.length ? buildScriptableCode(savedLocations) : "");
  }, [savedLocations]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    mapRef.current = map;

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    const handlePositionUpdate = async (lat, lng, nextMessage) => {
      marker.setLatLng([lat, lng]);
      setSelectedCoords({ lat, lng });
      setStatusMessage(nextMessage);
      await reverseGeocode(lat, lng);
    };

    map.on("click", async (event) => {
      await handlePositionUpdate(
        event.latlng.lat,
        event.latlng.lng,
        "Konum secildi. Isim aliniyor...",
      );
    });

    marker.on("dragend", async (event) => {
      const next = event.target.getLatLng();
      await handlePositionUpdate(next.lat, next.lng, "Isaretci tasindi. Konum guncelleniyor...");
    });

    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  async function reverseGeocode(lat, lng) {
    setIsReverseLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );

      if (!response.ok) {
        throw new Error("reverse geocode failed");
      }

      const data = await response.json();
      const address = data.address || {};
      const nextName =
        address.amenity ||
        address.shop ||
        address.building ||
        address.road ||
        address.suburb ||
        address.village ||
        address.town ||
        address.city ||
        data.name ||
        (data.display_name ? data.display_name.split(",")[0] : null) ||
        `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      setSelectedName(nextName);
      setStatusMessage("Konum hazir. Listeye ekleyebilirsin.");
    } catch {
      setSelectedName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setStatusMessage("Konum secildi fakat isim alinamadi. Koordinat ile kaydedebilirsin.");
    } finally {
      setIsReverseLoading(false);
    }
  }

  async function searchLocation(event) {
    event.preventDefault();
    if (!query.trim() || !mapRef.current) {
      return;
    }

    setIsSearching(true);
    setStatusMessage("Araniyor...");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
          query.trim(),
        )}`,
      );

      if (!response.ok) {
        throw new Error("search failed");
      }

      const results = await response.json();
      if (!results.length) {
        setStatusMessage("Sonuc bulunamadi. Farkli bir arama dene.");
        return;
      }

      const first = results[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
      markerRef.current?.setLatLng([lat, lng]);
      setSelectedCoords({ lat, lng });
      setSelectedName(first.display_name.split(",")[0]);
      setStatusMessage("Arama sonucu secildi. Listeye ekleyebilirsin.");
    } catch {
      setStatusMessage("Arama sirasinda bir hata oldu. Tekrar dene.");
    } finally {
      setIsSearching(false);
    }
  }

  function addSelectedLocation() {
    if (savedLocations.length >= MAX_LOCATIONS) {
      setStatusMessage(`En fazla ${MAX_LOCATIONS} konum saklanabilir.`);
      return;
    }

    const duplicate = savedLocations.some(
      (item) =>
        Math.abs(item.lat - selectedCoords.lat) < 0.00001 &&
        Math.abs(item.lng - selectedCoords.lng) < 0.00001,
    );

    if (duplicate) {
      setStatusMessage("Bu konum zaten listede.");
      return;
    }

    const nextLocation = {
      id: crypto.randomUUID(),
      name: selectedName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
    };

    setSavedLocations((current) => [...current, nextLocation]);
    setStatusMessage("Konum widget listesine eklendi.");
  }

  function removeLocation(id) {
    setSavedLocations((current) => current.filter((item) => item.id !== id));
  }

  function moveLocation(id, direction) {
    setSavedLocations((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function clearLocations() {
    setSavedLocations([]);
    setStatusMessage("Kayitli konumlar temizlendi.");
  }

  async function copyCode() {
    if (!scriptCode) {
      return;
    }

    await navigator.clipboard.writeText(scriptCode);
    setCopySuccess(true);
    window.setTimeout(() => setCopySuccess(false), 2000);
  }

  const helperText = useMemo(() => {
    if (savedLocations.length === 0) {
      return "Widget olusturmak icin en az 1 konum ekle.";
    }

    return "Medium widget ilk 5 konumu, large widget ilk 8 konumu gosterir.";
  }, [savedLocations.length]);

  return (
    <div className="app-shell">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">MapGet for iPhone</span>
          <h1>Tek dokunusla Google Maps rota widget'i uret.</h1>
          <p>
            Konumlarini sec, listele ve Scriptable icin hazir widget kodunu al.
            Ardindan iPhone ana ekranina medium veya large widget olarak ekle.
          </p>
        </div>

        <div className="stats-card">
          <div>
            <strong>{savedLocations.length}</strong>
            <span>kayitli konum</span>
          </div>
          <div>
            <strong>5</strong>
            <span>medium widget satiri</span>
          </div>
          <div>
            <strong>8</strong>
            <span>large widget satiri</span>
          </div>
        </div>
      </div>

      <div className="workspace">
        <section className="map-panel">
          <form className="search-bar" onSubmit={searchLocation}>
            <Search size={18} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Konum veya mekan ara"
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? "Araniyor" : "Bul"}
            </button>
          </form>

          <div className="map-wrap">
            <div ref={mapElementRef} className="map-canvas" />
            {!mapReady && <div className="map-loading">Harita yukleniyor...</div>}
          </div>

          <div className="selection-card">
            <div className="selection-header">
              <div>
                <span className="label">Secilen nokta</span>
                <h2>{selectedName}</h2>
              </div>
              <div className="coords">
                {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
              </div>
            </div>

            <p className="status-line">
              {isReverseLoading ? "Konum ismi aliniyor..." : statusMessage}
            </p>

            <div className="selection-actions">
              <button className="primary-action" type="button" onClick={addSelectedLocation}>
                <Plus size={18} />
                <span>Listeye ekle</span>
              </button>

              <a
                className="ghost-action"
                href={buildGoogleMapsUrl(selectedCoords.lat, selectedCoords.lng)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={18} />
                <span>Rotayi test et</span>
              </a>
            </div>
          </div>
        </section>

        <section className="side-panel">
          <div className="panel-card">
            <div className="panel-heading">
              <div>
                <span className="label">Widget listesi</span>
                <h3>Kayitli konumlar</h3>
              </div>
              {savedLocations.length > 0 && (
                <button className="text-action danger" type="button" onClick={clearLocations}>
                  Temizle
                </button>
              )}
            </div>

            <p className="panel-note">{helperText}</p>

            <div className="saved-list">
              {savedLocations.length === 0 ? (
                <div className="empty-state">
                  <MapPin size={20} />
                  <p>Henuz konum eklenmedi.</p>
                </div>
              ) : (
                savedLocations.map((location, index) => (
                  <div className="saved-item" key={location.id}>
                    <div className="saved-index">{index + 1}</div>
                    <div className="saved-copy">
                      <strong>{location.name}</strong>
                      <span>
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </span>
                    </div>
                    <div className="saved-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Yukari tasi"
                        onClick={() => moveLocation(location.id, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Asagi tasi"
                        onClick={() => moveLocation(location.id, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label="Sil"
                        onClick={() => removeLocation(location.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <div>
                <span className="label">Scriptable</span>
                <h3>Widget kodu</h3>
              </div>
              <button
                className="copy-button"
                type="button"
                onClick={copyCode}
                disabled={!scriptCode}
              >
                {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                <span>{copySuccess ? "Kopyalandi" : "Kopyala"}</span>
              </button>
            </div>

            <pre className="code-block">
              {scriptCode || "// Scriptable kodu burada olusacak."}
            </pre>
          </div>

          <div className="panel-card install-card">
            <span className="label">Kurulum</span>
            <ol>
              <li>Bu sayfadan konumlarini ekle ve kodu kopyala.</li>
              <li>iPhone'da Scriptable acip yeni script olustur.</li>
              <li>Kodu yapistirip kaydet.</li>
              <li>Ana ekrana Scriptable medium veya large widget ekle.</li>
              <li>Widget icindeki satira dokununca Google Maps rota acilsin.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
