import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Download,
  Eraser,
  FilePlus2,
  GripVertical,
  ImagePlus,
  Minus,
  MousePointer2,
  PencilLine,
  Plus,
  Replace,
  Save,
  Signature,
  Trash2,
  Type,
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
const SIGNATURE_STORAGE_KEY = "pdf-pocket-studio-signatures";
const SIGNATURE_PRESETS = [
  makeSignaturePreset("preset-1", "E. Kaya"),
  makeSignaturePreset("preset-2", "Enes Kaya"),
  makeSignaturePreset("preset-3", "E. K."),
];

export default function App() {
  const [project, setProject] = useState({ documents: [], pages: [] });
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [tool, setTool] = useState("select");
  const [editMode, setEditMode] = useState(false);
  const [signatureListOpen, setSignatureListOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#111827");
  const [textValue, setTextValue] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(24);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [pageZoom, setPageZoom] = useState(1);
  const [status, setStatus] = useState("PDF yukleyin, foto ekleyin veya bos A4 sayfa olusturun.");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [signaturesHydrated, setSignaturesHydrated] = useState(false);
  const [signatureOptions, setSignatureOptions] = useState(SIGNATURE_PRESETS);
  const [activeSignatureId, setActiveSignatureId] = useState(SIGNATURE_PRESETS[0].id);

  const autosaveTimer = useRef(null);
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const replaceInputRef = useRef(null);

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
  const activeSignature = useMemo(
    () => signatureOptions.find((option) => option.id === activeSignatureId) ?? null,
    [activeSignatureId, signatureOptions],
  );
  const selectedPageIndex = useMemo(
    () => project.pages.findIndex((page) => page.id === selectedPageId),
    [project.pages, selectedPageId],
  );

  useEffect(() => {
    loadSnapshot()
      .then((snapshot) => {
        if (snapshot?.pages?.length) {
          setProject(snapshot);
          setSelectedPageId(snapshot.pages[0].id);
          setStatus("Son calisma geri yuklendi.");
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSignatureOptions(parsed);
      setActiveSignatureId(parsed[0]?.id ?? null);
    }
    setSignaturesHydrated(true);
  }, []);

  useEffect(() => {
    if (!signaturesHydrated) {
      return;
    }

    localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(signatureOptions));
  }, [signatureOptions, signaturesHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      saveSnapshot(project)
        .then(() => setStatus("Calisma kaydedildi."))
        .catch(() => setStatus("Kayit sirasinda bir sorun olustu."));
    }, 700);

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

    setStatus("PDF dosyalari yukleniyor...");

    try {
      const documents = [];
      const pages = [];

      for (const file of files) {
        const documentRecord = await inspectPdf(file);
        documents.push(documentRecord);
        documentRecord.pages.forEach((pageMeta) => pages.push(pageFromPdf(documentRecord, pageMeta)));
      }

      setProject((current) => ({
        documents: [...current.documents, ...documents],
        pages: [...current.pages, ...pages],
      }));
      setSelectedPageId((current) => current ?? pages[0]?.id ?? null);
      setStatus(`${files.length} PDF eklendi.`);
    } catch {
      setStatus("PDF okunamadi.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImageUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setStatus("Fotograflar ekleniyor...");

    try {
      const pages = [];

      for (const file of files) {
        const imageRecord = await inspectImage(file);
        pages.push(pageFromImage(imageRecord));
      }

      setProject((current) => ({ ...current, pages: [...current.pages, ...pages] }));
      setSelectedPageId((current) => current ?? pages[0]?.id ?? null);
      setStatus(`${files.length} gorsel eklendi.`);
    } catch {
      setStatus("Gorsel okunamadi.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleReplaceUpload(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !selectedPage) {
      return;
    }

    setStatus("Secili sayfa degistiriliyor...");

    try {
      const replacementPages = [];
      const newDocuments = [];

      for (const file of files) {
        if (file.type === "application/pdf") {
          const documentRecord = await inspectPdf(file);
          newDocuments.push(documentRecord);
          documentRecord.pages.forEach((pageMeta) => replacementPages.push(pageFromPdf(documentRecord, pageMeta)));
        } else if (file.type.startsWith("image/")) {
          const imageRecord = await inspectImage(file);
          replacementPages.push(pageFromImage(imageRecord));
        }
      }

      if (!replacementPages.length) {
        setStatus("Degistirme icin uygun dosya bulunamadi.");
        return;
      }

      setProject((current) => {
        const pages = [...current.pages];
        pages.splice(selectedPageIndex, 1, ...replacementPages);

        return {
          documents: [...current.documents, ...newDocuments],
          pages,
        };
      });

      setSelectedPageId(replacementPages[0].id);
      setSelectedItemId(null);
      setTool("select");
      setStatus(
        replacementPages.length > 1
          ? "Secili sayfa degistirildi, kalan sayfalar arkasina eklendi."
          : "Secili sayfa degistirildi.",
      );
    } catch {
      setStatus("Secili sayfa degistirilemedi.");
    } finally {
      event.target.value = "";
    }
  }

  function insertBlankA4Page() {
    const blank = createBlankPage("A4");

    setProject((current) => {
      if (!selectedPageId) {
        return { ...current, pages: [...current.pages, blank] };
      }

      const pages = [...current.pages];
      pages.splice(selectedPageIndex + 1, 0, blank);
      return { ...current, pages };
    });

    setSelectedPageId(blank.id);
    setStatus("Bos A4 sayfa eklendi.");
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
      const pages = [...current.pages];
      pages.splice(selectedPageIndex + 1, 0, clone);
      return { ...current, pages };
    });

    setSelectedPageId(clone.id);
    setSelectedItemId(null);
    setTool("select");
    setStatus("Sayfa kopyalandi.");
  }

  function deleteSelectedPage() {
    if (!selectedPage) {
      return;
    }

    setProject((current) => {
      const pages = current.pages.filter((page) => page.id !== selectedPage.id);
      const nextSelected = pages[Math.max(0, selectedPageIndex - 1)];
      setSelectedPageId(nextSelected?.id ?? null);
      return { ...current, pages };
    });

    setSelectedItemId(null);
    setTool("select");
    setStatus("Sayfa silindi.");
  }

  function clearCurrentAnnotations() {
    if (!selectedPage) {
      return;
    }

    updateSinglePage({
      ...selectedPage,
      annotations: { strokes: [], items: [] },
    });
    setSelectedItemId(null);
    setTool("select");
    setStatus("Cizimler ve eklenen ogeler temizlendi.");
  }

  function updateSelectedItem(patch) {
    if (!selectedPage || !selectedItem) {
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      annotations: {
        ...page.annotations,
        items: page.annotations.items.map((item) =>
          item.id === selectedItem.id ? { ...item, ...patch } : item,
        ),
      },
    }));
  }

  function updateSelectedItemScale(scale) {
    if (!selectedItem) {
      return;
    }

    if (selectedItem.type === "text") {
      updateSelectedItem({ fontSize: Math.round(scale) });
      return;
    }

    const ratio = selectedItem.height / selectedItem.width || 0.4;
    updateSelectedItem({
      width: Math.round(scale),
      height: Math.round(scale * ratio),
    });
  }

  function removeSelectedItem() {
    if (!selectedPage || !selectedItem) {
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      annotations: {
        ...page.annotations,
        items: page.annotations.items.filter((item) => item.id !== selectedItem.id),
      },
    }));
    setSelectedItemId(null);
    setTool("select");
    setStatus("Secili oge kaldirildi.");
  }

  function removeSignature(signatureId) {
    setSignatureOptions((current) => {
      const next = current.filter((signature) => signature.id !== signatureId);
      if (activeSignatureId === signatureId) {
        setActiveSignatureId(next[0]?.id ?? null);
        if (!next.length) {
          setTool("select");
        }
      }
      return next;
    });
  }

  async function downloadProject() {
    if (!project.pages.length) {
      return;
    }

    setIsExporting(true);
    setStatus("PDF hazirlaniyor...");

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
      setStatus("PDF disa aktarilamadi.");
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

  function activateEditTool(nextTool) {
    setEditMode(true);
    setTool(nextTool);
    if (nextTool === "signature") {
      setSignatureListOpen((current) => !current);
    } else {
      setSignatureListOpen(false);
    }
  }

  return (
    <div className={editMode ? "app-shell editing" : "app-shell"}>
      <input accept="application/pdf" hidden multiple ref={pdfInputRef} type="file" onChange={handlePdfUpload} />
      <input accept="image/*" hidden multiple ref={imageInputRef} type="file" onChange={handleImageUpload} />
      <input
        accept="application/pdf,image/*"
        hidden
        multiple
        ref={replaceInputRef}
        type="file"
        onChange={handleReplaceUpload}
      />

      <header className="topbar">
        <div>
          <p className="eyebrow">PDF Pocket Studio</p>
          <h1>PDF duzenleme</h1>
        </div>
        <div className="toolbar-actions">
          <button className="soft-btn" title="PDF yukle" onClick={() => pdfInputRef.current?.click()}>
            <FilePlus2 size={18} />
            PDF
          </button>
          <button className="soft-btn" title="Foto ekle" onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={18} />
            Foto
          </button>
          <button className="soft-btn" title="Bos A4 ekle" onClick={insertBlankA4Page}>
            <Plus size={18} />
            A4
          </button>
          <button className="primary-btn" disabled={isExporting || !project.pages.length} title="PDF indir" onClick={downloadProject}>
            <Download size={18} />
            {isExporting ? "Hazir" : "Indir"}
          </button>
        </div>
      </header>

      <main className="workspace-shell">
        {selectedPage ? (
          <>
            <section className="stage-shell">
              <div className="stage-topbar">
                <div className="page-badge">
                  {selectedPageIndex + 1} / {project.pages.length}
                </div>
                <div className="stage-actions">
                  <button className="soft-btn icon-btn" title="Sayfayi degistir" onClick={() => replaceInputRef.current?.click()}>
                    <Replace size={18} />
                  </button>
                  <button className="soft-btn icon-btn" title="Sayfayi kopyala" onClick={duplicateSelectedPage}>
                    <Plus size={18} />
                  </button>
                  <button className="soft-btn danger icon-btn" title="Sayfayi sil" onClick={deleteSelectedPage}>
                    <Trash2 size={18} />
                  </button>
                  <button
                    className={editMode ? "primary-btn" : "soft-btn"}
                    title="Duzenleme araclari"
                    onClick={() => {
                      setEditMode((current) => !current);
                      setTool("select");
                      setSignatureListOpen(false);
                    }}
                  >
                    {editMode ? <Check size={18} /> : <PencilLine size={18} />}
                    {editMode ? "Bitti" : "Duzenle"}
                  </button>
                </div>
              </div>

              {editMode ? (
                <EditToolbar
                  accentColor={accentColor}
                  activeSignature={activeSignature}
                  fontSize={fontSize}
                  onActivateTool={activateEditTool}
                  onClearCurrentAnnotations={clearCurrentAnnotations}
                  onCreateSignature={() => setSignaturePickerOpen(true)}
                  onRemoveSelectedItem={removeSelectedItem}
                  onRemoveSignature={removeSignature}
                  onSelectSignature={(signatureId) => {
                    setActiveSignatureId(signatureId);
                    setTool("signature");
                    setSignatureListOpen(false);
                  }}
                  selectedItem={selectedItem}
                  setAccentColor={setAccentColor}
                  setFontSize={setFontSize}
                  setStrokeWidth={setStrokeWidth}
                  setTextValue={setTextValue}
                  signatureListOpen={signatureListOpen}
                  signatureOptions={signatureOptions}
                  strokeWidth={strokeWidth}
                  textValue={textValue}
                  tool={tool}
                  updateSelectedItem={updateSelectedItem}
                  updateSelectedItemScale={updateSelectedItemScale}
                />
              ) : null}

              <PageEditor
                accentColor={accentColor}
                activeSignature={activeSignature}
                documentsById={documentsById}
                fontSize={fontSize}
                page={selectedPage}
                pageZoom={pageZoom}
                selectedItemId={selectedItemId}
                setSelectedItemId={setSelectedItemId}
                setStatus={setStatus}
                setTool={setTool}
                strokeWidth={strokeWidth}
                textValue={textValue}
                tool={editMode ? tool : "select"}
                updatePage={updateSinglePage}
              />
            </section>

            <div className="zoom-strip">
              <button className="soft-btn icon-btn" title="Kucult" onClick={() => setPageZoom((current) => clamp(current - 0.1, 0.6, 2.4))}>
                <Minus size={18} />
              </button>
              <input
                aria-label="Sayfa yakinlastirma"
                max="2.4"
                min="0.6"
                step="0.05"
                type="range"
                value={pageZoom}
                onChange={(event) => setPageZoom(Number(event.target.value))}
              />
              <button className="soft-btn icon-btn" title="Buyut" onClick={() => setPageZoom((current) => clamp(current + 0.1, 0.6, 2.4))}>
                <Plus size={18} />
              </button>
              <span>{Math.round(pageZoom * 100)}%</span>
            </div>

            <PageStrip
              documentsById={documentsById}
              pages={project.pages}
              selectedPageId={selectedPageId}
              setSelectedPageId={setSelectedPageId}
              onSort={handleDragEnd}
            />
          </>
        ) : (
          <EmptyState onAddA4={insertBlankA4Page} onUploadImage={() => imageInputRef.current?.click()} onUploadPdf={() => pdfInputRef.current?.click()} />
        )}
      </main>

      <footer className="status-bar">
        <div className="status-pill">{status}</div>
        <button className="soft-btn compact-btn" onClick={() => saveSnapshot(project)}>
          <Save size={16} />
          Kaydet
        </button>
      </footer>

      {signaturePickerOpen ? (
        <SignatureModal
          onClose={() => setSignaturePickerOpen(false)}
          onSave={(dataUrl) => {
            const customSignature = {
              id: uid("signature"),
              label: "Benim imzam",
              dataUrl,
            };

            setSignatureOptions((current) => [...current, customSignature]);
            setActiveSignatureId(customSignature.id);
            setTool("signature");
            setEditMode(true);
            setSignatureListOpen(false);
            setSignaturePickerOpen(false);
            setStatus("Imza kaydedildi. Sayfada koymak istediginiz yere dokunun.");
          }}
        />
      ) : null}
    </div>
  );
}

