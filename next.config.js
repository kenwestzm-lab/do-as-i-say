/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'pdf-lib', 'mammoth', 'docx'],
  },
};

module.exports = nextConfig;
