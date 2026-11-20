/** Render a PDF page to a PNG, fully in the browser. The pdf.js worker is bundled; nothing is fetched. */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SizePx } from '../model/types';

GlobalWorkerOptions.workerSrc = workerUrl;

export const PDF_DPI = 200;

/** Open a PDF from memory. Returns the loading task (to destroy afterwards) and the document. */
async function loadPdf(data: ArrayBuffer) {
  // copy: pdf.js transfers (detaches) the buffer it gets
  const task = getDocument({ data: new Uint8Array(data.slice(0)), disableFontFace: true });
  return { task, doc: await task.promise };
}

export async function pdfPageCount(data: ArrayBuffer): Promise<number> {
  const { task, doc } = await loadPdf(data);
  const n = doc.numPages;
  await task.destroy();
  return n;
}

export interface RenderedPage extends SizePx {
  blob: Blob;
  dpi: number;
}

export async function renderPdfPage(data: ArrayBuffer, pageNo: number, dpi = PDF_DPI): Promise<RenderedPage> {
  const { task, doc } = await loadPdf(data);
  try {
    const page = await doc.getPage(pageNo);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas niet beschikbaar');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG mislukt'))), 'image/png'));
    return { blob, widthPx: canvas.width, heightPx: canvas.height, dpi };
  } finally {
    await task.destroy();
  }
}

export async function imageSize(blob: Blob): Promise<SizePx> {
  const bmp = await createImageBitmap(blob);
  const r: SizePx = { widthPx: bmp.width, heightPx: bmp.height };
  bmp.close();
  return r;
}
