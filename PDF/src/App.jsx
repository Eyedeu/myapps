import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Download,
  Eraser,
  FilePlus2,
  FolderPlus,
  GripVertical,
  Highlighter,
  ImagePlus,
  Minus,
  MousePointer2,
  Pen,
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
  saveHistoryProject,
  saveSnapshot,
} from "./db";
import { triggerFileDownload } from "./triggerFileDownload";
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
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.02;
const DEFAULT_PAGE_ZOOM = 1.1;
const SIGNATURE_STORAGE_KEY = "pdf-pocket-studio-signatures";

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
  const [penMode, setPenMode] = useState("pen");
  const [eraserSize, setEraserSize] = useState(28);
  const [pageZoom, setPageZoom] = useState(DEFAULT_PAGE_ZOOM);
  const [status, setStatus] = useState("PDF yukleyin, foto ekleyin veya bos A4 sayfa olusturun.");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [signaturesHydrated, setSignaturesHydrated] = useState(false);
  const [signatureOptions, setSignatureOptions] = useState([]);
  const [activeSignatureId, setActiveSignatureId] = useState(null);
  const [viewScrollUnlocked, setViewScrollUnlocked] = useState(false);
  /** Metin: cift tik ile textarea; tek tik sadece secim + boyut tutamaclari */
  const [textEditingItemId, setTextEditingItemId] = useState(null);
  const [historyProjects, setHistoryProjects] = useState([]);
  const autosaveTimer = useRef(null);
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const embeddedPhotoInputRef = useRef(null);
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
  useEffect(() => {
    if (textEditingItemId && textEditingItemId !== selectedItemId) {
      setTextEditingItemId(null);
    }
  }, [selectedItemId, textEditingItemId]);

  const selectedPageIndex = useMemo(
    () => project.pages.findIndex((page) => page.id === selectedPageId),
    [project.pages, selectedPageId],
  );

  useEffect(() => {
    setIsHydrated(true);
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
      if (!shouldPersistProject(project)) {
        return;
      }
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
      if (!selectedPage) {
        return;
      }
      const fs = Math.round(scale);
      const oldFs = selectedItem.fontSize || 24;
      const r = fs / oldFs;
      const { width: w0, height: h0 } = getTextLayoutSize(selectedItem);
      const width = Math.min(Math.max(24, Math.round(w0 * r)), selectedPage.width - selectedItem.x);
      const height = Math.max(24, Math.round(h0 * r));
      const m = measureTextBox(selectedItem.text, fs);
      updateSelectedItem({
        fontSize: fs,
        width: Math.max(width, Math.min(m.width, selectedPage.width - selectedItem.x)),
        height: Math.max(height, m.height),
      });
      return;
    }

    const ratio = selectedItem.height / selectedItem.width || 0.4;
    updateSelectedItem({
      width: Math.round(scale),
      height: Math.round(scale * ratio),
    });
  }

  function addEmbeddedImageToPage(dataUrl, naturalW, naturalH) {
    if (!selectedPage) {
      return;
    }
    const maxW = Math.min(280, selectedPage.width * 0.55, selectedPage.width - 8);
    const w = Math.min(naturalW, maxW, selectedPage.width - 8);
    const h = (naturalH * w) / naturalW;
    const x = (selectedPage.width - w) / 2;
    const y = (selectedPage.height - h) / 2;
    const item = {
      id: uid("item"),
      type: "embeddedImage",
      dataUrl,
      x: Math.max(4, Math.min(x, selectedPage.width - w - 4)),
      y: Math.max(4, Math.min(y, selectedPage.height - h - 4)),
      width: w,
      height: h,
    };
    patchSelectedPage((page) => ({
      ...page,
      annotations: { ...page.annotations, items: [...page.annotations.items, item] },
    }));
    setSelectedItemId(item.id);
    setSelectedStrokeId(null);
    setTool("select");
    setStatus("Gorsel eklendi. Surukleyin, koseden boyutlandirin. Indir digiminde sayfada yer alir.");
  }

  function handleEmbeddedPhotoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!selectedPage) {
      setStatus("Once duzenlemek icin bir sayfa secin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => addEmbeddedImageToPage(dataUrl, img.naturalWidth, img.naturalHeight);
      img.onerror = () => setStatus("Gorsel yuklenemedi.");
      img.src = dataUrl;
    };
    reader.onerror = () => setStatus("Gorsel okunamadi.");
    reader.readAsDataURL(file);
  }

  const toggleViewScroll = useCallback(() => {
    setViewScrollUnlocked((prev) => {
      const next = !prev;
      if (!prev) {
        setTool("select");
        setTextEditingItemId(null);
      }
      setStatus(
        next
          ? "Sayfa kaydirma: acik. Duzenleme dugmesiyle tekrar duzenlemeye donun."
          : "Duzenleme modu. Metin, imza ve cizim araclari aktif.",
      );
      return next;
    });
  }, []);

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

  function startNewProject() {
    setProject(createProject());
    setSelectedPageId(null);
    setSelectedItemId(null);
    setSelectedStrokeId(null);
    setReplaceTargetPageId(null);
    setEditMode(false);
    setTool("select");
    setSignatureListOpen(false);
    setPageZoom(DEFAULT_PAGE_ZOOM);
    setViewScrollUnlocked(false);
    setTextEditingItemId(null);
    setStatus("Yeni proje. PDF, foto veya A4 ekleyin.");
  }

  function downloadPdfFileName() {
    const base = (project.title || "pdf-pocket-studio").replace(/[<>:"/\\|?*]/g, "-").trim() || "cikti";
    return `${base}-${Date.now()}.pdf`;
  }

  async function downloadProject() {
    if (!project.pages.length) {
      return;
    }

    setIsExporting(true);
    setStatus("PDF hazirlaniyor...");

    try {
      const bytes = await exportProject(project);
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const name = downloadPdfFileName();
      triggerFileDownload(u8, name, "application/pdf");
      setStatus("PDF indirildi.");
    } catch (err) {
      console.error("PDF export", err);
      setStatus("PDF disa aktarilamadi. Konsoldaki hatayi kontrol edin veya sayfalari yenileyin.");
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
      <input accept="image/*" hidden ref={embeddedPhotoInputRef} type="file" onChange={handleEmbeddedPhotoFile} />
      <input
        accept="application/pdf,image/*"
        hidden
        multiple
        ref={replaceInputRef}
        type="file"
        onChange={handleReplaceUpload}
      />

      {!editMode ? (
        <header className="topbar">
          <div>
            <p className="eyebrow">PDF Pocket Studio</p>
            <h1>PDF duzenleme</h1>
          </div>
          <div className="toolbar-actions">
            <button className="soft-btn" type="button" title="Bos yeni proje" onClick={startNewProject}>
              <FolderPlus size={18} />
              Yeni proje
            </button>
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
              {isExporting ? "Hazirlaniyor" : "Indir"}
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
        </header>
      ) : null}

      <main
        className={
          editMode && selectedPage
            ? "workspace-shell workspace-shell--editing"
            : "workspace-shell"
        }
      >
        {!editMode ? (
          <OverviewScreen
            documentsById={documentsById}
            onAddA4={insertBlankA4Page}
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
            onUploadImage={() => imageInputRef.current?.click()}
            onUploadPdf={() => pdfInputRef.current?.click()}
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
            <section className="stage-shell stage-shell--edit">
              <EditToolbar
                accentColor={accentColor}
                activeSignature={activeSignature}
                exportDisabled={!project.pages.length}
                fontSize={fontSize}
                isExporting={isExporting}
                onActivateTool={activateEditTool}
                onBack={() => {
                  setEditMode(false);
                  setTool("select");
                  setSignatureListOpen(false);
                  setViewScrollUnlocked(false);
                }}
                onAddEmbeddedImage={() => embeddedPhotoInputRef.current?.click()}
                viewScrollUnlocked={viewScrollUnlocked}
                onViewScrollToggle={toggleViewScroll}
                onCreateSignature={() => setSignaturePickerOpen(true)}
                onDownloadPdf={downloadProject}
                onChangePageByIndex={(index) => {
                  const next = project.pages[index];
                  if (next) {
                    setSelectedPageId(next.id);
                    setSelectedItemId(null);
                    setSelectedStrokeId(null);
                  }
                }}
                pageCount={project.pages.length}
                selectedPageIndex={selectedPageIndex}
                pageZoom={pageZoom}
                setPageZoom={setPageZoom}
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
                penMode={penMode}
                setPenMode={setPenMode}
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
                penMode={penMode}
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
                viewScrollUnlocked={viewScrollUnlocked}
                setPageZoom={setPageZoom}
                textEditingItemId={textEditingItemId}
                setTextEditingItemId={setTextEditingItemId}
              />
            </section>

          </>
        ) : (
          <EmptyState onAddA4={insertBlankA4Page} onUploadImage={() => imageInputRef.current?.click()} onUploadPdf={() => pdfInputRef.current?.click()} />
        )}
      </main>

      {signaturePickerOpen ? (
        <SignatureModal
          initialInkColor={accentColor}
          onClose={() => setSignaturePickerOpen(false)}
          onSave={(payload) => {
            const customSignature = {
              id: uid("signature"),
              label: "Benim imzam",
              dataUrl: payload.dataUrl,
              naturalWidth: payload.naturalWidth,
              naturalHeight: payload.naturalHeight,
              inkColor: payload.inkColor ?? "#111827",
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

function PageIndexControl({ pageCount, pageIndex, onChangeIndex }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (isEditing) {
      setDraft(String(pageIndex + 1));
    }
  }, [isEditing, pageIndex]);

  function commit() {
    const n = Math.floor(Number(draft));
    if (Number.isFinite(n) && n >= 1 && n <= pageCount) {
      onChangeIndex(n - 1);
    }
    setIsEditing(false);
  }

  if (pageCount < 1) {
    return null;
  }

  return (
    <div className="page-index-control" role="group" aria-label="Sayfa">
      <button
        className="page-index-nav"
        type="button"
        disabled={pageIndex <= 0}
        title="Onceki sayfa"
        aria-label="Onceki sayfa"
        onClick={() => onChangeIndex(pageIndex - 1)}
      >
        <ChevronUp size={16} />
      </button>
      {isEditing ? (
        <input
          autoFocus
          aria-label="Sayfa numarasi"
          className="page-index-input"
          max={pageCount}
          min={1}
          type="number"
          value={draft}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }
            if (event.key === "Escape") {
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <button
          className="page-index-display"
          type="button"
          title="Sayfa numarasina git (tikla, duzelt)"
          onClick={() => setIsEditing(true)}
        >
          <span className="page-index-current">{pageIndex + 1}</span>
          <span className="page-index-muted"> / {pageCount}</span>
        </button>
      )}
      <button
        className="page-index-nav"
        type="button"
        disabled={pageIndex >= pageCount - 1}
        title="Sonraki sayfa"
        aria-label="Sonraki sayfa"
        onClick={() => onChangeIndex(pageIndex + 1)}
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

function EditToolbar({
  accentColor,
  activeSignature,
  exportDisabled,
  fontSize,
  isExporting,
  onActivateTool,
  onAddEmbeddedImage,
  onBack,
  onChangePageByIndex,
  onCreateSignature,
  onDownloadPdf,
  onRemoveSelectedItem,
  onRemoveSignature,
  onSelectSignature,
  onViewScrollToggle,
  pageCount,
  pageZoom,
  selectedPageIndex,
  setPageZoom,
  selectedItem,
  selectedStroke,
  setAccentColor,
  setFontSize,
  setEraserSize,
  setPenMode,
  setStrokeWidth,
  setTextValue,
  signatureListOpen,
  signatureOptions,
  penMode,
  strokeWidth,
  eraserSize,
  textValue,
  tool,
  updateSelectedItem,
  updateSelectedItemScale,
  viewScrollUnlocked,
}) {
  const selectedScale =
    selectedItem?.type === "signature" || selectedItem?.type === "embeddedImage"
      ? selectedItem.width
      : selectedItem?.fontSize;
  const hasSelection = Boolean(selectedItem || selectedStroke);
  const subpanelTool = tool === "draw" || tool === "text" || tool === "eraser" ? tool : null;
  const showToolRow = Boolean(subpanelTool);
  const showSelectionRow = hasSelection;
  const showSignatureTray = tool === "signature" && signatureListOpen;

  return (
    <div className="edit-chrome">
      <div className="edit-toolbar-row">
        <div className="tool-rail tool-rail--main" role="toolbar" aria-label="Duzenleme araclari">
          <button
            type="button"
            className="tool-rail__btn tool-rail__btn--back"
            title="Ana menuye don"
            aria-label="Ana menuye don"
            onClick={onBack}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className={tool === "select" ? "tool-rail__btn is-active" : "tool-rail__btn"}
            title="Sec"
            onClick={() => onActivateTool("select")}
          >
            <MousePointer2 size={20} />
            <span>Sec</span>
          </button>
          <button
            type="button"
            className={tool === "draw" ? "tool-rail__btn is-active" : "tool-rail__btn"}
            title="Ciz"
            onClick={() => onActivateTool("draw")}
          >
            <PencilLine size={20} />
            <span>Ciz</span>
          </button>
          <button
            type="button"
            className={tool === "text" ? "tool-rail__btn is-active" : "tool-rail__btn"}
            title="Metin"
            onClick={() => onActivateTool("text")}
          >
            <Type size={20} />
            <span>Metin</span>
          </button>
          <button
            type="button"
            className={tool === "signature" ? "tool-rail__btn is-active" : "tool-rail__btn"}
            title="Imza"
            onClick={() => onActivateTool("signature")}
          >
            <Signature size={20} />
            <span>Imza</span>
          </button>
          <button
            type="button"
            className={tool === "eraser" ? "tool-rail__btn is-active" : "tool-rail__btn"}
            title="Silgi"
            onClick={() => onActivateTool("eraser")}
          >
            <Eraser size={20} />
            <span>Silgi</span>
          </button>
          <button
            type="button"
            className="tool-rail__btn"
            title="Sayfaya gorsel (PDF'de gosterilir, surulebilir, boyutlanir)"
            onClick={onAddEmbeddedImage}
          >
            <ImagePlus size={20} />
            <span>Sayfa gorsel</span>
          </button>
          <button
            type="button"
            className="tool-rail__btn tool-rail__btn--download"
            title="PDF indir"
            disabled={exportDisabled || isExporting}
            onClick={() => onDownloadPdf()}
          >
            <Download size={20} />
            <span>{isExporting ? "Hazirlaniyor" : "Indir"}</span>
          </button>
          <div className="tool-rail__trailing">
            <PageIndexControl onChangeIndex={onChangePageByIndex} pageCount={pageCount} pageIndex={selectedPageIndex} />
            <div className="tool-rail__zoom" title="Yakinlastirma: slider veya mobilde 2 parmak (pinch)">
              <button
                type="button"
                className={viewScrollUnlocked ? "view-scroll-pill is-on" : "view-scroll-pill"}
                title="Sayfayi kaydirma ve duzenleme modu arasinda gec"
                onClick={onViewScrollToggle}
              >
                {viewScrollUnlocked ? "Kaydirma" : "Duzenleme"}
              </button>
              <button
                className="zoom-inline-btn"
                type="button"
                aria-label="Kucult"
                onClick={() => setPageZoom((current) => clamp(current - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
              >
                <Minus size={16} />
              </button>
              <input
                aria-label="Sayfa yakinlastirma"
                className="zoom-inline-slider"
                max={ZOOM_MAX}
                min={ZOOM_MIN}
                step="0.01"
                type="range"
                value={pageZoom}
                onChange={(event) => setPageZoom(clamp(Number(event.target.value), ZOOM_MIN, ZOOM_MAX))}
              />
              <button
                className="zoom-inline-btn"
                type="button"
                aria-label="Buyut"
                onClick={() => setPageZoom((current) => clamp(current + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
              >
                <Plus size={16} />
              </button>
              <span className="zoom-inline-pct">{Math.round(pageZoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={
          showSignatureTray ? "edit-chrome__subpanel edit-chrome__subpanel--signature" : "edit-chrome__subpanel"
        }
        aria-live="polite"
      >
        {showSignatureTray ? (
          <div className="subpanel-row subpanel-row--signature">
            <div className="signature-tray-pro signature-tray-pro--inline">
              <div className="signature-tray-pro__head">
                <span>Imza sec</span>
                <button className="signature-tray-pro__add" type="button" onClick={onCreateSignature}>
                  <Plus size={16} />
                  Yeni ciz
                </button>
              </div>
              <div className="signature-tray-pro__scroll">
                {signatureOptions.length ? (
                  signatureOptions.map((option) => (
                    <div
                      key={option.id}
                      className={option.id === activeSignature?.id ? "sig-card is-active" : "sig-card"}
                    >
                      <button className="sig-card__img" type="button" onClick={() => onSelectSignature(option.id)}>
                        <img alt={option.label} src={option.dataUrl} />
                      </button>
                      <button className="sig-card__del" type="button" title="Kaldir" onClick={() => onRemoveSignature(option.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="signature-tray-pro__empty">Henuz imza yok. &quot;Yeni ciz&quot; ile ekleyin.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {showToolRow && subpanelTool === "draw" ? (
          <div className="subpanel-row subpanel-row--draw">
            <div className="draw-pen-modes" role="group" aria-label="Kalem turu">
              <button
                type="button"
                className={penMode === "pen" ? "pen-mode is-active" : "pen-mode"}
                title="Kalem"
                onClick={() => setPenMode("pen")}
              >
                <Pen size={15} />
                <span>Kalem</span>
              </button>
              <button
                type="button"
                className={penMode === "highlighter" ? "pen-mode is-active" : "pen-mode"}
                title="Vurgulayici"
                onClick={() => setPenMode("highlighter")}
              >
                <Highlighter size={15} />
                <span>Vurgu</span>
              </button>
            </div>
            <div className="subpanel-swatch" title="Renk">
              <input aria-label="Cizim rengi" className="color-swatch" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </div>
            <div className="subpanel-group subpanel-group--grow">
              <span className="subpanel-w">{penMode === "highlighter" ? "Kalin" : "Cizgi"}</span>
              <input
                className="subpanel-slider"
                max="12"
                min="1"
                type="range"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
              <span className="subpanel-val">{strokeWidth} pt</span>
            </div>
          </div>
        ) : null}
        {showToolRow && subpanelTool === "text" ? (
          <div className="subpanel-row subpanel-row--tool subpanel-row--text">
            <span className="subpanel-w">Metin</span>
            <div className="subpanel-swatch" title="Renk">
              <input aria-label="Renk" className="color-swatch" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </div>
            <input
              className="subpanel-text"
              type="text"
              value={textValue}
              placeholder={DEFAULT_TEXT}
              onChange={(event) => setTextValue(event.target.value)}
            />
            <div className="subpanel-group">
              <span className="subpanel-w">Punto</span>
              <input
                className="subpanel-slider"
                max="96"
                min="10"
                type="range"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
              <span className="subpanel-val">{fontSize} px</span>
            </div>
          </div>
        ) : null}
        {showToolRow && subpanelTool === "eraser" ? (
          <div className="subpanel-row subpanel-row--tool">
            <span className="subpanel-w">Silgi</span>
            <div className="subpanel-group subpanel-group--grow">
              <input
                className="subpanel-slider"
                max="90"
                min="10"
                type="range"
                value={eraserSize}
                onChange={(event) => setEraserSize(Number(event.target.value))}
              />
              <span className="subpanel-val">{eraserSize} px</span>
            </div>
          </div>
        ) : null}
        {showSelectionRow && selectedItem ? (
          <div className="subpanel-row subpanel-row--selection">
            <span className="subpanel-kind">
              {selectedStroke
                ? "Cizim"
                : selectedItem.type === "signature"
                  ? "Imza"
                  : selectedItem.type === "embeddedImage"
                    ? "Gorsel"
                    : "Metin"}
            </span>
            <div className="subpanel-group">
              <span className="subpanel-w">Boyut</span>
              <input
                className="subpanel-slider"
                max={selectedItem.type === "text" ? "120" : "520"}
                min={selectedItem.type === "text" ? "10" : "60"}
                type="range"
                value={selectedScale}
                onChange={(event) => updateSelectedItemScale(Number(event.target.value))}
              />
            </div>
            {selectedItem.type === "text" ? (
              <div className="subpanel-swatch" title="Metin rengi">
                <input
                  aria-label="Metin rengi"
                  className="color-swatch"
                  type="color"
                  value={selectedItem.color}
                  onChange={(event) => updateSelectedItem({ color: event.target.value })}
                />
              </div>
            ) : null}
            <button
              className="subpanel-del"
              type="button"
              title="Secili ogeyi sil (Delete)"
              onClick={onRemoveSelectedItem}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : null}
        {showSelectionRow && selectedStroke && !selectedItem ? (
          <div className="subpanel-row subpanel-row--selection">
            <span className="subpanel-kind">Cizim</span>
            <button className="subpanel-del" type="button" title="Secileni sil" onClick={onRemoveSelectedItem}>
              <Trash2 size={18} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OverviewScreen({
  documentsById,
  historyProjects,
  onAddA4,
  onDeleteHistory,
  onDeletePage,
  onEditPage,
  onLoadHistory,
  onReplacePage,
  onSort,
  onUploadImage,
  onUploadPdf,
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
      {pages.length === 0 ? (
        <EmptyState onAddA4={onAddA4} onUploadImage={onUploadImage} onUploadPdf={onUploadPdf} />
      ) : (
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
      )}
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

/** Onizleme / PDF ile ayni sans ailesi; canvas olcumu webde kirpilmayi onler. */
const ANNOTATION_TEXT_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

let measureTextCanvas;
let measureTextContext;
function getMeasureTextContext() {
  if (!measureTextCanvas) {
    measureTextCanvas = document.createElement("canvas");
    measureTextContext = measureTextCanvas.getContext("2d");
  }
  return measureTextContext;
}

/** Metin kutusu boyutu (PDF birimi); gercek glyph genisligi + pay. */
function measureTextBox(text, fontSize) {
  const ctx = getMeasureTextContext();
  if (!ctx) {
    const s = String(text);
    const lines = Math.max(s.split("\n").length, 1);
    const ch = Math.max(s.replace(/\n/g, "").length, 1);
    return {
      width: Math.max(ch * fontSize * 0.68, fontSize * 3.5) + fontSize * 0.5,
      height: Math.max(fontSize * lines * 1.45, fontSize * 1.55),
    };
  }
  ctx.font = `${fontSize}px ${ANNOTATION_TEXT_FONT_STACK}`;
  const parts = String(text).split("\n");
  let maxW = fontSize * 0.35;
  for (const line of parts) {
    const lineStr = line.length ? line : " ";
    const w = ctx.measureText(lineStr).width;
    if (w > maxW) {
      maxW = w;
    }
  }
  const lineCount = Math.max(parts.length, 1);
  const padX = fontSize * 0.22;
  const width = Math.ceil(maxW + padX * 2);
  const height = Math.ceil(Math.max(fontSize * lineCount * 1.45, fontSize * 1.55));
  return { width, height };
}

function shouldUseImmediateTextDrag(event) {
  if (event.pointerType === "touch" || event.pointerType === "pen") {
    return true;
  }
  if (event.pointerType && event.pointerType !== "mouse") {
    return true;
  }
  if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) {
    return true;
  }
  if (typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(pointer: coarse)").matches) {
    return true;
  }
  return false;
}

function getTextLayoutSize(item) {
  if (item.width != null && item.height != null) {
    return { width: item.width, height: item.height };
  }
  return measureTextBox(item.text, item.fontSize);
}

/** Koseyle verilen kutuya sigacak en buyuk punto (ikili arama). */
function fitFontSizeToBox(text, maxW, maxH) {
  const w = Math.max(24, maxW);
  const h = Math.max(24, maxH);
  let lo = 8;
  let hi = 140;
  let best = 8;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { width, height } = measureTextBox(text ?? "", mid);
    if (width <= w && height <= h) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Imza / gorsel / metin kutusu: ayni PDF kose geometrisi (x,y,w,h). */
function computeResizePatch(state, coords, pageW, pageH) {
  const dx = coords.x - state.start.x;
  const dy = coords.y - state.start.y;
  const { x0, y0, w0, h0, handle, type, text } = state;

  const ratio0 = h0 / w0 || 0.4;
  const top0 = y0 + h0;
  const right0 = x0 + w0;
  let x = x0;
  let y = y0;
  let w = w0;
  let h = h0;

  switch (handle) {
    case "br": {
      w = clamp(w0 + Math.max(dx, -dy * 1.8), 24, pageW - x0);
      h = w * ratio0;
      break;
    }
    case "tr": {
      w = clamp(coords.x - x0, 24, pageW - x0);
      h = w * ratio0;
      x = x0;
      y = y0;
      break;
    }
    case "bl": {
      w = clamp(right0 - coords.x, 24, right0);
      h = w * ratio0;
      x = right0 - w;
      y = top0 - h;
      break;
    }
    case "tl": {
      h = clamp(coords.y - y0, 24, top0 - y0);
      w = h / ratio0;
      x = right0 - w;
      y = y0;
      break;
    }
    default: {
      w = clamp(w0 + Math.max(dx, -dy * 1.8), 24, pageW - x0);
      h = w * ratio0;
      x = x0;
      y = y0;
    }
  }

  w = Math.round(clamp(w, 24, pageW));
  h = Math.round(clamp(h, 24, pageH));
  x = clamp(x, 0, Math.max(0, pageW - w));
  y = clamp(y, 0, Math.max(0, pageH - h));
  if (y + h > pageH) {
    h = Math.max(24, pageH - y);
  }
  if (x + w > pageW) {
    w = Math.max(24, pageW - x);
  }
  const patch = { x, y, width: w, height: h };
  if (type === "text") {
    patch.fontSize = fitFontSizeToBox(text ?? "", w, h);
  }
  return patch;
}

const TEXT_DRAG_THRESHOLD_PX = 14;
/** Parmak kalkinca metin edit: sadece gercekten hareketsiz dokunus */
const TEXT_TAP_EDIT_MAX_DRAG_PX = 10;

function PageEditor({
  accentColor,
  activeSignature,
  documentsById,
  fontSize,
  page,
  pageZoom,
  penMode,
  eraserSize,
  selectedItemId,
  selectedStrokeId,
  setSelectedItemId,
  setSelectedStrokeId,
  setStatus,
  setPageZoom,
  setTextEditingItemId,
  setTool,
  strokeWidth,
  textEditingItemId,
  textValue,
  tool,
  updatePage,
  viewScrollUnlocked,
}) {
  const hostRef = useRef(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const [drawingStrokeId, setDrawingStrokeId] = useState(null);
  const [eraserGuide, setEraserGuide] = useState(null);
  /** Masaustu: sadece sol tik basiliyken sil; touch/pen: baslangic pointerId ile ayni temas. */
  const eraserActivePointerIdRef = useRef(null);
  const dragState = useRef(null);
  /** Metin: gercek surukleme baslamadan once parmak hareketi (imza aninda surukleme) */
  const itemDragArmRef = useRef(null);
  const resizeState = useRef(null);
  const strokeDragState = useRef(null);
  const annotationPointerCaptureRef = useRef(null);
  const pageSyncRef = useRef(page);
  const itemDragRafRef = useRef(null);
  const pendingItemDragRef = useRef(null);
  const resizeRafRef = useRef(null);
  const pendingResizeRef = useRef(null);
  const pageRef = useRef(page);
  const pageZoomRef = useRef(pageZoom);
  const drawingStrokeIdRef = useRef(drawingStrokeId);
  const pinchStateRef = useRef(null);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    pageSyncRef.current = page;
  }, [page]);
  useEffect(() => {
    pageZoomRef.current = pageZoom;
  }, [pageZoom]);
  useEffect(() => {
    drawingStrokeIdRef.current = drawingStrokeId;
  }, [drawingStrokeId]);

  useEffect(() => {
    if (!textEditingItemId) {
      return undefined;
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setTextEditingItemId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [textEditingItemId, setTextEditingItemId]);

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

  const prevPageIdForCenterRef = useRef(null);
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || hostSize.width < 4) {
      return;
    }
    const isNewPage = prevPageIdForCenterRef.current !== page.id;
    prevPageIdForCenterRef.current = page.id;
    if (!isNewPage) {
      return;
    }
    requestAnimationFrame(() => {
      const stageEl = hostRef.current;
      if (!stageEl) {
        return;
      }
      stageEl.scrollLeft = Math.max(0, (stageEl.scrollWidth - stageEl.clientWidth) / 2);
      stageEl.scrollTop = Math.max(0, (stageEl.scrollHeight - stageEl.clientHeight) / 2);
    });
  }, [page.id, hostSize.width, hostSize.height, pageZoom, page.width, page.height]);

  useEffect(() => {
    if (tool !== "eraser") {
      setEraserGuide(null);
      eraserActivePointerIdRef.current = null;
    }
  }, [tool]);

  useEffect(() => {
    if (tool !== "eraser" || !hostRef.current) {
      return undefined;
    }
    const el = hostRef.current;
    const blockScrollWhenErasing = (event) => {
      if (eraserActivePointerIdRef.current != null) {
        event.preventDefault();
      }
    };
    const opts = { capture: true, passive: false };
    el.addEventListener("pointermove", blockScrollWhenErasing, opts);
    el.addEventListener("pointercancel", blockScrollWhenErasing, opts);
    return () => {
      el.removeEventListener("pointermove", blockScrollWhenErasing, opts);
      el.removeEventListener("pointercancel", blockScrollWhenErasing, opts);
    };
  }, [tool]);

  const lastPointerTapRef = useRef({ t: 0, x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }

    function touchDist(touches) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    function cancelOngoingForPinch() {
      const sid = drawingStrokeIdRef.current;
      if (sid) {
        const p = pageRef.current;
        updatePage({
          ...p,
          annotations: {
            ...p.annotations,
            strokes: p.annotations.strokes.filter((stroke) => stroke.id !== sid),
          },
        });
        setDrawingStrokeId(null);
      }
      eraserActivePointerIdRef.current = null;
      setEraserGuide(null);
      dragState.current = null;
      itemDragArmRef.current = null;
      resizeState.current = null;
      strokeDragState.current = null;
    }

    const onTouchStart = (event) => {
      if (event.touches.length !== 2) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      cancelOngoingForPinch();
      const d0 = touchDist(event.touches);
      if (d0 < 8) {
        pinchStateRef.current = null;
        return;
      }
      pinchStateRef.current = { d0, z0: pageZoomRef.current };
    };

    const onTouchMove = (event) => {
      if (event.touches.length !== 2 || !pinchStateRef.current) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      const d = touchDist(event.touches);
      const { d0, z0 } = pinchStateRef.current;
      if (d < 2) {
        return;
      }
      const z = clamp(z0 * (d / d0), ZOOM_MIN, ZOOM_MAX);
      setPageZoom(z);
    };

    const onTouchEnd = (event) => {
      if (event.touches.length < 2) {
        pinchStateRef.current = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    el.addEventListener("touchend", onTouchEnd, { capture: true });
    el.addEventListener("touchcancel", onTouchEnd, { capture: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart, { capture: true });
      el.removeEventListener("touchmove", onTouchMove, { capture: true });
      el.removeEventListener("touchend", onTouchEnd, { capture: true });
      el.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [setPageZoom, updatePage, setDrawingStrokeId]);

  function setErasingPointer(event) {
    if (event.pointerId != null) {
      eraserActivePointerIdRef.current = event.pointerId;
    }
    if (hostRef.current && event.pointerId != null) {
      try {
        hostRef.current.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
  }

  function clearErasingPointer(event) {
    if (!event) {
      return;
    }
    if (eraserActivePointerIdRef.current == null) {
      return;
    }
    if (event.pointerId === eraserActivePointerIdRef.current) {
      eraserActivePointerIdRef.current = null;
      if (hostRef.current) {
        try {
          hostRef.current.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }
    }
  }

  function isErasingPointerPressed(event) {
    if (event.buttons & 1) {
      return true;
    }
    if (eraserActivePointerIdRef.current == null || event.pointerId !== eraserActivePointerIdRef.current) {
      return false;
    }
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  const stagePadding = 24;
  const fitted = fitIntoBox(
    page.width,
    page.height,
    Math.max(hostSize.width - stagePadding, 1),
    Math.max(hostSize.height - stagePadding, 1),
  );
  const stageWidth = Math.max(1, Math.round(fitted.width * pageZoom));
  const stageHeight = Math.max(1, Math.round(fitted.height * pageZoom));

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

  function getAnnotationShellElement(pointerEvent) {
    const t = pointerEvent.currentTarget;
    if (t?.classList?.contains("annotation-text-selected-shell")) {
      return t.closest(".annotation-item") ?? t;
    }
    if (t?.classList?.contains("annotation-text-fill")) {
      return t.closest(".annotation-item") ?? t;
    }
    return t;
  }

  /** item.x, item.y ile piksel yerlesimi ayni referansi kullansin diye: kutunun sol-alti (PDF) */
  function getItemBottomLeftPdf(pointerEvent) {
    const shell = getAnnotationShellElement(pointerEvent);
    if (!shell) {
      return null;
    }
    const r = shell.getBoundingClientRect();
    return toPdfCoordinates(r.left, r.bottom);
  }

  function handleStagePointerDown(event) {
    if (viewScrollUnlocked) {
      return;
    }

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    if (tool === "text") {
      const t = textValue.trim() || DEFAULT_TEXT;
      const fs = fontSize;
      let { width: tw, height: th } = measureTextBox(t, fs);
      tw = Math.min(tw, page.width - 8);
      th = Math.min(th, page.height - 8);
      const x = clamp(coords.x - tw / 2, 4, Math.max(4, page.width - tw - 4));
      const y = clamp(coords.y - th / 2, 4, Math.max(4, page.height - th - 4));
      const item = {
        id: uid("item"),
        type: "text",
        text: t,
        x,
        y,
        color: accentColor,
        fontSize: fs,
        width: tw,
        height: th,
      };

      updatePage({
        ...page,
        annotations: {
          ...page.annotations,
          items: [...page.annotations.items, item],
        },
      });
      lastPointerTapRef.current = { t: 0, x: 0, y: 0 };
      setSelectedItemId(item.id);
      setSelectedStrokeId(null);
      setTextEditingItemId(null);
      setTool("select");
      setStatus("Metin eklendi. Tek tik: boyut; cift tik: yaz; surukleyerek tasiyin.");
      return;
    }

    if (tool === "signature") {
      if (!activeSignature) {
        setStatus("Once bir imza olusturun veya listedeki imzalardan birini secin.");
        return;
      }

      const dataUrl = activeSignature.dataUrl;

      function finalizePlacement(inkDataUrl, iw, ih) {
        const maxW = Math.min(240, page.width * 0.42, page.width - 8);
        const w = Math.min(Math.max(iw, 8), maxW);
        const h = Math.max((ih * w) / iw, 10);
        const x = clamp(coords.x - w / 2, 4, Math.max(4, page.width - w - 4));
        const y = clamp(coords.y - h / 2, 4, Math.max(4, page.height - h - 4));
        const item = {
          id: uid("item"),
          type: "signature",
          dataUrl: inkDataUrl,
          x,
          y,
          width: w,
          height: h,
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
        setStatus("Imza eklendi. Sadece cizgi gorunur; surukleyip boyutlandirabilirsiniz.");
      }

      const img = new Image();
      img.onload = () => {
        const trimmed = imageElementToTrimmedSignaturePng(img);
        if (trimmed) {
          finalizePlacement(trimmed.dataUrl, trimmed.naturalWidth, trimmed.naturalHeight);
        } else {
          finalizePlacement(dataUrl, img.naturalWidth || 180, img.naturalHeight || 72);
        }
      };
      img.onerror = () => {
        finalizePlacement(dataUrl, 180, 72);
      };
      img.src = dataUrl;
      return;
    }

    if (tool === "draw") {
      const stroke = {
        id: uid("stroke"),
        color: accentColor,
        width: strokeWidth,
        penMode: penMode === "highlighter" ? "highlighter" : "pen",
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
      setErasingPointer(event);
      setEraserGuide(coords);
      eraseAt(coords);
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    setSelectedItemId(null);
    setSelectedStrokeId(null);
    setTextEditingItemId(null);
  }

  function handleStagePointerMove(event) {
    if (viewScrollUnlocked) {
      return;
    }

    const coords = toPdfCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    if (tool === "eraser") {
      setEraserGuide(coords);
      if (isErasingPointerPressed(event) && event.cancelable) {
        event.preventDefault();
      }
    }

    if (tool === "select" && itemDragArmRef.current && !dragState.current) {
      const arm = itemDragArmRef.current;
      const dx = event.clientX - arm.originClientX;
      const dy = event.clientY - arm.originClientY;
      const d = Math.hypot(dx, dy);
      arm.maxDrag = Math.max(arm.maxDrag ?? 0, d);
      if (d * d >= TEXT_DRAG_THRESHOLD_PX * TEXT_DRAG_THRESHOLD_PX) {
        dragState.current = {
          itemId: arm.itemId,
          itemType: "text",
          offsetX: arm.offsetX,
          offsetY: arm.offsetY,
          originClientX: arm.originClientX,
          originClientY: arm.originClientY,
          maxDrag: d,
        };
        itemDragArmRef.current = null;
      }
    }

    if (tool === "select" && resizeState.current) {
      const state = resizeState.current;
      pendingResizeRef.current = { state, coords };
      if (!resizeRafRef.current) {
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = null;
          const pr = pendingResizeRef.current;
          if (!pr || !resizeState.current) {
            return;
          }
          const pg = pageSyncRef.current;
          const patch = computeResizePatch(pr.state, pr.coords, pg.width, pg.height);
          updatePage({
            ...pg,
            annotations: {
              ...pg.annotations,
              items: pg.annotations.items.map((item) => {
                if (item.id !== pr.state.itemId) {
                  return item;
                }
                return {
                  ...item,
                  x: patch.x,
                  y: patch.y,
                  width: patch.width,
                  height: patch.height,
                  ...(patch.fontSize != null ? { fontSize: patch.fontSize } : {}),
                };
              }),
            },
          });
        });
      }
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
      const drag = dragState.current;
      if (drag.originClientX != null && drag.originClientY != null) {
        const d = Math.hypot(event.clientX - drag.originClientX, event.clientY - drag.originClientY);
        drag.maxDrag = Math.max(drag.maxDrag ?? 0, d);
      }
      const { itemId, offsetX, offsetY } = drag;
      pendingItemDragRef.current = { itemId, coords, offsetX, offsetY };
      if (!itemDragRafRef.current) {
        itemDragRafRef.current = requestAnimationFrame(() => {
          itemDragRafRef.current = null;
          const p = pendingItemDragRef.current;
          if (!p || !dragState.current) {
            return;
          }
          const pg = pageSyncRef.current;
          updatePage({
            ...pg,
            annotations: {
              ...pg.annotations,
              items: pg.annotations.items.map((item) =>
                item.id === p.itemId
                  ? {
                      ...item,
                      x: clamp(p.coords.x - p.offsetX, 0, pg.width),
                      y: clamp(p.coords.y - p.offsetY, 0, pg.height),
                    }
                  : item,
              ),
            },
          });
        });
      }
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

    if (tool === "eraser" && isErasingPointerPressed(event)) {
      eraseAt(coords);
    }
  }

  function flushDragResizeFromPointer(event) {
    if (itemDragRafRef.current) {
      cancelAnimationFrame(itemDragRafRef.current);
      itemDragRafRef.current = null;
    }
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = null;
    }
    const c = event ? toPdfCoordinates(event.clientX, event.clientY) : null;
    const pg = pageSyncRef.current;
    if (c && dragState.current) {
      const { itemId, offsetX, offsetY } = dragState.current;
      updatePage({
        ...pg,
        annotations: {
          ...pg.annotations,
          items: pg.annotations.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  x: clamp(c.x - offsetX, 0, pg.width),
                  y: clamp(c.y - offsetY, 0, pg.height),
                }
              : item,
          ),
        },
      });
    } else if (c && resizeState.current) {
      const st = resizeState.current;
      const patch = computeResizePatch(st, c, pg.width, pg.height);
      updatePage({
        ...pg,
        annotations: {
          ...pg.annotations,
          items: pg.annotations.items.map((item) => {
            if (item.id !== st.itemId) {
              return item;
            }
            return {
              ...item,
              x: patch.x,
              y: patch.y,
              width: patch.width,
              height: patch.height,
              ...(patch.fontSize != null ? { fontSize: patch.fontSize } : {}),
            };
          }),
        },
      });
    }
    pendingItemDragRef.current = null;
    pendingResizeRef.current = null;
    itemDragArmRef.current = null;
  }

  function handleStagePointerUp(event) {
    const armPre = itemDragArmRef.current;
    const dragPre = dragState.current;
    const textTapItemId =
      tool === "select" &&
      armPre &&
      !dragPre &&
      (armPre.maxDrag ?? 0) < TEXT_TAP_EDIT_MAX_DRAG_PX
        ? armPre.itemId
        : tool === "select" &&
            dragPre?.itemType === "text" &&
            (dragPre.maxDrag ?? 0) < TEXT_TAP_EDIT_MAX_DRAG_PX
          ? dragPre.itemId
          : null;

    flushDragResizeFromPointer(event);
    clearErasingPointer(event);
    if (annotationPointerCaptureRef.current && event.pointerId != null) {
      try {
        annotationPointerCaptureRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      annotationPointerCaptureRef.current = null;
    }
    if (hostRef.current && event.pointerId != null) {
      try {
        hostRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    const endedStrokeId = drawingStrokeId;
    setDrawingStrokeId(null);
    if (endedStrokeId) {
      const ended = page.annotations.strokes.find((stroke) => stroke.id === endedStrokeId);
      if (ended && ended.points.length < 2) {
        updatePage({
          ...page,
          annotations: {
            ...page.annotations,
            strokes: page.annotations.strokes.filter((stroke) => stroke.id !== endedStrokeId),
          },
        });
      }
    }
    dragState.current = null;
    itemDragArmRef.current = null;
    resizeState.current = null;
    strokeDragState.current = null;

    if (textTapItemId) {
      const it = pageSyncRef.current.annotations.items.find((i) => i.id === textTapItemId);
      if (it?.type === "text") {
        setSelectedItemId(textTapItemId);
        setTextEditingItemId(textTapItemId);
      }
    }
  }

  function handleStagePointerLeave() {
    flushDragResizeFromPointer(null);
    setEraserGuide(null);
    setDrawingStrokeId(null);
    dragState.current = null;
    itemDragArmRef.current = null;
    resizeState.current = null;
    strokeDragState.current = null;
  }

  function beginItemDrag(item, event) {
    if (viewScrollUnlocked) {
      return;
    }

    event.stopPropagation();
    lastPointerTapRef.current = { t: 0, x: 0, y: 0 };
    const immediateText = item.type === "text" && shouldUseImmediateTextDrag(event);
    if (event.cancelable) {
      if (tool === "eraser") {
        event.preventDefault();
      } else if (item.type !== "text") {
        event.preventDefault();
      } else if (immediateText) {
        event.preventDefault();
      }
    }

    if (tool === "eraser") {
      setErasingPointer(event);
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

    const anchor = getItemBottomLeftPdf(event) ?? { x: item.x, y: item.y };
    const offsetX = coords.x - anchor.x;
    const offsetY = coords.y - anchor.y;
    if (item.type === "text" && !immediateText) {
      itemDragArmRef.current = {
        itemId: item.id,
        offsetX,
        offsetY,
        originClientX: event.clientX,
        originClientY: event.clientY,
        maxDrag: 0,
      };
    } else {
      dragState.current = {
        itemId: item.id,
        ...(item.type === "text"
          ? {
              itemType: "text",
              originClientX: event.clientX,
              originClientY: event.clientY,
              maxDrag: 0,
            }
          : {}),
        offsetX,
        offsetY,
      };
    }

    if (hostRef.current && event.pointerId != null) {
      try {
        hostRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    const shell = getAnnotationShellElement(event);
    if (shell && event.pointerId != null) {
      try {
        shell.setPointerCapture(event.pointerId);
        annotationPointerCaptureRef.current = shell;
      } catch {
        if (hostRef.current) {
          try {
            hostRef.current.setPointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
        annotationPointerCaptureRef.current = null;
      }
    }
  }

  function beginStrokeDrag(stroke, event) {
    if (viewScrollUnlocked) {
      return;
    }

    event.stopPropagation();

    if (tool === "eraser") {
      setErasingPointer(event);
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
        items: page.annotations.items.map((item) => {
          if (item.id !== itemId) {
            return item;
          }
          if (item.type !== "text") {
            return { ...item, text };
          }
          const m = measureTextBox(text, item.fontSize);
          const width = Math.min(Math.max(m.width, item.width ?? 0), page.width - item.x);
          const height = Math.max(m.height, item.height ?? 0);
          return { ...item, text, width, height };
        }),
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

  function beginItemResize(item, event, handle = "br") {
    if (viewScrollUnlocked) {
      return;
    }

    itemDragArmRef.current = null;

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

    const box =
      item.type === "text"
        ? getTextLayoutSize(item)
        : { width: item.width ?? 24, height: item.height ?? 24 };
    resizeState.current = {
      itemId: item.id,
      type: item.type,
      handle,
      start: coords,
      x0: item.x,
      y0: item.y,
      w0: box.width,
      h0: box.height,
      ...(item.type === "text" ? { text: item.text } : {}),
    };
  }

  return (
    <div className="page-editor-shell">
      <div
        ref={hostRef}
        className={tool === "eraser" ? "page-stage page-stage--eraser" : "page-stage"}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={(event) => handleStagePointerUp(event)}
        onPointerCancel={(event) => handleStagePointerUp(event)}
        onPointerLeave={handleStagePointerLeave}
      >
        <div className="page-stage-pan">
        <div
          className={viewScrollUnlocked ? "page-stage-inner page-stage-inner--pan" : "page-stage-inner"}
          style={{
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
          }}
        >
          <BaseLayer page={page} sourceDocument={page.kind === "pdf" ? documentsById[page.sourceId] : null} />

          <svg
            className="annotation-svg annotation-svg--hit"
            viewBox={`0 0 ${page.width} ${page.height}`}
            preserveAspectRatio="none"
          >
            {page.annotations.strokes.map((stroke) => {
              const isHi = stroke.penMode === "highlighter";
              const lineW = isHi ? Math.max(5, stroke.width * 2.35) : stroke.width;
              const pts = stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ");
              return (
                <polyline
                  key={stroke.id}
                  className="stroke-hitbox"
                  fill="none"
                  points={pts}
                  stroke="transparent"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={Math.max(lineW + 8, 16)}
                  pointerEvents="stroke"
                  onPointerDown={(event) => beginStrokeDrag(stroke, event)}
                />
              );
            })}
          </svg>

          {page.annotations.items
            .filter((item) => item.type === "signature" || item.type === "embeddedImage")
            .map((item) => (
              <AnnotationItem
                key={item.id}
                item={item}
                page={page}
                displayScale={stageHeight / page.height}
                selected={item.id === selectedItemId}
                onPointerDown={beginItemDrag}
                onResizePointerDown={beginItemResize}
                onTextChange={updateTextItem}
              />
            ))}

          <svg
            className="annotation-svg annotation-svg--display"
            pointerEvents="none"
            viewBox={`0 0 ${page.width} ${page.height}`}
            preserveAspectRatio="none"
          >
            {page.annotations.strokes.map((stroke) => {
              const isHi = stroke.penMode === "highlighter";
              const lineW = isHi ? Math.max(5, stroke.width * 2.35) : stroke.width;
              const showSel =
                stroke.id === selectedStrokeId && (!drawingStrokeId || drawingStrokeId !== stroke.id);
              const pts = stroke.points.map((point) => `${point.x},${page.height - point.y}`).join(" ");
              return (
                <g key={stroke.id}>
                  {showSel ? (
                    <polyline
                      fill="none"
                      points={pts}
                      stroke="rgba(37, 99, 235, 0.55)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={2.1}
                    />
                  ) : null}
                  <polyline
                    fill="none"
                    points={pts}
                    stroke={stroke.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={isHi ? 0.42 : 1}
                    strokeWidth={lineW}
                    style={isHi ? { mixBlendMode: "multiply" } : undefined}
                  />
                </g>
              );
            })}
          </svg>

          {page.annotations.items
            .filter((item) => item.type === "text")
            .map((item) => (
              <AnnotationItem
                key={item.id}
                item={item}
                page={page}
                displayScale={stageHeight / page.height}
                selected={item.id === selectedItemId}
                textEditing={item.id === textEditingItemId}
                onPointerDown={beginItemDrag}
                onResizePointerDown={beginItemResize}
                onTextChange={updateTextItem}
                onRequestTextEdit={(itemId) => {
                  setSelectedItemId(itemId);
                  setTextEditingItemId(itemId);
                }}
              />
            ))}

          {tool === "eraser" && eraserGuide ? (
            <svg
              aria-hidden="true"
              className="eraser-guide"
              viewBox={`0 0 ${page.width} ${page.height}`}
              preserveAspectRatio="none"
            >
              <circle
                cx={eraserGuide.x}
                cy={page.height - eraserGuide.y}
                fill="rgba(239, 68, 68, 0.14)"
                r={eraserSize}
                stroke="rgba(220, 38, 38, 0.9)"
                strokeWidth={Math.max(1, page.width * 0.0012)}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
        </div>
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

  return (
    <img
      alt=""
      className="base-preview"
      src={preview}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    />
  );
}

function AnnotationItem({
  displayScale = 1,
  item,
  onPointerDown,
  onResizePointerDown,
  onTextChange,
  page,
  selected,
  textEditing = false,
  onRequestTextEdit,
}) {
  const left = `${(item.x / page.width) * 100}%`;
  const bottom = `${(item.y / page.height) * 100}%`;
  const resize = (handle) => (event) => onResizePointerDown(item, event, handle);
  const textAreaRef = useRef(null);
  const textPointerStartRef = useRef(null);

  useEffect(() => {
    if (item.type !== "text" || !selected || !textEditing || !textAreaRef.current) {
      return;
    }
    textAreaRef.current.focus();
  }, [item.type, item.id, selected, textEditing]);

  if (item.type === "text") {
    const { width: bw, height: bh } = getTextLayoutSize(item);
    const wPct = `${(bw / page.width) * 100}%`;
    const hPct = `${(bh / page.height) * 100}%`;
    const scaledFontSize = Math.max(1, item.fontSize * displayScale);

    function onTextBodyPointerDown(event) {
      event.stopPropagation();
      textPointerStartRef.current = {
        id: item.id,
        x: event.clientX,
        y: event.clientY,
      };
      if (event.detail === 2 && onRequestTextEdit) {
        onRequestTextEdit(item.id);
        return;
      }
      onPointerDown(item, event);
    }

    function onTextBodyPointerUp(event) {
      const start = textPointerStartRef.current;
      textPointerStartRef.current = null;
      if (
        start?.id === item.id &&
        onRequestTextEdit &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) < TEXT_TAP_EDIT_MAX_DRAG_PX
      ) {
        onRequestTextEdit(item.id);
      }
    }

    return (
      <div
        className={selected ? "annotation-item text selected" : "annotation-item text"}
        style={{
          left,
          bottom,
          width: wPct,
          height: hPct,
          color: item.color,
          fontSize: `${scaledFontSize}px`,
        }}
        role="presentation"
        onPointerDown={!selected || !textEditing ? onTextBodyPointerDown : undefined}
        onPointerUp={!textEditing ? onTextBodyPointerUp : undefined}
      >
        {selected && !textEditing ? (
          <>
            <div className="annotation-text-fill">
              {item.text}
            </div>
            <button type="button" className="annotation-knob-corner annotation-knob--tl" aria-label="Sol ust" onPointerDown={resize("tl")} />
            <button type="button" className="annotation-knob-corner annotation-knob--tr" aria-label="Sag ust" onPointerDown={resize("tr")} />
            <button type="button" className="annotation-knob-corner annotation-knob--bl" aria-label="Sol alt" onPointerDown={resize("bl")} />
            <button type="button" className="annotation-knob-corner annotation-knob--br" aria-label="Sag alt" onPointerDown={resize("br")} />
          </>
        ) : null}
        {selected && textEditing ? (
          <>
            <div
              className="annotation-text-selected-shell"
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }
                event.stopPropagation();
                if (event.detail === 2 && onRequestTextEdit) {
                  onRequestTextEdit(item.id);
                  return;
                }
                onPointerDown(item, event);
              }}
            >
              <textarea
                ref={textAreaRef}
                aria-label="Metin"
                className="inline-textarea"
                style={{ color: item.color, fontSize: `${scaledFontSize}px` }}
                value={item.text}
                onChange={(event) => onTextChange(item.id, event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
              />
            </div>
            <button type="button" className="annotation-knob-corner annotation-knob--tl" aria-label="Sol ust" onPointerDown={resize("tl")} />
            <button type="button" className="annotation-knob-corner annotation-knob--tr" aria-label="Sag ust" onPointerDown={resize("tr")} />
            <button type="button" className="annotation-knob-corner annotation-knob--bl" aria-label="Sol alt" onPointerDown={resize("bl")} />
            <button type="button" className="annotation-knob-corner annotation-knob--br" aria-label="Sag alt" onPointerDown={resize("br")} />
          </>
        ) : null}
        {!selected ? <div className="annotation-text-fill">{item.text}</div> : null}
      </div>
    );
  }

  const imgKind = item.type === "embeddedImage" ? "embedded-image" : "signature";
  const resizeLabel = item.type === "embeddedImage" ? "Gorsel" : "Imza";

  return (
    <div
      className={selected ? `annotation-item ${imgKind} selected` : `annotation-item ${imgKind}`}
      style={{
        left,
        bottom,
        width: `${(item.width / page.width) * 100}%`,
        height: `${(item.height / page.height) * 100}%`,
      }}
      role="presentation"
      onPointerDown={(event) => onPointerDown(item, event)}
    >
      <img
        alt=""
        className="annotation-sig-img"
        src={item.dataUrl}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
      {selected ? (
        <>
          <button type="button" className="annotation-knob-corner annotation-knob--tl" aria-label={`${resizeLabel} sol ust`} onPointerDown={resize("tl")} />
          <button type="button" className="annotation-knob-corner annotation-knob--tr" aria-label={`${resizeLabel} sag ust`} onPointerDown={resize("tr")} />
          <button type="button" className="annotation-knob-corner annotation-knob--bl" aria-label={`${resizeLabel} sol alt`} onPointerDown={resize("bl")} />
          <button type="button" className="annotation-knob-corner annotation-knob--br" aria-label={`${resizeLabel} sag alt`} onPointerDown={resize("br")} />
        </>
      ) : null}
    </div>
  );
}

/** Beyaz / acik pikselleri seffaflastir, murekkep sinirlarina kirp (sayfada beyaz kutu olmasin). */
function canvasToTrimmedSignaturePng(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d", { alpha: true });
  if (!ctx || w < 1 || h < 1) {
    return null;
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const p = imageData.data;

  const isBackground = (i) => {
    const a = p[i + 3];
    if (a < 12) {
      return true;
    }
    return p[i] > 244 && p[i + 1] > 244 && p[i + 2] > 244;
  };

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      if (!isBackground(i)) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (maxX < minX) {
    return null;
  }

  const pad = Math.max(2, Math.round(4 * (w / 900)));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = ctx.getImageData(minX, minY, cw, ch);
  const cp = cropped.data;
  for (let i = 0; i < cp.length; i += 4) {
    if (cp[i] > 244 && cp[i + 1] > 244 && cp[i + 2] > 244) {
      cp[i + 3] = 0;
    }
  }

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d", { alpha: true });
  octx.putImageData(cropped, 0, 0);

  return {
    dataUrl: out.toDataURL("image/png"),
    naturalWidth: cw,
    naturalHeight: ch,
  };
}

function imageElementToTrimmedSignaturePng(img) {
  if (!img?.naturalWidth || !img?.naturalHeight) {
    return null;
  }
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d", { alpha: true });
  x.drawImage(img, 0, 0);
  return canvasToTrimmedSignaturePng(c);
}

function SignatureModal({ onClose, onSave, initialInkColor = "#111827" }) {
  const canvasRef = useRef(null);
  const penWidthRef = useRef(3);
  const inkColorRef = useRef(initialInkColor);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [penWidth, setPenWidth] = useState(3);
  const [inkColor, setInkColor] = useState(initialInkColor);

  useEffect(() => {
    penWidthRef.current = penWidth;
  }, [penWidth]);

  useEffect(() => {
    inkColorRef.current = inkColor;
  }, [inkColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 900 * ratio;
    canvas.height = 320 * ratio;
    canvas.style.width = "100%";
    canvas.style.height = "180px";

    const context = canvas.getContext("2d", { alpha: true });
    context.scale(ratio, ratio);
    context.lineWidth = penWidthRef.current;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = inkColorRef.current;
    context.clearRect(0, 0, 900, 320);
  }, []);

  function position(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 900,
      y: ((event.clientY - rect.top) / rect.height) * 320,
    };
  }

  function start(event) {
    const context = canvasRef.current.getContext("2d", { alpha: true });
    context.lineWidth = penWidthRef.current;
    context.strokeStyle = inkColorRef.current;
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

    const context = canvasRef.current.getContext("2d", { alpha: true });
    context.lineWidth = penWidthRef.current;
    context.strokeStyle = inkColorRef.current;
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function stop() {
    setIsDrawing(false);
  }

  function clear() {
    const context = canvasRef.current.getContext("2d", { alpha: true });
    context.clearRect(0, 0, 900, 320);
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
        <div className="signature-color-row">
          <span className="signature-pen-label">Renk</span>
          <input
            aria-label="Imza rengi"
            className="color-swatch signature-color-swatch"
            type="color"
            value={inkColor}
            onChange={(e) => setInkColor(e.target.value)}
          />
        </div>
        <div className="signature-pen-row">
          <span className="signature-pen-label">Kalem</span>
          <input
            aria-label="Kalem kalinligi"
            className="signature-pen-slider"
            max={8}
            min={1}
            step={0.5}
            type="range"
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
          />
          <span className="signature-pen-val">{penWidth}px</span>
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
          <button
            className="primary-btn compact-btn"
            disabled={!hasInk}
            onClick={() => {
              const trimmed = canvasToTrimmedSignaturePng(canvasRef.current);
              if (!trimmed) {
                return;
              }
              onSave({ ...trimmed, inkColor });
            }}
          >
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

/** Bos / hic sayfa eklenmemis proje: otomatik kayit ve gecemse yazilmaz. */
function shouldPersistProject(project) {
  return Array.isArray(project?.pages) && project.pages.length > 0;
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
    const { width, height: h } = getTextLayoutSize(item);
    return (
      point.x >= item.x - padding &&
      point.x <= item.x + width + padding &&
      point.y >= item.y - padding &&
      point.y <= item.y + h + padding
    );
  }

  if (item.type === "signature" || item.type === "embeddedImage") {
    return (
      point.x >= item.x - padding &&
      point.x <= item.x + item.width + padding &&
      point.y >= item.y - padding &&
      point.y <= item.y + item.height + padding
    );
  }

  return false;
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
