import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * Extract editable paragraphs from a DOCX buffer.
 * Uses mammoth to pull raw text per paragraph (images/styles preserved
 * separately are out of scope for mammoth - it's a text-first extraction,
 * which is the honest tradeoff of using a free/open library here).
 */
export async function extractDocxFields(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  const paragraphs = value.split('\n').filter(p => p.trim().length > 0);
  return {
    paragraphs: paragraphs.map((text, idx) => ({ id: `para_${idx}`, text })),
  };
}

/**
 * Convert a PDF's extracted text fields into a real, downloadable DOCX.
 * This is the PDF -> Word conversion path.
 */
export async function pdfFieldsToDocx(pdfFields) {
  const children = [];
  for (const page of pdfFields.pages) {
    // Group text items by approximate line (y coordinate) to rebuild reading order
    const sorted = [...page.textItems].sort((a, b) => b.y - a.y || a.x - b.x);
    let lastY = null;
    let currentLine = [];
    for (const item of sorted) {
      if (lastY !== null && Math.abs(item.y - lastY) > 2) {
        children.push(new Paragraph({
          children: [new TextRun(currentLine.join(' '))],
        }));
        currentLine = [];
      }
      currentLine.push(item.text);
      lastY = item.y;
    }
    if (currentLine.length) {
      children.push(new Paragraph({ children: [new TextRun(currentLine.join(' '))] }));
    }
    children.push(new Paragraph({ children: [new TextRun('')] })); // page break spacer
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

/**
 * Apply edits to paragraph list and regenerate a DOCX buffer.
 */
export async function regenerateDocx(paragraphs, editsById) {
  const children = paragraphs.map(p => {
    const text = editsById[p.id] !== undefined ? editsById[p.id] : p.text;
    return new Paragraph({ children: [new TextRun(text)] });
  });
  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}
