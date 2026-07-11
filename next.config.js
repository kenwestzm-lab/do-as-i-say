/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'pdf-lib', 'mammoth', 'docx'],
    outputFileTracingIncludes: {
      '/api/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.js'],
    },
  },
};

module.exports = nextConfig;
