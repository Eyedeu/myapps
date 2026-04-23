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
  Signature,
  Trash2,
  Type,
  ArrowLeft,
} from "lucide-react";
import {
  deleteHistoryProject,
  loadHistoryProjects,
  loadSnapshot,
  saveHistoryProject,
  saveSnapshot,
} from "./db";
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
  const [project, setProject] = useState(() => createProject());
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState(null);
  const [replaceTargetPageId, setReplaceTargetPageId] = useState(null);
  const [tool, setTool] = useState("select");
  const [editMode, setEditMode] = useState(false);
  const [signatureListOpen, setSignatureListOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#111827");
  const [textValue, setTextValue] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(24);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(28);
  const [pageZoom, setPageZoom] = useState(1);
  const [status, setStatus] = useState("PDF yukleyin, foto ekleyin veya bos A4 sayfa olusturun.");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [signaturesHydrated, setSignaturesHydrated] = useState(false);
  const [signatureOptions, setSignatureOptions] = useState(SIGNATURE_PRESETS);
  const [activeSignatureId, setActiveSignatureId] = useState(SIGNATURE_PRESETS[0].id);
  const [historyProjects, setHistoryProjects] = useState([]);

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
  const selectedStroke = useMemo(() => {
    if (!selectedPage || !selectedStrokeId) {
      return null;
    }

    return selectedPage.annotations.strokes.find((stroke) => stroke.id === selectedStrokeId) ?? null;
  }, [selectedPage, selectedStrokeId]);
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
          setProject(ensureProjectMeta(snapshot));
          setSelectedPageId(snapshot.pages[0].id);
          setStatus("Son calisma geri yuklendi.");
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    loadHistoryProjects()
      .then((projects) => setHistoryProjects(projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))))
      .catch(() => undefined);
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
        .then(() => saveHistoryProject(project))
        .then(() => loadHistoryProjects())
        .then((projects) => setHistoryProjects(projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))))
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
        ...current,
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
    const targetPageId = replaceTargetPageId ?? selectedPageId;
    const targetPage = project.pages.find((page) => page.id === targetPageId);
    const targetPageIndex = project.pages.findIndex((page) => page.id === targetPageId);

    if (!files.length || !targetPage) {
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
        pages.splice(targetPageIndex, 1, ...replacementPages);

        return {
          ...current,
          documents: [...current.documents, ...newDocuments],
          pages,
        };
      });

      setSelectedPageId(replacementPages[0].id);
      setSelectedItemId(null);
      setSelectedStrokeId(null);
      setTool("select");
      setStatus(
        replacementPages.length > 1
          ? "Secili sayfa degistirildi, kalan sayfalar arkasina eklendi."
          : "Secili sayfa degistirildi.",
      );
    } catch {
      setStatus("Secili sayfa degistirilemedi.");
    } finally {
      setReplaceTargetPageId(null);
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
    setSelectedStrokeId(null);
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
    setSelectedStrokeId(null);
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
    setSelectedStrokeId(null);
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
    if (!selectedPage) {
      return;
    }

    if (selectedItem) {
      patchSelectedPage((page) => ({
        ...page,
        annotations: {
          ...page.annotations,
          items: page.annotations.items.filter((item) => item.id !== selectedItem.id),
        },
      }));
    }

    if (selectedStroke) {
      patchSelectedPage((page) => ({
        ...page,
        annotations: {
          ...page.annotations,
          strokes: page.annotations.strokes.filter((stroke) => stroke.id !== selectedStroke.id),
        },
      }));
    }

    setSelectedItemId(null);
    setSelectedStrokeId(null);
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
          <h1>{editMode ? "Duzenle" : "PDF duzenleme"}</h1>
        </div>
        {editMode ? (
          <div className="toolbar-actions">
            <button
              className="primary-btn"
              title="Ana menuye don"
              onClick={() => {
                setEditMode(false);
                setTool("select");
                setSignatureListOpen(false);
              }}
            >
              <ArrowLeft size={18} />
              Geri
            </button>
          </div>
        ) : (
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
            {project.pages.length ? (
              <button
                className="primary-btn"
                title="Duzenle"
                onClick={() => {
                  setEditMode(true);
                  setTool("select");
                  setSignatureListOpen(false);
                }}
              >
                <PencilLine size={18} />
                Duzenle
              </button>
            ) : null}
          </div>
        )}
      </header>

      <main className="workspace-shell">
        {project.pages.length && !editMode ? (
          <OverviewScreen
            documentsById={documentsById}
            onDeletePage={(pageId) => {
              setProject((current) => {
                const pages = current.pages.filter((page) => page.id !== pageId);
                if (selectedPageId === pageId) {
                  setSelectedPageId(pages[0]?.id ?? null);
                }
                return { ...current, pages };
              });
            }}
            onEditPage={(pageId) => {
              setSelectedPageId(pageId);
              setEditMode(true);
              setTool("select");
            }}
            onReplacePage={(pageId) => {
              setReplaceTargetPageId(pageId);
              setSelectedPageId(pageId);
              window.setTimeout(() => replaceInputRef.current?.click(), 0);
            }}
            onSort={handleDragEnd}
            pages={project.pages}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            historyProjects={historyProjects}
            onDeleteHistory={async (projectId) => {
              await deleteHistoryProject(projectId);
              setHistoryProjects((current) => current.filter((item) => item.id !== projectId));
            }}
            onLoadHistory={(historyProject) => {
              const nextProject = ensureProjectMeta(historyProject);
              setProject(nextProject);
              setSelectedPageId(nextProject.pages[0]?.id ?? null);
              setSelectedItemId(null);
              setSelectedStrokeId(null);
              setTool("select");
            }}
          />
        ) : selectedPage ? (
          <>
            <section className="stage-shell">
              <div className="stage-topbar">
                <div className="page-badge">
                  {selectedPageIndex + 1} / {project.pages.length}
                </div>
              </div>

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
                selectedStroke={selectedStroke}
                setAccentColor={setAccentColor}
                setFontSize={setFontSize}
                setStrokeWidth={setStrokeWidth}
                setEraserSize={setEraserSize}
                setTextValue={setTextValue}
                signatureListOpen={signatureListOpen}
                signatureOptions={signatureOptions}
                strokeWidth={strokeWidth}
                eraserSize={eraserSize}
                textValue={textValue}
                tool={tool}
                updateSelectedItem={updateSelectedItem}
                updateSelectedItemScale={updateSelectedItemScale}
              />

              <PageEditor
                accentColor={accentColor}
                activeSignature={activeSignature}
                documentsById={documentsById}
                fontSize={fontSize}
                page={selectedPage}
                pageZoom={pageZoom}
                selectedItemId={selectedItemId}
                selectedStrokeId={selectedStrokeId}
                setSelectedItemId={setSelectedItemId}
                setSelectedStrokeId={setSelectedStrokeId}
                setStatus={setStatus}
                setTool={setTool}
                strokeWidth={strokeWidth}
                eraserSize={eraserSize}
                textValue={textValue}
                tool={tool}
                updatePage={updateSinglePage}
              />
            </section>

            <div className="zoom-strip">
              <button className="soft-btn icon-btn" title="Kucult" onClick={() => setPageZoom((current) => clamp(current - 0.02, 0.75, 1.5))}>
                <Minus size={18} />
              </button>
              <input
                aria-label="Sayfa yakinlastirma"
                max="1.5"
                min="0.75"
                step="0.01"
                type="range"
                value={pageZoom}
                onChange={(event) => setPageZoom(Number(event.target.value))}
              />
              <button className="soft-btn icon-btn" title="Buyut" onClick={() => setPageZoom((current) => clamp(current + 0.02, 0.75, 1.5))}>
                <Plus size={18} />
              </button>
              <span>{Math.round(pageZoom * 100)}%</span>
            </div>

          </>
        ) : (
          <EmptyState onAddA4={insertBlankA4Page} onUploadImage={() => imageInputRef.current?.click()} onUploadPdf={() => pdfInputRef.current?.click()} />
        )}
      </main>

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
  selectedStroke,
  setAccentColor,
  setFontSize,
  setEraserSize,
  setStrokeWidth,
  setTextValue,
  signatureListOpen,
  signatureOptions,
  strokeWidth,
  eraserSize,
  textValue,
  tool,
  updateSelectedItem,
  updateSelectedItemScale,
}) {
  const selectedScale = selectedItem?.type === "signature" ? selectedItem.width : selectedItem?.fontSize;
  const hasSelection = Boolean(selectedItem || selectedStroke);

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
        <button className={tool === "eraser" ? "tool-btn active" : "tool-btn"} title="Silgi" onClick={() => onActivateTool("eraser")}>
          <Eraser size={18} />
          Silgi
        </button>
        <button className="tool-btn danger" title="Katmani temizle" onClick={onClearCurrentAnnotations}>
          <Trash2 size={18} />
        </button>
      </div>

      {tool === "draw" || tool === "text" || tool === "eraser" ? (
        <div className="tool-settings">
          {tool !== "eraser" ? (
            <label className="swatch-control">
              <span>Renk</span>
              <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </label>
          ) : null}
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
          {tool === "eraser" ? (
            <label>
              <span>Silgi</span>
              <input
                max="90"
                min="10"
                type="range"
                value={eraserSize}
                onChange={(event) => setEraserSize(Number(event.target.value))}
              />
            </label>
          ) : null}
          {tool === "text" ? (
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

      {hasSelection ? (
        <div className="selection-bar">
          <span>{selectedStroke ? "Cizim" : selectedItem.type === "signature" ? "Imza" : "Metin"}</span>
          {selectedItem ? (
            <>
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
                <label className="swatch-control">
                  <span>Renk</span>
                  <input
                    type="color"
                    value={selectedItem.color}
                    onChange={(event) => updateSelectedItem({ color: event.target.value })}
                  />
                </label>
              ) : null}
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

function OverviewScreen({
  documentsById,
  historyProjects,
  onDeleteHistory,
  onDeletePage,
  onEditPage,
  onLoadHistory,
  onReplacePage,
  onSort,
  pages,
  selectedPageId,
  setSelectedPageId,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <section className="overview-screen">
      <div className="overview-header">
        <h2>Sayfalar</h2>
        <span>{pages.length} sayfa</span>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={onSort} sensors={sensors}>
        <SortableContext items={pages.map((page) => page.id)} strategy={horizontalListSortingStrategy}>
          <div className="overview-grid">
            {pages.map((page, index) => (
              <SortablePageCard
                key={page.id}
                index={index}
                isOverview
                isSelected={page.id === selectedPageId}
                onDeletePage={onDeletePage}
                onEditPage={onEditPage}
                onReplacePage={onReplacePage}
                page={page}
                setSelectedPageId={setSelectedPageId}
                sourceDocument={page.kind === "pdf" ? documentsById[page.sourceId] : null}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {historyProjects.length ? (
        <section className="history-panel">
          <div className="overview-header">
            <h2>Gecmis</h2>
            <span>{historyProjects.length} kayit</span>
          </div>
          <div className="history-list">
            {historyProjects.map((historyProject) => (
              <div key={historyProject.id} className="history-item">
                <button type="button" onClick={() => onLoadHistory(historyProject)}>
                  <strong>{historyProject.title || "PDF Projesi"}</strong>
                  <span>
                    {historyProject.pages.length} sayfa - {formatDate(historyProject.updatedAt)}
                  </span>
                </button>
                <button className="danger" type="button" onClick={() => onDeleteHistory(historyProject.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
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

function SortablePageCard({
  index,
  isOverview = false,
  isSelected,
  onDeletePage,
  onEditPage,
  onReplacePage,
  page,
  setSelectedPageId,
  sourceDocument,
}) {
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
    <div
      ref={setNodeRef}
      className={isOverview ? (isSelected ? "overview-card selected" : "overview-card") : (isSelected ? "thumb-card selected" : "thumb-card")}
      role="button"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      tabIndex={0}
      onClick={() => setSelectedPageId(page.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          setSelectedPageId(page.id);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className={isOverview ? "overview-frame" : "thumb-frame"} style={{ aspectRatio: `${page.width} / ${page.height}` }}>
        {preview ? <img alt="" src={preview} /> : <div className="blank-canvas" />}
      </div>
      <div className={isOverview ? "overview-meta" : "thumb-meta"}>
        <span>{index + 1}</span>
        <span className="thumb-grip">
          <GripVertical size={14} />
        </span>
      </div>
      {isOverview ? (
        <div className="overview-actions" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => onEditPage(page.id)}>
            <PencilLine size={16} />
          </button>
          <button type="button" onClick={() => onReplacePage(page.id)}>
            <Replace size={16} />
          </button>
          <button className="danger" type="button" onClick={() => onDeletePage(page.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PageEditor({
  accentColor,
  activeSignature,
  documentsById,
  fontSize,
  page,
  pageZoom,
  eraserSize,
  selectedItemId,
  selectedStrokeId,
  setSelectedItemId,
  setSelectedStrokeId,
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
  const resizeState = useRef(null);
  const strokeDragState = useRef(null);

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
      setSelectedStrokeId(null);
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
      setSelectedStrokeId(null);
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
      setSelectedStrokeId(stroke.id);
      setSelectedItemId(null);
      return;
    }

    if (tool === "eraser") {
      eraseAt(coords);
      return;
    }

    setSelectedItemId(null);
    setSelectedStrokeId(null);
  }

  function handleStagePointerMove(event) {
    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    if (tool === "select" && resizeState.current) {
      const state = resizeState.current;
      const dx = coords.x - state.start.x;
      const dy = coords.y - state.start.y;

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: page.annotations.items.map((item) => {
            if (item.id !== state.itemId) {
              return item;
            }

            if (state.type === "text") {
              return {
                ...item,
                fontSize: Math.round(clamp(state.fontSize + Math.max(dx, -dy) * 0.12, 8, 140)),
              };
            }

            const ratio = state.height / state.width || 0.4;
            const width = clamp(state.width + Math.max(dx, -dy * 1.8), 40, page.width);

            return {
              ...item,
              width: Math.round(width),
              height: Math.round(width * ratio),
            };
          }),
        },
      });
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

    if (tool === "select" && strokeDragState.current) {
      const { strokeId, previous } = strokeDragState.current;
      const dx = coords.x - previous.x;
      const dy = coords.y - previous.y;

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          strokes: page.annotations.strokes.map((stroke) =>
            stroke.id === strokeId
              ? {
                  ...stroke,
                  points: stroke.points.map((point) => ({
                    x: clamp(point.x + dx, 0, page.width),
                    y: clamp(point.y + dy, 0, page.height),
                  })),
                }
              : stroke,
          ),
        },
      });

      strokeDragState.current = { strokeId, previous: coords };
    }

    if (tool === "eraser") {
      eraseAt(coords);
    }
  }

  function handleStagePointerUp() {
    setDrawingStrokeId(null);
    dragState.current = null;
    resizeState.current = null;
    strokeDragState.current = null;
  }

  function beginItemDrag(item, event) {
    event.stopPropagation();

    if (tool === "eraser") {
      const coords = toPdfCoordinates(event.clientX, event.clientY);
      if (coords) {
        eraseAt(coords);
      }
      return;
    }

    setSelectedItemId(item.id);
    setSelectedStrokeId(null);

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

  function beginStrokeDrag(stroke, event) {
    event.stopPropagation();

    if (tool === "eraser") {
      const coords = toPdfCoordinates(event.clientX, event.clientY);
      if (coords) {
        eraseAt(coords);
      }
      return;
    }

    setSelectedStrokeId(stroke.id);
    setSelectedItemId(null);

    if (tool !== "select") {
      return;
    }

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    strokeDragState.current = {
      strokeId: stroke.id,
      previous: coords,
    };
  }

  function updateTextItem(itemId, text) {
    updatePage({
      ...page,
      annotations: {
        ...page.annotations,
        items: page.annotations.items.map((item) =>
          item.id === itemId ? { ...item, text } : item,
        ),
      },
    });
  }

  function eraseAt(coords) {
    const radius = eraserSize;

    updatePage({
      ...page,
      annotations: {
        items: page.annotations.items.filter((item) => !itemContainsPoint(item, coords, radius)),
        strokes: page.annotations.strokes.flatMap((stroke) => splitStrokeByEraser(stroke, coords, radius)),
      },
    });
    setSelectedItemId(null);
    setSelectedStrokeId(null);
  }

  function beginItemResize(item, event) {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedItemId(item.id);

    if (tool !== "select") {
      return;
    }

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    resizeState.current = {
      itemId: item.id,
      type: item.type,
      start: coords,
      width: item.width,
      height: item.height,
      fontSize: item.fontSize,
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
              <g key={stroke.id}>
                {stroke.id === selectedStrokeId ? (
                  <polyline
                    fill="none"
                    points={stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ")}
                    stroke="#2563eb"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={stroke.width + 7}
                  />
                ) : null}
                <polyline
                  fill="none"
                  points={stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ")}
                  stroke={stroke.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.width}
                />
                <polyline
                  className="stroke-hitbox"
                  fill="none"
                  points={stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ")}
                  stroke="transparent"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={Math.max(stroke.width + 18, 24)}
                  onPointerDown={(event) => beginStrokeDrag(stroke, event)}
                />
              </g>
            ))}
          </svg>

          {page.annotations.items.map((item) => (
            <AnnotationItem
              key={item.id}
              item={item}
              page={page}
              selected={item.id === selectedItemId}
              onPointerDown={beginItemDrag}
              onResizePointerDown={beginItemResize}
              onTextChange={updateTextItem}
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

function AnnotationItem({ item, onPointerDown, onResizePointerDown, onTextChange, page, selected }) {
  const left = `${(item.x / page.width) * 100}%`;
  const bottom = `${(item.y / page.height) * 100}%`;

  if (item.type === "text") {
    return (
      <div
        className={selected ? "annotation-item text selected" : "annotation-item text"}
        style={{ left, bottom, color: item.color, fontSize: `${item.fontSize}px` }}
        onPointerDown={(event) => onPointerDown(item, event)}
      >
        {selected ? (
          <textarea
            aria-label="Metin"
            className="inline-textarea"
            style={{ color: item.color, fontSize: `${item.fontSize}px` }}
            value={item.text}
            onChange={(event) => onTextChange(item.id, event.target.value)}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          />
        ) : (
          item.text
        )}
        {selected ? (
          <span
            aria-hidden="true"
            className="resize-handle"
            onPointerDown={(event) => onResizePointerDown(item, event)}
          />
        ) : null}
      </div>
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
      {selected ? (
        <span
          aria-hidden="true"
          className="resize-handle"
          onPointerDown={(event) => onResizePointerDown(item, event)}
        />
      ) : null}
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

function createProject() {
  return {
    id: uid("project"),
    title: "PDF Projesi",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    documents: [],
    pages: [],
  };
}

function ensureProjectMeta(project) {
  return {
    ...project,
    id: project.id ?? uid("project"),
    title: project.title ?? "PDF Projesi",
    createdAt: project.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    documents: project.documents ?? [],
    pages: project.pages ?? [],
  };
}

function itemContainsPoint(item, point, padding = 0) {
  if (item.type === "text") {
    const width = Math.max(item.text.length * item.fontSize * 0.55, item.fontSize * 3);
    const height = item.fontSize * Math.max(item.text.split("\n").length, 1) * 1.35;

    return (
      point.x >= item.x - padding &&
      point.x <= item.x + width + padding &&
      point.y <= item.y + padding &&
      point.y >= item.y - height - padding
    );
  }

  return (
    point.x >= item.x - padding &&
    point.x <= item.x + item.width + padding &&
    point.y <= item.y + padding &&
    point.y >= item.y - item.height - padding
  );
}

function splitStrokeByEraser(stroke, point, radius) {
  const segments = [];
  let currentSegment = [];

  stroke.points.forEach((strokePoint) => {
    if (distance(strokePoint, point) <= radius) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      return;
    }

    currentSegment.push(strokePoint);
  });

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments.map((points, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : uid("stroke"),
    points,
  }));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
