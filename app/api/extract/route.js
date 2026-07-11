import { extractPdfFields } from '../../../lib/pdf';
import { extractDocxFields } from '../../../lib/docx';
import { uploadBuffer } from '../../../lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const filename = file.name;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isPdf = filename?.toLowerCase().endsWith('.pdf');
    const isDocx = filename?.toLowerCase().endsWith('.docx');
    if (!isPdf && !isDocx) {
      return Response.json({ error: 'Unsupported file type - upload a .pdf or .docx' }, { status: 400 });
    }

    uploadBuffer(buffer, filename).catch(err => {
      console.warn('Cloudinary storage upload failed (non-blocking):', err.message);
    });

    const type = isPdf ? 'pdf' : 'docx';
    const fields = isPdf ? await extractPdfFields(buffer) : await extractDocxFields(buffer);

    return Response.json({
      type,
      fields,
      filename,
      fileBase64: buffer.toString('base64'),
    });
  } catch (err) {
    console.error('Extract error:', err);
    return Response.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
