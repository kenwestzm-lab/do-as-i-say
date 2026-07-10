import { extractPdfFields } from '../../../lib/pdf';
import { extractDocxFields } from '../../../lib/docx';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { url, filename } = await request.json();
    if (!url) return Response.json({ error: 'No url provided' }, { status: 400 });

    const fileRes = await fetch(url);
    if (!fileRes.ok) throw new Error('Could not fetch uploaded file from storage');
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const isPdf = filename?.toLowerCase().endsWith('.pdf');
    const isDocx = filename?.toLowerCase().endsWith('.docx');

    if (isPdf) {
      const fields = await extractPdfFields(buffer);
      return Response.json({ type: 'pdf', fields });
    } else if (isDocx) {
      const fields = await extractDocxFields(buffer);
      return Response.json({ type: 'docx', fields });
    } else {
      return Response.json({ error: 'Unsupported file type - upload a .pdf or .docx' }, { status: 400 });
    }
  } catch (err) {
    console.error('Extract error:', err);
    return Response.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
