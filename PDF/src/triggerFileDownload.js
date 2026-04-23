/**
 * Tarayicilarda gvenilir indirme: a elementi body'ye eklenir, click, sonra kaldurilir.
 */
export function triggerFileDownload(data, fileName, mimeType = "application/pdf") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
