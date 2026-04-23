import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Download,
  Eraser,
  FileInput,
  FilePlus2,
  GripVertical,
  ImagePlus,
  Layers3,
  Pencil,
  Plus,
  Save,
  ScanText,
  Signature,
  Trash2,
} from "lucide-react";
import { loadSnapshot, saveSnapshot } from "./db";
import {
  createBlankPage,
  exportProject,
  fitIntoBox,
  inspectImage,
  inspectPdf,
  pageFromImage,
  pageFromPdf,
  renderPdfPage,
  uid,
} from "./pdf";

const DEFAULT_TEXT = "Metin";
const EMPTY_ANNOTATIONS = { strokes: [], items: [] };
const BLANK_TEMPLATES = ["A4", "Letter", "Square", "Story"];
const TOOL_OPTIONS = [
  { id: "select", label: "Sec" },
  { id: "text", label: "Metin" },
  { id: "draw", label: "Ciz" },
  { id: "signature", label: "Imza" },
];

export default function App() {
  const [project, setProject] = useState({ documents: [], pages: [] });
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [tool, setTool] = useState("select");
  const [accentColor, setAccentColor] = useState("#16a34a");
  const [textValue, setTextValue] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(22);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [status, setStatus] = useState("Yeni bir PDF yukleyin veya bos bir sayfa olusturun.");
  const [isHydrated, setIsHydrated] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState(null);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const autosaveTimer = useRef(null);
  const pageInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const documentsById = useMemo(
    () => Object.fromEntries(project.documents.map((documentRecord) => [documentRecord.id, documentRecord])),
    [project.documents],
  );
  const selectedPage = useMemo(
    () => project.pages.find((page) => page.id === selectedPageId) ?? null,
    [project.pages, selectedPageId],
  );
  const selectedItem = useMemo(() => {
    if (!selectedPage || !selectedItemId) {
      return null;
    }

    return selectedPage.annotations.items.find((item) => item.id === selectedItemId) ?? null;
  }, [selectedItemId, selectedPage]);
  const libraryPages = useMemo(() => {
    const items = [];
    project.documents.forEach((documentRecord) => {
      documentRecord.pages.forEach((pageMeta) => {
        items.push(pageFromPdf(documentRecord, pageMeta));
      });
    });
    project.pages.forEach((page) => {
      if (page.kind === "image") {
        items.push({ ...page });
      }
    });
    return items;
  }, [project.documents, project.pages]);

  useEffect(() => {
    loadSnapshot()
      .then((snapshot) => {
        if (snapshot?.pages?.length) {
          setProject(snapshot);
          setSelectedPageId(snapshot.pages[0].id);
          setStatus("Son calisma otomatik olarak geri yuklendi.");
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      saveSnapshot(project)
        .then(() => setStatus("Calisma otomatik kaydedildi."))
        .catch(() => setStatus("Otomatik kayit sirasinda bir sorun olustu."));
    }, 800);

    return () => window.clearTimeout(autosaveTimer.current);
  }, [isHydrated, project]);

  function updateSinglePage(nextPage) {
    setProject((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === nextPage.id ? nextPage : page)),
    }));
  }

  function patchSelectedPage(updater) {
    setProject((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === selectedPageId ? updater(page) : page)),
    }));
  }

  async function handlePdfUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setStatus("PDF dosyalari isleniyor...");

    try {
      const documents = [];
      const pages = [];

      for (const file of files) {
        const documentRecord = await inspectPdf(file);
        documents.push(documentRecord);
        documentRecord.pages.forEach((pageMeta) => {
          pages.push(pageFromPdf(documentRecord, pageMeta));
        });
      }

      setProject((current) => ({
        documents: [...current.documents, ...documents],
        pages: [...current.pages, ...pages],
      }));
      setSelectedPageId((current) => current ?? pages[0]?.id ?? null);
      setStatus(`${files.length} PDF yuklendi ve sayfalar belgeye eklendi.`);
    } catch {
      setStatus("PDF okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImageUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setStatus("Gorseller ekleniyor...");

    try {
      const pages = [];

      for (const file of files) {
        const imageRecord = await inspectImage(file);
        pages.push(pageFromImage(imageRecord));
      }

      setProject((current) => ({ ...current, pages: [...current.pages, ...pages] }));
      setSelectedPageId((current) => current ?? pages[0]?.id ?? null);
      setStatus(`${files.length} gorsel yeni PDF sayfasi olarak eklendi.`);
    } catch {
      setStatus("Gorsel okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  }

  function insertBlankPage(template) {
    const blank = createBlankPage(template);

    setProject((current) => {
      if (!selectedPageId) {
        return { ...current, pages: [...current.pages, blank] };
      }

      const index = current.pages.findIndex((page) => page.id === selectedPageId);
      const pages = [...current.pages];
      pages.splice(index + 1, 0, blank);
      return { ...current, pages };
    });

    setSelectedPageId(blank.id);
    setStatus(`${template} boyutunda bos sayfa eklendi.`);
  }

  function deleteSelectedPage() {
    if (!selectedPageId) {
      return;
    }

    setProject((current) => {
      const selectedIndex = current.pages.findIndex((page) => page.id === selectedPageId);
      const pages = current.pages.filter((page) => page.id !== selectedPageId);
      const nextSelected = pages[Math.max(0, selectedIndex - 1)];
      setSelectedPageId(nextSelected?.id ?? null);
      setSelectedItemId(null);
      return { ...current, pages };
    });

    setStatus("Secili sayfa silindi.");
  }

  function duplicateSelectedPage() {
    if (!selectedPage) {
      return;
    }

    const clone = structuredClone(selectedPage);
    clone.id = uid("page");
    clone.annotations.items = clone.annotations.items.map((item) => ({ ...item, id: uid("item") }));
    clone.annotations.strokes = clone.annotations.strokes.map((stroke) => ({ ...stroke, id: uid("stroke") }));

    setProject((current) => {
      const index = current.pages.findIndex((page) => page.id === selectedPageId);
      const pages = [...current.pages];
      pages.splice(index + 1, 0, clone);
      return { ...current, pages };
    });

    setSelectedPageId(clone.id);
    setStatus("Secili sayfanin kopyasi olusturuldu.");
  }

  function replaceSelectedPageWithLibrary(libraryEntry) {
    if (!selectedPage) {
      return;
    }

    patchSelectedPage(() => ({
      ...libraryEntry,
      id: selectedPage.id,
      annotations: structuredClone(EMPTY_ANNOTATIONS),
    }));
    setSelectedItemId(null);
    setStatus("Secili sayfa yeni kaynakla degistirildi.");
  }

  function updateSelectedText(patch) {
    if (!selectedPage || !selectedItem) {
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      annotations: {
        ...page.annotations,
        items: page.annotations.items.map((item) =>
          item.id === selectedItemId ? { ...item, ...patch } : item,
        ),
      },
    }));
  }

  function removeSelectedItem() {
    if (!selectedPage || !selectedItemId) {
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      annotations: {
        ...page.annotations,
        items: page.annotations.items.filter((item) => item.id !== selectedItemId),
      },
    }));
    setSelectedItemId(null);
    setStatus("Secili nesne kaldirildi.");
  }

  async function downloadProject() {
    if (!project.pages.length) {
      return;
    }

    setIsExporting(true);
    setStatus("PDF disa aktariliyor...");

    try {
      const bytes = await exportProject(project);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdf-pocket-studio-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("PDF indirildi.");
    } catch {
      setStatus("PDF olusturulamadi.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setProject((current) => {
      const oldIndex = current.pages.findIndex((page) => page.id === active.id);
      const newIndex = current.pages.findIndex((page) => page.id === over.id);

      return {
        ...current,
        pages: arrayMove(current.pages, oldIndex, newIndex),
      };
    });
    setStatus("Sayfa sirasi guncellendi.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PDF Pocket Studio</p>
          <h1>Mobil PDF duzenleme ve olusturma uygulamasi</h1>
          <p className="subtle">
            PDF birlestir, sayfa sirala, metin ekle, ciz, imza koy, gorsel yerlestir ve tek
            dokunusla disa aktar.
          </p>
        </div>
        <button className="primary-btn" disabled={isExporting || !project.pages.length} onClick={downloadProject}>
          <Download size={18} />
          {isExporting ? "Hazirlaniyor" : "PDF indir"}
        </button>
      </header>

      <section className="hero-grid">
        <div className="glass-card">
          <div className="card-title">
            <FileInput size={18} />
            <span>Belge akisi</span>
          </div>
          <div className="button-grid">
            <button className="action-btn" onClick={() => pageInputRef.current?.click()}>
              <FilePlus2 size={18} />
              PDF yukle
            </button>
            <button className="action-btn" onClick={() => imageInputRef.current?.click()}>
              <ImagePlus size={18} />
              Gorsel yukle
            </button>
            {BLANK_TEMPLATES.map((template) => (
              <button
                key={template}
                className="action-btn secondary"
                onClick={() => insertBlankPage(template)}
              >
                <Plus size={18} />
                Bos {template}
              </button>
            ))}
          </div>
          <input accept="application/pdf" hidden multiple ref={pageInputRef} type="file" onChange={handlePdfUpload} />
          <input accept="image/*" hidden multiple ref={imageInputRef} type="file" onChange={handleImageUpload} />
        </div>

        <div className="glass-card compact">
          <div className="card-title">
            <ScanText size={18} />
            <span>Duzenleme araci</span>
          </div>
          <div className="tool-row">
            {TOOL_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={tool === option.id ? "tool-chip active" : "tool-chip"}
                onClick={() => setTool(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label>
              <span>Renk</span>
              <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </label>
            <label>
              <span>Yazi boyutu</span>
              <input
                max="64"
                min="10"
                type="range"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Kalem kalinligi</span>
              <input
                max="12"
                min="1"
                type="range"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
            </label>
          </div>
          <textarea
            className="text-editor"
            rows="3"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
          />
          <div className="micro-actions">
            <button className="ghost-btn" onClick={() => setSignaturePickerOpen(true)}>
              <Signature size={16} />
              Imza hazirla
            </button>
            <button className="ghost-btn" onClick={() => saveSnapshot(project)}>
              <Save size={16} />
              Manuel kaydet
            </button>
          </div>
        </div>
      </section>

      <main className="workspace">
        <PageList
          documentsById={documentsById}
          pages={project.pages}
          selectedPageId={selectedPageId}
          setSelectedPageId={setSelectedPageId}
          onDelete={deleteSelectedPage}
          onDuplicate={duplicateSelectedPage}
          onSort={handleDragEnd}
        />

        <section className="editor-panel glass-card">
          {selectedPage ? (
            <PageEditor
              accentColor={accentColor}
              documentsById={documentsById}
              fontSize={fontSize}
              page={selectedPage}
              selectedItemId={selectedItemId}
              setSelectedItemId={setSelectedItemId}
              signatureDraft={signatureDraft}
              strokeWidth={strokeWidth}
              textValue={textValue}
              tool={tool}
              updatePage={updateSinglePage}
            />
          ) : (
            <EmptyState />
          )}
        </section>

        <aside className="side-panel">
          <LibraryPanel
            entries={libraryPages}
            onAppend={(entry) => {
              const copy = { ...entry, id: uid("page"), annotations: structuredClone(EMPTY_ANNOTATIONS) };
              setProject((current) => ({ ...current, pages: [...current.pages, copy] }));
              setStatus("Kutuphane sayfasi belgeye eklendi.");
            }}
            onReplace={replaceSelectedPageWithLibrary}
            selectedPage={selectedPage}
          />

          <Inspector
            selectedItem={selectedItem}
            updateSelectedText={updateSelectedText}
            removeSelectedItem={removeSelectedItem}
          />
        </aside>
      </main>

      <footer className="status-bar">
        <div className="status-pill">{status}</div>
        <div className="status-pill">
          <Layers3 size={14} />
          {project.pages.length} sayfa
        </div>
      </footer>

      {signaturePickerOpen ? (
        <SignatureModal
          onClose={() => setSignaturePickerOpen(false)}
          onSave={(dataUrl) => {
            setSignatureDraft(dataUrl);
            setSignaturePickerOpen(false);
            setTool("signature");
            setStatus("Imza kaydedildi. Sayfaya dokunarak yerlestirin.");
          }}
        />
      ) : null}
    </div>
  );
}

function PageList({ documentsById, pages, selectedPageId, setSelectedPageId, onDelete, onDuplicate, onSort }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <section className="page-list glass-card">
      <div className="section-header">
        <h2>Sayfalar</h2>
        <div className="micro-actions">
          <button className="ghost-btn" onClick={onDuplicate}>
            <Plus size={16} />
            Kopyala
          </button>
          <button className="ghost-btn danger" onClick={onDelete}>
            <Trash2 size={16} />
            Sil
          </button>
        </div>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={onSort} sensors={sensors}>
        <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
          <div className="page-scroll">
            {pages.map((page, index) => (
              <SortablePageCard
                key={page.id}
                index={index}
                isSelected={page.id === selectedPageId}
                page={page}
                setSelectedPageId={setSelectedPageId}
                sourceDocument={page.kind === "pdf" ? documentsById[page.sourceId] : null}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortablePageCard({ index, isSelected, page, setSelectedPageId, sourceDocument }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (page.kind === "image") {
      setPreview(page.imageDataUrl);
      return undefined;
    }

    if (page.kind === "blank") {
      setPreview(null);
      return undefined;
    }

    let active = true;

    renderPdfPage(sourceDocument, page.sourcePageIndex, 0.45)
      .then((dataUrl) => {
        if (active) {
          setPreview(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setPreview(null);
        }
      });

    return () => {
      active = false;
    };
  }, [page, sourceDocument]);

  return (
    <button
      ref={setNodeRef}
      className={isSelected ? "page-card selected" : "page-card"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      type="button"
      onClick={() => setSelectedPageId(page.id)}
    >
      <div className="page-card-top">
        <span>{index + 1}</span>
        <span className="page-meta">
          {page.kind === "pdf" ? "PDF" : page.kind === "image" ? "Image" : "Blank"}
        </span>
        <span className="drag-handle" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </span>
      </div>
      <div className="page-thumb" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
        {preview ? <img alt="" src={preview} /> : <div className="blank-thumb" />}
      </div>
      <strong>{page.name}</strong>
    </button>
  );
}

function PageEditor({
  accentColor,
  documentsById,
  fontSize,
  page,
  selectedItemId,
  setSelectedItemId,
  signatureDraft,
  strokeWidth,
  textValue,
  tool,
  updatePage,
}) {
  const hostRef = useRef(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const [drawingStrokeId, setDrawingStrokeId] = useState(null);
  const dragState = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setHostSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    if (hostRef.current) {
      observer.observe(hostRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const fitted = fitIntoBox(
    page.width,
    page.height,
    Math.max(hostSize.width - 24, 1),
    Math.max(hostSize.height - 24, 1),
  );

  function toPdfCoordinates(clientX, clientY) {
    const stage = hostRef.current?.querySelector(".page-stage-inner");
    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * page.width;
    const y = page.height - ((clientY - rect.top) / rect.height) * page.height;

    return {
      x: Math.max(0, Math.min(page.width, x)),
      y: Math.max(0, Math.min(page.height, y)),
    };
  }

  function handleStagePointerDown(event) {
    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    if (tool === "text") {
      const item = {
        id: uid("item"),
        type: "text",
        text: textValue.trim() || DEFAULT_TEXT,
        x: coords.x,
        y: coords.y,
        color: accentColor,
        fontSize,
      };

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: [...page.annotations.items, item],
        },
      });
      setSelectedItemId(item.id);
      return;
    }

    if (tool === "signature" && signatureDraft) {
      const item = {
        id: uid("item"),
        type: "signature",
        dataUrl: signatureDraft,
        x: Math.max(0, coords.x - 80),
        y: coords.y,
        width: 160,
        height: 70,
      };

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: [...page.annotations.items, item],
        },
      });
      setSelectedItemId(item.id);
      return;
    }

    if (tool === "draw") {
      const stroke = {
        id: uid("stroke"),
        color: accentColor,
        width: strokeWidth,
        points: [coords],
      };

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          strokes: [...page.annotations.strokes, stroke],
        },
      });
      setDrawingStrokeId(stroke.id);
      return;
    }

    setSelectedItemId(null);
  }

  function handleStagePointerMove(event) {
    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    if (tool === "draw" && drawingStrokeId) {
      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          strokes: page.annotations.strokes.map((stroke) =>
            stroke.id === drawingStrokeId
              ? {
                  ...stroke,
                  points: [...stroke.points, coords],
                }
              : stroke,
          ),
        },
      });
    }

    if (dragState.current) {
      const { itemId, offsetX, offsetY } = dragState.current;

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: page.annotations.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  x: Math.max(0, coords.x - offsetX),
                  y: Math.max(0, coords.y - offsetY),
                }
              : item,
          ),
        },
      });
    }
  }

  function handleStagePointerUp() {
    setDrawingStrokeId(null);
    dragState.current = null;
  }

  function beginItemDrag(item, event) {
    event.stopPropagation();

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    setSelectedItemId(item.id);
    dragState.current = {
      itemId: item.id,
      offsetX: coords.x - item.x,
      offsetY: coords.y - item.y,
    };
  }

  return (
    <div className="page-editor-shell">
      <div className="section-header">
        <div>
          <h2>{page.name}</h2>
          <p className="subtle">
            Dokunarak metin ekleyin, serbest cizin, imza yerlestirin veya nesneleri surukleyin.
          </p>
        </div>
        <button
          className="ghost-btn"
          onClick={() =>
            updatePage({
              ...page,
              annotations: { strokes: [], items: [] },
            })
          }
        >
          <Eraser size={16} />
          Katmani temizle
        </button>
      </div>

      <div
        ref={hostRef}
        className="page-stage"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerLeave={handleStagePointerUp}
      >
        <div
          className="page-stage-inner"
          style={{
            width: `${fitted.width}px`,
            height: `${fitted.height}px`,
            aspectRatio: `${page.width} / ${page.height}`,
          }}
        >
          <BaseLayer page={page} sourceDocument={page.kind === "pdf" ? documentsById[page.sourceId] : null} />

          <svg className="annotation-svg" viewBox={`0 0 ${page.width} ${page.height}`} preserveAspectRatio="none">
            {page.annotations.strokes.map((stroke) => (
              <polyline
                key={stroke.id}
                fill="none"
                points={stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ")}
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.width}
              />
            ))}
          </svg>

          {page.annotations.items.map((item) => (
            <AnnotationItem
              key={item.id}
              item={item}
              page={page}
              selected={item.id === selectedItemId}
              onPointerDown={beginItemDrag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BaseLayer({ page, sourceDocument }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (page.kind === "image") {
      setPreview(page.imageDataUrl);
      return undefined;
    }

    if (page.kind === "blank") {
      setPreview(null);
      return undefined;
    }

    let active = true;

    renderPdfPage(sourceDocument, page.sourcePageIndex, 1.4)
      .then((dataUrl) => {
        if (active) {
          setPreview(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setPreview(null);
        }
      });

    return () => {
      active = false;
    };
  }, [page, sourceDocument]);

  if (!preview) {
    return <div className="blank-canvas" />;
  }

  return <img alt="" className="base-preview" src={preview} />;
}

function AnnotationItem({ item, onPointerDown, page, selected }) {
  const left = `${(item.x / page.width) * 100}%`;
  const bottom = `${(item.y / page.height) * 100}%`;

  if (item.type === "text") {
    return (
      <button
        className={selected ? "annotation-item text selected" : "annotation-item text"}
        style={{ left, bottom, color: item.color, fontSize: `${item.fontSize}px` }}
        type="button"
        onPointerDown={(event) => onPointerDown(item, event)}
      >
        {item.text}
      </button>
    );
  }

  return (
    <button
      className={selected ? "annotation-item signature selected" : "annotation-item signature"}
      style={{
        left,
        bottom,
        width: `${(item.width / page.width) * 100}%`,
        height: `${(item.height / page.height) * 100}%`,
      }}
      type="button"
      onPointerDown={(event) => onPointerDown(item, event)}
    >
      <img alt="" src={item.dataUrl} />
    </button>
  );
}

function LibraryPanel({ entries, onAppend, onReplace, selectedPage }) {
  return (
    <section className="glass-card">
      <div className="section-header">
        <h2>Kaynak kutuphanesi</h2>
      </div>
      <p className="subtle">
        Yuklediginiz PDF sayfalarini sonradan tekrar ekleyebilir veya secili sayfanin yerine koyabilirsiniz.
      </p>
      <div className="library-scroll">
        {entries.map((entry) => (
          <div
            key={entry.kind === "pdf" ? `${entry.sourceId}-${entry.sourcePageIndex}` : entry.id}
            className="library-item"
          >
            <div className="library-meta">
              <strong>{entry.name}</strong>
              <span>
                {Math.round(entry.width)} x {Math.round(entry.height)}
              </span>
            </div>
            <div className="micro-actions">
              <button className="ghost-btn" onClick={() => onAppend(entry)}>
                Ekle
              </button>
              <button className="ghost-btn" disabled={!selectedPage} onClick={() => onReplace(entry)}>
                Degistir
              </button>
            </div>
          </div>
        ))}
        {!entries.length ? <div className="empty-panel">Kutuphane, yuklediginiz PDF kaynaklarini burada tutar.</div> : null}
      </div>
    </section>
  );
}

function Inspector({ selectedItem, updateSelectedText, removeSelectedItem }) {
  return (
    <section className="glass-card">
      <div className="section-header">
        <h2>Nesne denetimi</h2>
      </div>

      {selectedItem?.type === "text" ? (
        <div className="field-grid">
          <label>
            <span>Metin</span>
            <textarea
              rows="4"
              value={selectedItem.text}
              onChange={(event) => updateSelectedText({ text: event.target.value })}
            />
          </label>
          <label>
            <span>Renk</span>
            <input
              type="color"
              value={selectedItem.color}
              onChange={(event) => updateSelectedText({ color: event.target.value })}
            />
          </label>
          <label>
            <span>Boyut</span>
            <input
              max="72"
              min="10"
              type="range"
              value={selectedItem.fontSize}
              onChange={(event) => updateSelectedText({ fontSize: Number(event.target.value) })}
            />
          </label>
          <button className="ghost-btn danger" onClick={removeSelectedItem}>
            Nesneyi sil
          </button>
        </div>
      ) : selectedItem ? (
        <div className="field-grid">
          <p className="subtle">Imza nesnesi secili. Sayfada surukleyerek yeniden konumlandirabilirsiniz.</p>
          <button className="ghost-btn danger" onClick={removeSelectedItem}>
            Imzayi sil
          </button>
        </div>
      ) : (
        <div className="empty-panel">Duzenlemek icin sayfadaki bir yazi veya imzayi secin.</div>
      )}
    </section>
  );
}

function SignatureModal({ onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 600 * ratio;
    canvas.height = 240 * ratio;
    canvas.style.width = "100%";
    canvas.style.height = "180px";

    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 600, 240);
  }, []);

  function position(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 600,
      y: ((event.clientY - rect.top) / rect.height) * 240,
    };
  }

  function start(event) {
    const context = canvasRef.current.getContext("2d");
    const { x, y } = position(event);
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    setHasInk(true);
  }

  function move(event) {
    if (!isDrawing) {
      return;
    }

    const context = canvasRef.current.getContext("2d");
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function stop() {
    setIsDrawing(false);
  }

  function clear() {
    const context = canvasRef.current.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 600, 240);
    setHasInk(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h2>Imza olustur</h2>
          <button className="ghost-btn" onClick={onClose}>
            Kapat
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
        <div className="micro-actions">
          <button className="ghost-btn" onClick={clear}>
            Temizle
          </button>
          <button className="primary-btn" disabled={!hasInk} onClick={() => onSave(canvasRef.current.toDataURL("image/png"))}>
            Imzayi kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Pencil size={28} />
      <h2>Duzenlemeye hazir bir belge yok</h2>
      <p>
        PDF yukleyin, birden fazla belgeyi birlestirin veya bos bir sayfadan yeni dosyanizi
        olusturmaya baslayin.
      </p>
    </div>
  );
}
