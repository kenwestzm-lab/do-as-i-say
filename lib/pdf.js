import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  return pdfjs;
}

export async function extractPdfFields(buffer) {
  const pdfjs = await getPdfjs();
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems = textContent.items.map((item, idx) => {
      const tx = item.transform;
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

export async function regeneratePdf(buffer, fieldsById, edits, qrEdits = [], watermark = null) {
  const pdfDoc = await PDFDocument.load(new Uint8Array(buffer));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

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
    const pngImage = await pdfDoc.embedPng(new Uint8Array(pngBytes));
    page.drawImage(pngImage, {
      x: qr.x,
      y: qr.y,
      width: qr.size || 100,
      height: qr.size || 100,
    });
  }

  return await pdfDoc.save();
}