function EditToolbar({
  accentColor,
  activeSignature,
  fontSize,
  onActivateTool,
  onClearCurrentAnnotations,
  onCreateSignature,
  onRemoveSelectedItem,
  onRemoveSignature,
  onSelectSignature,
  selectedItem,
  setAccentColor,
  setFontSize,
  setStrokeWidth,
  setTextValue,
  signatureListOpen,
  signatureOptions,
  strokeWidth,
  textValue,
  tool,
  updateSelectedItem,
  updateSelectedItemScale,
}) {
  const selectedScale = selectedItem?.type === "signature" ? selectedItem.width : selectedItem?.fontSize;

  return (
    <div className="edit-zone">
      <div className="edit-toolbar">
        <button className={tool === "select" ? "tool-btn active" : "tool-btn"} title="Sec" onClick={() => onActivateTool("select")}>
          <MousePointer2 size={18} />
          Sec
        </button>
        <button className={tool === "draw" ? "tool-btn active" : "tool-btn"} title="Ciz" onClick={() => onActivateTool("draw")}>
          <PencilLine size={18} />
          Ciz
        </button>
        <button className={tool === "text" ? "tool-btn active" : "tool-btn"} title="Metin" onClick={() => onActivateTool("text")}>
          <Type size={18} />
          Metin
        </button>
        <button className={tool === "signature" ? "tool-btn active" : "tool-btn"} title="Imza" onClick={() => onActivateTool("signature")}>
          <Signature size={18} />
          Imza
        </button>
        <button className="tool-btn danger" title="Katmani temizle" onClick={onClearCurrentAnnotations}>
          <Eraser size={18} />
        </button>
      </div>

      {tool === "draw" || tool === "text" ? (
        <div className="tool-settings">
          <label className="swatch-control">
            <span>Renk</span>
            <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
          </label>
          {tool === "draw" ? (
            <label>
              <span>Kalem</span>
              <input
                max="12"
                min="1"
                type="range"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
            </label>
          ) : null}
          {tool === "text" ? (
            <>
              <label>
                <span>Boyut</span>
                <input
                  max="96"
                  min="10"
                  type="range"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                />
              </label>
              <input
                aria-label="Eklenecek metin"
                className="text-inline-input"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {tool === "signature" && signatureListOpen ? (
        <div className="signature-tray">
          {signatureOptions.map((option) => (
            <div key={option.id} className={option.id === activeSignature?.id ? "signature-option active" : "signature-option"}>
              <button onClick={() => onSelectSignature(option.id)}>
                <img alt={option.label} src={option.dataUrl} />
              </button>
              <button className="mini-danger" title="Imzayi sil" onClick={() => onRemoveSignature(option.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="add-signature" onClick={onCreateSignature}>
            <Plus size={18} />
            Yeni
          </button>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="selection-bar">
          <span>{selectedItem.type === "signature" ? "Imza" : "Metin"}</span>
          <label>
            <span>Boyut</span>
            <input
              max={selectedItem.type === "signature" ? "520" : "120"}
              min={selectedItem.type === "signature" ? "60" : "10"}
              type="range"
              value={selectedScale}
              onChange={(event) => updateSelectedItemScale(Number(event.target.value))}
            />
          </label>
          {selectedItem.type === "text" ? (
            <>
              <label className="swatch-control">
                <span>Renk</span>
                <input
                  type="color"
                  value={selectedItem.color}
                  onChange={(event) => updateSelectedItem({ color: event.target.value })}
                />
              </label>
              <input
                aria-label="Secili metin"
                className="text-inline-input"
                value={selectedItem.text}
                onChange={(event) => updateSelectedItem({ text: event.target.value })}
              />
            </>
          ) : null}
          <button className="tool-btn danger" title="Secili ogeyi sil" onClick={onRemoveSelectedItem}>
            <Trash2 size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PageStrip({ documentsById, pages, selectedPageId, setSelectedPageId, onSort }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <section className="film-strip">
      <DndContext collisionDetection={closestCenter} onDragEnd={onSort} sensors={sensors}>
        <SortableContext items={pages.map((page) => page.id)} strategy={horizontalListSortingStrategy}>
          <div className="film-scroll">
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

    renderPdfPage(sourceDocument, page.sourcePageIndex, 0.35)
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
      className={isSelected ? "thumb-card selected" : "thumb-card"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      type="button"
      onClick={() => setSelectedPageId(page.id)}
    >
      <div className="thumb-frame" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
        {preview ? <img alt="" src={preview} /> : <div className="blank-canvas" />}
      </div>
      <div className="thumb-meta">
        <span>{index + 1}</span>
        <span className="thumb-grip" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </span>
      </div>
    </button>
  );
}

function PageEditor({
  accentColor,
  activeSignature,
  documentsById,
  fontSize,
  page,
  pageZoom,
  selectedItemId,
  setSelectedItemId,
  setStatus,
  setTool,
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
  const stageWidth = fitted.width * pageZoom;
  const stageHeight = fitted.height * pageZoom;

  function toPdfCoordinates(clientX, clientY) {
    const stage = hostRef.current?.querySelector(".page-stage-inner");
    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * page.width;
    const y = page.height - ((clientY - rect.top) / rect.height) * page.height;

    return {
      x: clamp(x, 0, page.width),
      y: clamp(y, 0, page.height),
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
      setTool("select");
      setStatus("Metin eklendi. Secili metni tasiyabilir veya boyutunu ayarlayabilirsiniz.");
      return;
    }

    if (tool === "signature") {
      if (!activeSignature) {
        setStatus("Once bir imza olusturun veya listedeki imzalardan birini secin.");
        return;
      }

      const item = {
        id: uid("item"),
        type: "signature",
        dataUrl: activeSignature.dataUrl,
        x: Math.max(0, coords.x - 90),
        y: coords.y,
        width: 180,
        height: 72,
      };

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: [...page.annotations.items, item],
        },
      });
      setSelectedItemId(item.id);
      setTool("select");
      setStatus("Imza eklendi. Konumunu ve boyutunu ayarlayabilirsiniz.");
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

    if (tool === "select" && dragState.current) {
      const { itemId, offsetX, offsetY } = dragState.current;
      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: page.annotations.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  x: clamp(coords.x - offsetX, 0, page.width),
                  y: clamp(coords.y - offsetY, 0, page.height),
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
    setSelectedItemId(item.id);

    if (tool !== "select") {
      return;
    }

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    dragState.current = {
      itemId: item.id,
      offsetX: coords.x - item.x,
      offsetY: coords.y - item.y,
    };
  }

  return (
    <div className="page-editor-shell">
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
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
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

    renderPdfPage(sourceDocument, page.sourcePageIndex, 1.6)
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

function SignatureModal({ onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 900 * ratio;
    canvas.height = 320 * ratio;
    canvas.style.width = "100%";
    canvas.style.height = "180px";

    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 900, 320);
  }, []);

  function position(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 900,
      y: ((event.clientY - rect.top) / rect.height) * 320,
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
    context.fillRect(0, 0, 900, 320);
    setHasInk(false);
  }

  return (
    <div className="signature-modal-backdrop" onClick={onClose}>
      <section className="signature-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Imza olustur</h2>
          <button className="soft-btn compact-btn" onClick={onClose}>
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
        <div className="modal-actions">
          <button className="soft-btn" onClick={clear}>
            Temizle
          </button>
          <button className="primary-btn compact-btn" disabled={!hasInk} onClick={() => onSave(canvasRef.current.toDataURL("image/png"))}>
            Kaydet
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ onAddA4, onUploadImage, onUploadPdf }) {
  return (
    <section className="empty-state">
      <h2>Ilk sayfayi ekleyin</h2>
      <p>Baslamak icin PDF, fotograf veya bos A4 sayfa secin.</p>
      <div className="toolbar-actions">
        <button className="soft-btn" onClick={onUploadPdf}>
          PDF yukle
        </button>
        <button className="soft-btn" onClick={onUploadImage}>
          Foto ekle
        </button>
        <button className="primary-btn" onClick={onAddA4}>
          Bos A4 olustur
        </button>
      </div>
    </section>
  );
}

function makeSignaturePreset(id, text) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120">
      <rect width="320" height="120" fill="white"/>
      <text x="18" y="82" font-size="54" fill="#111827" font-family="cursive">${text}</text>
    </svg>
  `;

  return {
    id,
    label: text,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
