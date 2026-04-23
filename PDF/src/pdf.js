import { PDFDocument } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const pdfProxyCache = new Map();
const pdfLibCache = new Map();

export function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function fileToArrayBuffer(file) {
  return await file.arrayBuffer();
}

export async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function getPdfProxy(documentRecord) {
  if (!pdfProxyCache.has(documentRecord.id)) {
    const bytes = new Uint8Array(documentRecord.buffer.slice(0));
    pdfProxyCache.set(documentRecord.id, getDocument({ data: bytes }).promise);
  }

  return await pdfProxyCache.get(documentRecord.id);
}

export async function getPdfLibDocument(documentRecord) {
  if (!pdfLibCache.has(documentRecord.id)) {
    pdfLibCache.set(documentRecord.id, PDFDocument.load(documentRecord.buffer.slice(0)));
  }

  return await pdfLibCache.get(documentRecord.id);
}

export async function inspectPdf(file) {
  const buffer = await fileToArrayBuffer(file);
  const pdf = await getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      pageIndex: pageNumber - 1,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
  }

  return {
    id: uid("pdf"),
    kind: "pdf",
    name: file.name,
    buffer,
    pages,
  };
}

export async function inspectImage(file) {
  const buffer = await fileToArrayBuffer(file);
  const dataUrl = await fileToDataUrl(file);

  const meta = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image could not be read"));
    img.src = dataUrl;
  });

  return {
    id: uid("image"),
    kind: "image",
    name: file.name,
    buffer,
    mimeType: file.type || "image/png",
    dataUrl,
    width: meta.width,
    height: meta.height,
  };
}

export async function renderPdfPage(documentRecord, pageIndex, scale = 1.25) {
  const pdf = await getPdfProxy(documentRecord);
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  return canvas.toDataURL("image/png");
}

export async function exportProject(project) {
  const output = await PDFDocument.create();

  for (const page of project.pages) {
    let pdfPage;
    let pageWidth = page.width;
    let pageHeight = page.height;

    if (page.kind === "pdf") {
      const source = project.documents.find((documentRecord) => documentRecord.id === page.sourceId);
      const sourcePdf = await getPdfLibDocument(source);
      const [copiedPage] = await output.copyPages(sourcePdf, [page.sourcePageIndex]);

      pdfPage = output.addPage(copiedPage);
      pageWidth = pdfPage.getWidth();
      pageHeight = pdfPage.getHeight();
    } else {
      pdfPage = output.addPage([pageWidth, pageHeight]);

      if (page.kind === "image") {
        const embeddedImage = await embedPageImage(output, page);
        const fitted = fitIntoBox(
          embeddedImage.width,
          embeddedImage.height,
          pageWidth,
          pageHeight,
        );

        pdfPage.drawImage(embeddedImage, {
          x: fitted.x,
          y: fitted.y,
          width: fitted.width,
          height: fitted.height,
        });
      }
    }

    if (page.annotations.strokes.length || page.annotations.items.length) {
      const overlayDataUrl = await renderAnnotations(page, pageWidth, pageHeight);
      const overlayBytes = await fetch(overlayDataUrl).then((response) => response.arrayBuffer());
      const overlayImage = await output.embedPng(overlayBytes);

      pdfPage.drawImage(overlayImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }
  }

  return await output.save();
}

export function createBlankPage(template = "A4") {
  const templates = {
    A4: { width: 595, height: 842 },
    Letter: { width: 612, height: 792 },
    Square: { width: 700, height: 700 },
    Story: { width: 540, height: 960 },
  };

  const size = templates[template] ?? templates.A4;

  return {
    id: uid("page"),
    kind: "blank",
    name: `Blank ${template}`,
    width: size.width,
    height: size.height,
    annotations: { strokes: [], items: [] },
  };
}

export function pageFromPdf(documentRecord, pageMeta) {
  return {
    id: uid("page"),
    kind: "pdf",
    name: `${documentRecord.name} - ${pageMeta.pageIndex + 1}`,
    sourceId: documentRecord.id,
    sourcePageIndex: pageMeta.pageIndex,
    width: pageMeta.width,
    height: pageMeta.height,
    annotations: { strokes: [], items: [] },
  };
}

export function pageFromImage(imageRecord) {
  return {
    id: uid("page"),
    kind: "image",
    name: imageRecord.name,
    imageDataUrl: imageRecord.dataUrl,
    imageBuffer: imageRecord.buffer,
    imageType: imageRecord.mimeType,
    width: imageRecord.width,
    height: imageRecord.height,
    annotations: { strokes: [], items: [] },
  };
}

export function fitIntoBox(contentWidth, contentHeight, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / contentWidth, boxHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;

  return {
    width,
    height,
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
  };
}

async function renderAnnotations(page, width, height) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of page.annotations.strokes) {
    if (stroke.points.length < 2) {
      continue;
    }

    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.moveTo(stroke.points[0].x, height - stroke.points[0].y);

    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x, height - point.y);
    }

    context.stroke();
  }

  for (const item of page.annotations.items) {
    if (item.type === "text") {
      context.fillStyle = item.color;
      context.font = `${item.fontSize}px sans-serif`;
      context.textBaseline = "bottom";
      const lines = item.text.split("\n");

      lines.forEach((line, index) => {
        context.fillText(line, item.x, height - item.y - (lines.length - 1 - index) * item.fontSize * 1.2);
      });
    }

    if (item.type === "signature") {
      const image = await loadImage(item.dataUrl);
      context.drawImage(image, item.x, height - item.y - item.height, item.width, item.height);
    }
  }

  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function embedPageImage(output, page) {
  if (page.imageType === "image/png") {
    return await output.embedPng(page.imageBuffer.slice(0));
  }

  if (page.imageType === "image/jpeg" || page.imageType === "image/jpg") {
    return await output.embedJpg(page.imageBuffer.slice(0));
  }

  const pngDataUrl = await convertImageToPng(page.imageDataUrl);
  const pngBytes = await fetch(pngDataUrl).then((response) => response.arrayBuffer());
  return await output.embedPng(pngBytes);
}

async function convertImageToPng(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  context.drawImage(image, 0, 0);

  return canvas.toDataURL("image/png");
}
