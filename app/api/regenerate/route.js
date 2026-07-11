import { regeneratePdf } from '../../../lib/pdf';
import { regenerateDocx, pdfFieldsToDocx } from '../../../lib/docx';
import { uploadBuffer, getSignedUrl } from '../../../lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, filename, type, fields, edits, qrEdits, watermark, convertTo } = body;

    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      const bodyText = await fileRes.text().catch(() => '');
      throw new Error(`Could not fetch original file (HTTP ${fileRes.status}) - ${bodyText.slice(0, 200)}`);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

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

    const uploaded = await uploadBuffer(outBuffer, outName);
    const signedUrl = getSignedUrl(uploaded.public_id);

    return Response.json({
      url: signedUrl,
      filename: outName,
      contentType,
    });
  } catch (err) {
    console.error('Regenerate error:', err);
    return Response.json({ error: err.message || 'Regeneration failed' }, { status: 500 });
  }
}
