import { regeneratePdf } from '../../../lib/pdf';
import { regenerateDocx, pdfFieldsToDocx } from '../../../lib/docx';
import { uploadBuffer } from '../../../lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fileBase64, filename, type, fields, edits, qrEdits, watermark, convertTo } = body;

    if (!fileBase64) throw new Error('No file data provided');
    const buffer = Buffer.from(fileBase64, 'base64');

    let outBuffer;
    let outName;
    let contentType;

    if (type === 'pdf' && convertTo === 'docx') {
      outBuffer = await pdfFieldsToDocx(fields);
      outName = filename.replace(/\.pdf$/i, '.docx');
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (type === 'pdf') {
      const fieldsById = {};
      for (const page of fields.pages) {
        for (const item of page.textItems) fieldsById[item.id] = item;
      }
      outBuffer = Buffer.from(await regeneratePdf(buffer, fieldsById, edits || [], qrEdits || [], watermark || null));
      outName = filename;
      contentType = 'application/pdf';
    } else if (type === 'docx') {
      const editsById = {};
      for (const e of edits || []) editsById[e.id] = e.newText;
      outBuffer = await regenerateDocx(fields.paragraphs, editsById);
      outName = filename;
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      return Response.json({ error: 'Unsupported type' }, { status: 400 });
    }

    uploadBuffer(outBuffer, outName).catch(err => {
      console.warn('Cloudinary storage upload failed (non-blocking):', err.message);
    });

    return new Response(outBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${outName}"`,
      },
    });
  } catch (err) {
    console.error('Regenerate error:', err);
    return Response.json({ error: err.message || 'Regeneration failed' }, { status: 500 });
  }
}
