import { uploadBuffer } from '../../../lib/cloudinary';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadBuffer(buffer, file.name);

    return Response.json({
      url: result.secure_url,
      publicId: result.public_id,
      filename: file.name,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return Response.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
