import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

// pdfjs-dist needs the legacy build to run in Node (no DOM/worker)
async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  return pdfjs;
}

/**
 * Extract editable text fields + their exact position/size from a PDF.
 * Each returned item is something the user can edit in the form.
 * We deliberately do NOT touch image/graphics layers here (that's how
 * watermarks/logos/background art survive untouched) - only text runs.
 */
export async function extractPdfFields(buffer) {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems = textContent.items.map((item, idx) => {
      const tx = item.transform; // [a b c d e f] - e,f are x,y in PDF space
      return {
        id: `p${pageNum}_t${idx}`,
        page: pageNum,
        text: item.str,
        x: tx[4],
        y: tx[5],
        fontSize: Math.hypot(tx[2], tx[3]) || 12,
        width: item.width,
        height: item.height || 12,
      };
    }).filter(t => t.text.trim().length > 0);

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      textItems,
    });
  }

  return { pages };
}

/**
 * Apply user/AI edits to a PDF and return the regenerated buffer.
 * edits: [{ id, newText }]
 * qrEdits: [{ page, x, y, size, data }]  -> draws a new QR code the user requested
 *
 * HONEST LIMITATION: to change existing text we must mask the old glyphs with
 * an opaque rectangle sized exactly to that text run, then draw the new text
 * on top. This only covers the small area the original text occupied - any
 * watermark/background image elsewhere on the page (or as a separate PDF
 * layer/image object) is never touched or redrawn, so it survives as-is.
 * If a watermark literally overlaps the exact characters being edited, that
 * sliver of watermark under those specific characters will be covered -
 * that's an unavoidable consequence of changing what's printed there.
 */
export async function regeneratePdf(buffer, fieldsById, edits, qrEdits = [], watermark = null) {
  const pdfDoc = await PDFDocument.load(buffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Adding a NEW watermark the user asked for (does not touch/remove any
  // existing background watermark already in the file - that stays as-is
  // because we never rasterize or clear the page).
  if (watermark && watermark.text) {
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(watermark.text, {
        x: width / 4,
        y: height / 2,
        size: watermark.fontSize || 50,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: watermark.opacity ?? 0.3,
        rotate: { type: 'degrees', angle: 45 },
      });
    }
  }

  for (const edit of edits) {
    const original = fieldsById[edit.id];
    if (!original) continue;
    const page = pages[original.page - 1];
    if (!page) continue;

    // Mask the exact old text bounding box only
    page.drawRectangle({
      x: original.x - 1,
      y: original.y - 2,
      width: Math.max(original.width, font.widthOfTextAtSize(edit.newText, original.fontSize)) + 2,
      height: original.height + 4,
      color: rgb(1, 1, 1),
    });

    page.drawText(edit.newText, {
      x: original.x,
      y: original.y,
      size: original.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  for (const qr of qrEdits) {
    const page = pages[qr.page - 1];
    if (!page) continue;
    const dataUrl = await QRCode.toDataURL(qr.data, { margin: 0 });
    const pngBytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    const pngImage = await pdfDoc.embedPng(pngBytes);
    page.drawImage(pngImage, {
      x: qr.x,
      y: qr.y,
      width: qr.size || 100,
      height: qr.size || 100,
    });
  }

  return await pdfDoc.save();
}
