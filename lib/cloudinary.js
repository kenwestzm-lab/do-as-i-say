import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload a buffer (server-side) to Cloudinary as a raw file (PDF/DOCX aren't images)
export function uploadBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: `do-as-i-say/${Date.now()}-${filename}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export default cloudinary;
